"""
ingestion-svc  — Transaction ingestion pipeline
Port: 8002
"""
import io
import json
import os
import sys
import asyncio
from datetime import datetime, timezone, timedelta, date
from typing import Optional

import pandas as pd
import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException, Request, status, Depends, File, UploadFile, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

from jwt_verify import verify_token
import simulator

# ---------------------------------------------------------------------------
# Global State
# ---------------------------------------------------------------------------
simulations = {}

# ---------------------------------------------------------------------------
# Startup guard
# ---------------------------------------------------------------------------
JWT_SECRET = os.environ.get("JWT_SECRET", "")
if not JWT_SECRET:
    print(
        "FATAL: JWT_SECRET environment variable is not set. "
        "ingestion-svc refuses to start without it.",
        file=sys.stderr,
        flush=True,
    )
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    print(
        "FATAL: DATABASE_URL environment variable is not set.",
        file=sys.stderr,
        flush=True,
    )
    sys.exit(1)

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def get_conn():
    return psycopg2.connect(DATABASE_URL)

def db_execute(sql: str, params=(), fetch: str = "none"):
    with get_conn() as conn:
        conn.autocommit = True
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            if fetch == "one":
                return cur.fetchone()
            if fetch == "all":
                return cur.fetchall()
            return None

# ---------------------------------------------------------------------------
# Auth Dependency
# ---------------------------------------------------------------------------

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    claims = verify_token(token, JWT_SECRET)
    if not claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing, invalid, or expired"
        )
    return claims

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class MerchantCreate(BaseModel):
    name: str
    category: Optional[str] = None
    persona: Optional[str] = None

class SimulateStartReq(BaseModel):
    merchant_id: str
    persona: str
    days: int = 60
    speed_multiplier: float = 1.0
    seed: Optional[int] = None

class SimulateStopReq(BaseModel):
    merchant_id: str

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="ingestion-svc")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ingestion-svc"}


