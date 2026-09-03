import os
import sys
import time
import json
import httpx
import redis as _redis_lib
from typing import Optional

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException, Depends, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from jwt_verify import verify_token

JWT_SECRET = os.environ.get("JWT_SECRET", "")
if not JWT_SECRET:
    print("FATAL: JWT_SECRET environment variable is not set.", file=sys.stderr)
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL", "")

AUTH_SVC_URL = os.environ.get("AUTH_SVC_URL", "http://localhost:8001")
INGESTION_SVC_URL = os.environ.get("INGESTION_SVC_URL", "http://localhost:8002")
FEATURE_SVC_URL = os.environ.get("FEATURE_SVC_URL", "http://localhost:8003")
ANOMALY_SVC_URL = os.environ.get("ANOMALY_SVC_URL", "http://localhost:8004")
EXPLAIN_SVC_URL = os.environ.get("EXPLAIN_SVC_URL", "http://localhost:8005")


app = FastAPI(title="gateway-svc")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    claims = verify_token(credentials.credentials, JWT_SECRET)
    if not claims:
        raise HTTPException(status_code=401, detail="Token is missing, invalid, or expired")
    return claims

def get_conn():
    return psycopg2.connect(DATABASE_URL)

client = httpx.AsyncClient(timeout=30.0)

RATE_LIMIT = 10
RATE_WINDOW = 60
ip_records: dict = {}  # In-memory fallback when Redis is unavailable

# Redis client for distributed, persistent rate limiting
_gw_redis = None


def _get_gw_redis():
    global _gw_redis
    if _gw_redis is not None:
        return _gw_redis
    try:
        REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        r = _redis_lib.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        r.ping()
        _gw_redis = r
    except Exception:
        _gw_redis = None
    return _gw_redis


def _get_real_ip(request: Request) -> str:
    """Extract the true client IP, honouring common reverse-proxy headers."""
    return (
        request.headers.get("X-Real-IP")
        or (request.headers.get("X-Forwarded-For") or "").split(",")[0].strip()
        or (request.client.host if request.client else "unknown")
    )


def check_rate_limit(request: Request):
    ip = _get_real_ip(request)
    r = _get_gw_redis()
    if r:
        try:
            now_ms = int(time.time() * 1000)
            window_start_ms = now_ms - (RATE_WINDOW * 1000)
            key = f"gw_ratelimit:{ip}"
            pipe = r.pipeline()
            pipe.zremrangebyscore(key, "-inf", window_start_ms)
            pipe.zcard(key)
            pipe.zadd(key, {str(now_ms): now_ms})
            pipe.expire(key, RATE_WINDOW)
            results = pipe.execute()
            if results[1] >= RATE_LIMIT:  # count BEFORE the new entry
                r.zrem(key, str(now_ms))
                raise HTTPException(status_code=429, detail="Too many requests")
            return
        except HTTPException:
            raise
        except Exception:
            pass  # Redis unavailable — fall through to in-memory fallback

    # In-memory fallback (single-process only)
    now = time.time()
    if ip not in ip_records:
        ip_records[ip] = []
    ip_records[ip] = [t for t in ip_records[ip] if now - t < RATE_WINDOW]
    if len(ip_records[ip]) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Too many requests")
    ip_records[ip].append(now)

async def proxy(url: str, request: Request, is_multipart: bool = False):
    query = request.url.query
    if query:
        url = f"{url}?{query}"
        
    method = request.method
    headers = dict(request.headers)
    headers.pop("host", None)
    headers.pop("content-length", None)
    
    try:
        if is_multipart:
            form = await request.form()
            file = form.get("file")
            content = await file.read()
            files = {"file": (file.filename, content, file.content_type)}
            data = {k: v for k, v in form.items() if k != "file"}
            headers.pop("content-type", None)
            req = client.build_request(method, url, headers=headers, data=data, files=files)
        else:
            body = await request.body()
            req = client.build_request(method, url, headers=headers, content=body)
            
        resp = await client.send(req)
        
        out_headers = {k: v for k, v in resp.headers.items() if k.lower() not in ('content-encoding', 'content-length', 'transfer-encoding', 'connection')}
        return Response(content=resp.content, status_code=resp.status_code, headers=out_headers, media_type=resp.headers.get("content-type"))
    except httpx.RequestError as e:
        return Response(content=json.dumps({"detail": f"Backend service unavailable: {str(e)}"}), status_code=502, media_type="application/json")