# ── POST /merchants ────────────────────────────────────────────────────────
@app.post("/merchants", status_code=status.HTTP_201_CREATED)
async def create_merchant(body: MerchantCreate, user: dict = Depends(get_current_user)):
    role = user.get("role")
    if role not in ("admin", "analyst"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin or analyst can create merchants"
        )
    
    persona = body.persona.strip() if body.persona else "real_upload"
    synthetic_personas = {'healthy', 'declining', 'viral_growth', 'fraud_ring', 'seasonal'}
    is_synthetic = persona in synthetic_personas

    row = db_execute(
        """
        INSERT INTO merchants (name, category, persona, is_synthetic)
        VALUES (%s, %s, %s, %s)
        RETURNING id, name, category, persona, onboarded_at, baseline_daily_txn, baseline_ticket_size, is_synthetic
        """,
        (body.name, body.category, persona, is_synthetic),
        fetch="one"
    )

    merchant_id_str = str(row["id"])

    db_execute(
        """
        INSERT INTO audit_log (actor, action, entity_type, entity_id, metadata)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (
            user.get("sub"),
            "merchant.created",
            "merchant",
            merchant_id_str,
            json.dumps({"name": body.name, "persona": persona, "is_synthetic": is_synthetic})
        )
    )

    row["id"] = merchant_id_str
    row["onboarded_at"] = row["onboarded_at"].isoformat() if row["onboarded_at"] else None

    return dict(row)


# ── GET /merchants ─────────────────────────────────────────────────────────
@app.get("/merchants")
async def get_merchants(user: dict = Depends(get_current_user)):
    role = user.get("role")
    merchant_id = user.get("merchant_id")

    if role in ("admin", "analyst"):
        rows = db_execute("SELECT * FROM merchants", fetch="all")
    elif role == "merchant":
        if not merchant_id:
            return []
        rows = db_execute("SELECT * FROM merchants WHERE id = %s", (merchant_id,), fetch="all")
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unauthorized role")
    
    for row in rows:
        row["id"] = str(row["id"])
        if row.get("onboarded_at"):
            row["onboarded_at"] = row["onboarded_at"].isoformat()

    return rows


# ── GET /merchants/{id} ────────────────────────────────────────────────────
@app.get("/merchants/{id}")
async def get_merchant_by_id(id: str, user: dict = Depends(get_current_user)):
    role = user.get("role")
    
    if role == "merchant":
        if str(user.get("merchant_id")) != id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to other merchant profiles")

    row = db_execute("SELECT * FROM merchants WHERE id = %s", (id,), fetch="one")
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant not found")

    row["id"] = str(row["id"])
    if row.get("onboarded_at"):
        row["onboarded_at"] = row["onboarded_at"].isoformat()

    return dict(row)


# ── POST /simulate/start ───────────────────────────────────────────────────
async def run_simulation_task(merchant_id: str, txns: list, start_date: date, total_days: int, speed: float):
    from collections import defaultdict
    daily_txns = defaultdict(list)
    for t in txns:
        day_idx = (t['ts'].date() - start_date).days
        if day_idx < 0: day_idx = 0
        if day_idx >= total_days: day_idx = total_days - 1
        daily_txns[day_idx].append(t)
        
    try:
        for day_idx in range(total_days):
            if simulations.get(merchant_id, {}).get("status") != "running":
                break
                
            batch = daily_txns.get(day_idx, [])
            if batch:
                insert_query = """
                INSERT INTO transactions
                (merchant_id, ts, amount, currency, status, payment_method, customer_id, is_refund, source)
                VALUES %s
                ON CONFLICT DO NOTHING
                """
                values = [
                    (
                        b['merchant_id'], b['ts'], b['amount'], b['currency'],
                        b['status'], b['payment_method'], b['customer_id'],
                        b['is_refund'], b['source']
                    ) for b in batch
                ]
                with get_conn() as conn:
                    conn.autocommit = True
                    with conn.cursor() as cur:
                        psycopg2.extras.execute_values(cur, insert_query, values, page_size=2000)
            
            if merchant_id in simulations:
                simulations[merchant_id]["current_day_index"] = day_idx + 1
            
            # Sleep simulated time
            await asyncio.sleep(1.0 / speed)
            
        if simulations.get(merchant_id, {}).get("status") == "running":
            simulations[merchant_id]["status"] = "completed"
            
    except asyncio.CancelledError:
        if merchant_id in simulations:
            simulations[merchant_id]["status"] = "stopped"
    except Exception as e:
        if merchant_id in simulations:
            simulations[merchant_id]["status"] = "stopped"
        print(f"Simulation error: {e}", file=sys.stderr)


@app.post("/simulate/start", status_code=status.HTTP_202_ACCEPTED)
async def start_simulation(req: SimulateStartReq, user: dict = Depends(get_current_user)):
    role = user.get("role")
    if role == "merchant" and str(user.get("merchant_id")) != req.merchant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        
    if req.merchant_id in simulations and simulations[req.merchant_id]["status"] == "running":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Simulation already running for this merchant")
        
    valid_personas = {"healthy", "declining", "viral_growth", "fraud_ring", "seasonal"}
    if req.persona not in valid_personas:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid persona")
        
    if req.speed_multiplier > 10.0:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="speed_multiplier must be between 0.01 and 10.0")
        
    import random
    seed = req.seed if req.seed is not None else random.randint(0, 1000000)
    
    # Update merchant persona
    merch = db_execute(
        "UPDATE merchants SET persona = %s, is_synthetic = true WHERE id = %s RETURNING id",
        (req.persona, req.merchant_id),
        fetch="one"
    )
    if not merch:
        raise HTTPException(status_code=404, detail="Merchant not found")
        
    # Precompute
    start_date = datetime.now(timezone.utc).date()
    try:
        txns = simulator.generate(req.merchant_id, start_date, req.days, req.persona, seed)
    except Exception as e:
        print(f"ERROR: Simulation generation failed for merchant {req.merchant_id}: {e}", file=sys.stderr, flush=True)
        raise HTTPException(status_code=500, detail="Failed to generate simulation data. Please try again.")
        
    # Audit log
    db_execute(
        """
        INSERT INTO audit_log (actor, action, entity_type, entity_id, metadata)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (
            user.get("sub"),
            "simulation.started",
            "merchant",
            req.merchant_id,
            json.dumps({"persona": req.persona, "days": req.days, "speed_multiplier": req.speed_multiplier, "seed": seed})
        )
    )
    
    simulations[req.merchant_id] = {
        "status": "running",
        "persona": req.persona,
        "days": req.days,
        "speed_multiplier": req.speed_multiplier,
        "seed": seed,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "current_day_index": 0,
        "total_days": req.days
    }
    
    task = asyncio.create_task(run_simulation_task(req.merchant_id, txns, start_date, req.days, req.speed_multiplier))
    simulations[req.merchant_id]["task"] = task
    
    return {
        "merchant_id": req.merchant_id,
        "persona": req.persona,
        "seed": seed,
        "total_days": req.days,
        "estimated_real_seconds": req.days / req.speed_multiplier
    }