# ---------------------------------------------------------
# ROUTES
# ---------------------------------------------------------

@app.get("/health/all")
async def health_all():
    import asyncio
    import logging
    log = logging.getLogger("gateway-svc")

    svcs = {
        "auth-svc": AUTH_SVC_URL,
        "ingestion-svc": INGESTION_SVC_URL,
        "feature-svc": FEATURE_SVC_URL,
        "anomaly-svc": ANOMALY_SVC_URL,
        "explain-svc": EXPLAIN_SVC_URL
    }

    async def probe_one(name: str, base_url: str) -> tuple[str, str]:
        url = base_url.replace("localhost", "127.0.0.1") + "/health"
        try:
            async with httpx.AsyncClient(timeout=5.0, http1=True, http2=False) as c:
                r = await c.get(url)
                return name, "ok" if r.status_code == 200 else "unreachable"
        except Exception as exc:
            log.warning("Health probe failed for %s (%s): %s", name, url, exc)
            return name, "unreachable"

    results = {"gateway-svc": "ok"}
    pairs = await asyncio.gather(*(probe_one(n, u) for n, u in svcs.items()))
    results.update(dict(pairs))
    return results


@app.post("/auth/signup")
async def proxy_auth_signup(request: Request):
    check_rate_limit(request)
    return await proxy(AUTH_SVC_URL + "/auth/signup", request)

@app.post("/auth/login")
async def proxy_auth_login(request: Request):
    check_rate_limit(request)
    return await proxy(AUTH_SVC_URL + "/auth/login", request)

@app.post("/auth/login/verify-otp")
async def proxy_auth_login_verify(request: Request):
    check_rate_limit(request)
    return await proxy(AUTH_SVC_URL + "/auth/login/verify-otp", request)

@app.post("/auth/signup/verify-otp")
async def proxy_auth_signup_verify(request: Request):
    check_rate_limit(request)
    return await proxy(AUTH_SVC_URL + "/auth/signup/verify-otp", request)

@app.post("/auth/signup/resend-otp")
async def proxy_auth_signup_resend(request: Request):
    check_rate_limit(request)
    return await proxy(AUTH_SVC_URL + "/auth/signup/resend-otp", request)

@app.post("/auth/forgot-password")
async def proxy_auth_forgot(request: Request):
    check_rate_limit(request)
    return await proxy(AUTH_SVC_URL + "/auth/forgot-password", request)

@app.post("/auth/reset-password")
async def proxy_auth_reset(request: Request):
    check_rate_limit(request)
    return await proxy(AUTH_SVC_URL + "/auth/reset-password", request)

@app.post("/auth/logout")
async def proxy_auth_logout(request: Request):
    return await proxy(AUTH_SVC_URL + "/auth/logout", request)

@app.get("/auth/me")
async def proxy_auth_me(request: Request):
    return await proxy(AUTH_SVC_URL + "/auth/me", request)

@app.post("/merchants")
async def proxy_merchants_post(request: Request, _: dict = Depends(get_current_user)):
    return await proxy(INGESTION_SVC_URL + "/merchants", request)

@app.get("/merchants")
async def proxy_merchants_get(request: Request, _: dict = Depends(get_current_user)):
    return await proxy(INGESTION_SVC_URL + "/merchants", request)

@app.get("/merchants/{id}")
async def proxy_merchants_get_id(id: str, request: Request, _: dict = Depends(get_current_user)):
    return await proxy(INGESTION_SVC_URL + f"/merchants/{id}", request)

@app.post("/upload")
async def proxy_upload(request: Request, _: dict = Depends(get_current_user)):
    check_rate_limit(request)
    return await proxy(INGESTION_SVC_URL + "/upload", request, is_multipart=True)

@app.post("/simulate/start")
async def proxy_sim_start(request: Request, _: dict = Depends(get_current_user)):
    check_rate_limit(request)
    return await proxy(INGESTION_SVC_URL + "/simulate/start", request)

@app.post("/simulate/stop")
async def proxy_sim_stop(request: Request, _: dict = Depends(get_current_user)):
    return await proxy(INGESTION_SVC_URL + "/simulate/stop", request)

@app.get("/simulate/status/{id}")
async def proxy_sim_status(id: str, request: Request, _: dict = Depends(get_current_user)):
    return await proxy(INGESTION_SVC_URL + f"/simulate/status/{id}", request)

@app.get("/merchants/{id}/features")
async def proxy_features(id: str, request: Request, _: dict = Depends(get_current_user)):
    return await proxy(FEATURE_SVC_URL + f"/merchants/{id}/features", request)

@app.get("/merchants/{id}/anomalies")
async def proxy_anomalies_get(id: str, request: Request, _: dict = Depends(get_current_user)):
    return await proxy(ANOMALY_SVC_URL + f"/merchants/{id}/anomalies", request)

@app.post("/merchants/{id}/analyze")
async def proxy_analyze(id: str, request: Request, _: dict = Depends(get_current_user)):
    check_rate_limit(request)
    return await proxy(ANOMALY_SVC_URL + f"/merchants/{id}/analyze", request)

@app.get("/merchants/{id}/alerts")
async def proxy_alerts_get(id: str, request: Request, _: dict = Depends(get_current_user)):
    return await proxy(EXPLAIN_SVC_URL + f"/merchants/{id}/alerts", request)

@app.post("/merchants/{id}/explain")
async def proxy_explain(id: str, request: Request, _: dict = Depends(get_current_user)):
    return await proxy(EXPLAIN_SVC_URL + f"/merchants/{id}/explain", request)

@app.post("/alerts/{id}/acknowledge")
async def proxy_ack(id: str, request: Request, _: dict = Depends(get_current_user)):
    return await proxy(EXPLAIN_SVC_URL + f"/alerts/{id}/acknowledge", request)

@app.post("/alerts/{id}/dismiss")
async def proxy_dismiss(id: str, request: Request, _: dict = Depends(get_current_user)):
    return await proxy(EXPLAIN_SVC_URL + f"/alerts/{id}/dismiss", request)

@app.get("/audit/{entity_type}/{entity_id}")
async def get_audit(entity_type: str, entity_id: str, user: dict = Depends(get_current_user)):
    role = user.get("role")
    
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if role == "merchant":
                merch_id = str(user.get("merchant_id"))
                if entity_type == "merchant":
                    if entity_id != merch_id:
                        raise HTTPException(status_code=403, detail="Access denied")
                elif entity_type == "alert":
                    cur.execute("SELECT merchant_id FROM alerts WHERE id = %s", (entity_id,))
                    row = cur.fetchone()
                    if not row or str(row["merchant_id"]) != merch_id:
                        raise HTTPException(status_code=403, detail="Access denied")
                elif entity_type == "anomaly_score":
                    cur.execute("SELECT merchant_id FROM anomaly_scores WHERE id = %s", (entity_id,))
                    row = cur.fetchone()
                    if not row or str(row["merchant_id"]) != merch_id:
                        raise HTTPException(status_code=403, detail="Access denied")
                elif entity_type == "transaction":
                    cur.execute("SELECT merchant_id FROM transactions WHERE id = %s", (entity_id,))
                    row = cur.fetchone()
                    if not row or str(row["merchant_id"]) != merch_id:
                        raise HTTPException(status_code=403, detail="Access denied")
                else:
                    # Unknown entity type for merchant, deny to be safe
                    raise HTTPException(status_code=403, detail="Access denied")
                    
            cur.execute("""
                SELECT * FROM audit_log 
                WHERE entity_type = %s AND entity_id = %s 
                ORDER BY created_at ASC
            """, (entity_type, entity_id))
            rows = cur.fetchall()
            
    for r in rows:
        r["id"] = str(r["id"])
        r["entity_id"] = str(r["entity_id"])
        if r.get("created_at"): r["created_at"] = r["created_at"].isoformat()
    return rows