# ── POST /simulate/stop ────────────────────────────────────────────────────
@app.post("/simulate/stop")
async def stop_simulation(req: SimulateStopReq, user: dict = Depends(get_current_user)):
    role = user.get("role")
    if role == "merchant" and str(user.get("merchant_id")) != req.merchant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        
    if req.merchant_id not in simulations:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No simulation found")
        
    sim = simulations[req.merchant_id]
    if sim["status"] == "running":
        sim["status"] = "stopped"
        if "task" in sim:
            sim["task"].cancel()
            
    db_execute(
        """
        INSERT INTO audit_log (actor, action, entity_type, entity_id, metadata)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (user.get("sub"), "simulation.stopped", "merchant", req.merchant_id, "{}")
    )
    return {"status": "stopped"}


# ── GET /simulate/status/{merchant_id} ─────────────────────────────────────
@app.get("/simulate/status/{merchant_id}")
async def get_simulation_status(merchant_id: str, user: dict = Depends(get_current_user)):
    role = user.get("role")
    if role == "merchant" and str(user.get("merchant_id")) != merchant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        
    if merchant_id not in simulations:
        return {"status": "not_found"}
        
    sim = simulations[merchant_id]
    return {
        "status": sim["status"],
        "persona": sim["persona"],
        "current_day_index": sim["current_day_index"],
        "total_days": sim["total_days"],
        "seed": sim["seed"]
    }

# ── POST /upload ───────────────────────────────────────────────────────────
@app.post("/upload")
async def upload_csv(
    merchant_id: str = Form(...),
    stream: bool = Form(False),
    target_seconds: int = Form(30),
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user)
):
    import math
    role = user.get("role")
    
    # Validate access
    if role == "merchant":
        if str(user.get("merchant_id")) != merchant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Can only upload to your own merchant_id."
            )
            
    # Check if merchant exists
    merch = db_execute("SELECT id FROM merchants WHERE id = %s", (merchant_id,), fetch="one")
    if not merch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant not found")

    # File validation — enforce size and content-type before reading into memory (HIGH-3 fix)
    MAX_CSV_BYTES = 50 * 1024 * 1024  # 50 MB
    allowed_types = {"text/csv", "application/csv", "application/octet-stream", "application/vnd.ms-excel"}
    if file.content_type and file.content_type.split(";")[0].strip() not in allowed_types:
        raise HTTPException(status_code=422, detail="Only CSV files are accepted.")
    raw_bytes = await file.read(MAX_CSV_BYTES + 1)
    if len(raw_bytes) > MAX_CSV_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum allowed size is 50 MB.")

    # Read CSV
    try:
        df = pd.read_csv(io.BytesIO(raw_bytes))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid CSV format: {e}")

    # Check required columns
    required_cols = {"ts", "amount", "status", "payment_method", "customer_id"}
    missing = required_cols - set(df.columns)
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Missing columns: {', '.join(missing)}"
        )

    errors = []
    valid_rows = []

    for i, row in df.iterrows():
        row_num = i + 2 # 1 for header, 1 for 0-index
        
        try:
            # 1. ts
            ts_val = pd.to_datetime(row["ts"])
            if ts_val.tzinfo is None:
                ts_val = ts_val.tz_localize("UTC")
            
            # 2. amount
            try:
                amt = float(row["amount"])
                if math.isnan(amt):
                    raise ValueError("amount must be a valid number")
            except ValueError:
                raise ValueError("amount must be a valid number")
                
            if amt < 0:
                raise ValueError("amount must be >= 0")
                
            # 3. status
            status_val = str(row["status"]).strip().lower()
            if status_val not in ("success", "failed", "refunded", "chargeback"):
                raise ValueError(f"invalid status: {status_val}")
                
            # 4. customer_id
            cust_id = str(row["customer_id"]).strip()
            if not cust_id or cust_id.lower() == "nan":
                raise ValueError("customer_id cannot be empty")
                
            # Optional: payment_method, currency
            pm = str(row.get("payment_method", "")).strip()
            if pm.lower() == "nan":
                pm = None
                
            currency = str(row.get("currency", "INR")).strip()
            if not currency or currency.lower() == "nan":
                currency = "INR"

            is_refund = (status_val == "refunded")
            source = "upload"

            valid_rows.append((
                merchant_id,
                ts_val,
                amt,
                currency,
                status_val,
                pm,
                cust_id,
                is_refund,
                source
            ))
            
        except Exception as e:
            errors.append({"row": row_num, "error": str(e)})

    rows_ingested = 0
    rows_duplicate = 0

    if valid_rows:
        if stream:
            # Handle streaming
            # Sort valid rows by timestamp (index 1)
            valid_rows.sort(key=lambda x: x[1])
            
            start_date = valid_rows[0][1].date()
            end_date = valid_rows[-1][1].date()
            total_days = (end_date - start_date).days + 1
            if total_days < 1:
                total_days = 1
                
            # target_seconds controls how fast the simulation runs.
            # speed_multiplier = total_days / target_seconds
            speed_multiplier = max(0.1, total_days / max(1, target_seconds))
            
            # Convert valid_rows (tuples) to list of dicts for run_simulation_task
            txns = []
            for r in valid_rows:
                txns.append({
                    "merchant_id": r[0],
                    "ts": r[1],
                    "amount": r[2],
                    "currency": r[3],
                    "status": r[4],
                    "payment_method": r[5],
                    "customer_id": r[6],
                    "is_refund": r[7],
                    "source": r[8]
                })
                
            simulations[merchant_id] = {
                "status": "running",
                "persona": "real_upload",
                "days": total_days,
                "speed_multiplier": speed_multiplier,
                "seed": 0,
                "started_at": datetime.now(timezone.utc).isoformat(),
                "current_day_index": 0,
                "total_days": total_days
            }
            
            task = asyncio.create_task(run_simulation_task(merchant_id, txns, start_date, total_days, speed_multiplier))
            simulations[merchant_id]["task"] = task
            
            rows_ingested = len(valid_rows)
            rows_duplicate = 0
        else:
            insert_query = """
            INSERT INTO transactions
            (merchant_id, ts, amount, currency, status, payment_method, customer_id, is_refund, source)
            VALUES %s
            ON CONFLICT (merchant_id, ts, amount, customer_id, status) DO NOTHING
            RETURNING id
            """
            
            with get_conn() as conn:
                conn.autocommit = True
                with conn.cursor() as cur:
                    psycopg2.extras.execute_values(cur, insert_query, valid_rows, page_size=1000)
                    ingested_records = cur.fetchall()
                    rows_ingested = len(ingested_records)
                    rows_duplicate = len(valid_rows) - rows_ingested

        # Audit log
        db_execute(
            """
            INSERT INTO audit_log (actor, action, entity_type, entity_id, metadata)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                user.get("sub"),
                "data.uploaded",
                "merchant",
                merchant_id,
                json.dumps({
                    "rows_ingested": rows_ingested,
                    "rows_rejected": len(errors),
                    "rows_duplicate": rows_duplicate
                })
            )
        )

    # ---------------------------------------------------------
    # Accounting Total Assertion
    # ---------------------------------------------------------
    total_rows_in_file = len(df)
    if (rows_ingested + len(errors) + rows_duplicate) != total_rows_in_file:
        error_msg = f"Row accounting mismatch! Total: {total_rows_in_file}, Ingested: {rows_ingested}, Rejected: {len(errors)}, Duplicate: {rows_duplicate}"
        print(f"ERROR: {error_msg}", file=sys.stderr, flush=True)

    res = {
        "merchant_id": merchant_id,
        "rows_ingested": rows_ingested,
        "rows_rejected": len(errors),
        "rows_duplicate": rows_duplicate,
        "errors": errors
    }
    
    if stream and valid_rows:
        res["stream"] = True
        res["total_days"] = total_days
        res["estimated_real_seconds"] = target_seconds
        
    return res