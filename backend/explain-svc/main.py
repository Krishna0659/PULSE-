import os
import sys
import json
from datetime import datetime, date
from typing import Optional

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from jwt_verify import verify_token
import explainer

JWT_SECRET = os.environ.get("JWT_SECRET", "")
if not JWT_SECRET:
    print("FATAL: JWT_SECRET environment variable is not set.", file=sys.stderr)
    sys.exit(1)
    
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
if not ANTHROPIC_API_KEY:
    print("WARNING: ANTHROPIC_API_KEY not set — explain-svc will use rule-based fallback explanations.", file=sys.stderr)


DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    print("FATAL: DATABASE_URL environment variable is not set.", file=sys.stderr)
    sys.exit(1)

def get_conn():
    return psycopg2.connect(DATABASE_URL)

app = FastAPI(title="explain-svc")
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    claims = verify_token(credentials.credentials, JWT_SECRET)
    if not claims:
        raise HTTPException(status_code=401, detail="Token is missing, invalid, or expired")
    return claims

@app.get("/health")
async def health():
    return {"status": "ok", "service": "explain-svc"}

@app.post("/merchants/{id}/explain")
async def explain_anomaly(id: str, day: Optional[str] = None, user: dict = Depends(get_current_user)):
    role = user.get("role")
    if role == "merchant" and str(user.get("merchant_id")) != id:
        raise HTTPException(status_code=403, detail="Access denied")
        
    if not day:
        raise HTTPException(status_code=422, detail="day parameter is required")
        
    try:
        target_date = datetime.strptime(day, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid date format, use YYYY-MM-DD")
        
    with get_conn() as conn:
        conn.autocommit = True
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM anomaly_scores WHERE merchant_id = %s AND day = %s", (id, target_date))
            anomaly_row = cur.fetchone()
            if not anomaly_row:
                raise HTTPException(status_code=404, detail="Anomaly score not found")
                
            cur.execute("SELECT name FROM merchants WHERE id = %s", (id,))
            merchant_row = cur.fetchone()
            merchant_name = merchant_row["name"] if merchant_row else "Unknown"
            
            # call LLM
            exp_res = explainer.generate_explanation(anomaly_row, merchant_name)
            
            if exp_res["recommended_action"] == "no_action":
                return exp_res
                
            # Upsert alert
            cur.execute("SELECT id FROM alerts WHERE anomaly_score_id = %s", (anomaly_row["id"],))
            existing_alert = cur.fetchone()
            
            if existing_alert:
                alert_id = existing_alert["id"]
                cur.execute("""
                    UPDATE alerts SET
                        recommended_action = %s,
                        explanation_text = %s
                    WHERE id = %s
                    RETURNING *
                """, (exp_res["recommended_action"], exp_res["explanation_text"], alert_id))
                final_alert = cur.fetchone()
                action_str = "alert.updated"
            else:
                cur.execute("""
                    INSERT INTO alerts (merchant_id, anomaly_score_id, recommended_action, explanation_text, status)
                    VALUES (%s, %s, %s, %s, 'open')
                    RETURNING *
                """, (id, anomaly_row["id"], exp_res["recommended_action"], exp_res["explanation_text"]))
                final_alert = cur.fetchone()
                alert_id = final_alert["id"]
                action_str = "alert.created"
                
            # Write audit log
            meta = {
                "classification": anomaly_row["classification"],
                "recommended_action": exp_res["recommended_action"],
                "confidence": exp_res["confidence"],
                "llm_validation_passed": exp_res["llm_validation_passed"]
            }
            cur.execute("""
                INSERT INTO audit_log (actor, action, entity_type, entity_id, metadata)
                VALUES (%s, %s, 'alert', %s, %s)
            """, ("system:explain-svc", action_str, alert_id, json.dumps(meta)))
            
            final_alert["id"] = str(final_alert["id"])
            final_alert["merchant_id"] = str(final_alert["merchant_id"])
            final_alert["anomaly_score_id"] = str(final_alert["anomaly_score_id"])
            if final_alert.get("created_at"): final_alert["created_at"] = final_alert["created_at"].isoformat()
            if final_alert.get("resolved_at"): final_alert["resolved_at"] = final_alert["resolved_at"].isoformat()
            
            final_alert['confidence'] = exp_res['confidence']
            return final_alert

@app.get("/merchants/{id}/alerts")
async def get_alerts(id: str, user: dict = Depends(get_current_user)):
    role = user.get("role")
    if role == "merchant" and str(user.get("merchant_id")) != id:
        raise HTTPException(status_code=403, detail="Access denied")
        
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT a.*, ans.day, ans.classification 
                FROM alerts a
                JOIN anomaly_scores ans ON a.anomaly_score_id = ans.id
                WHERE a.merchant_id = %s
                ORDER BY ans.day DESC
            """, (id,))
            rows = cur.fetchall()
            
    for r in rows:
        r["id"] = str(r["id"])
        r["merchant_id"] = str(r["merchant_id"])
        r["anomaly_score_id"] = str(r["anomaly_score_id"])
        r["day"] = r["day"].isoformat()
        if r.get("created_at"): r["created_at"] = r["created_at"].isoformat()
        if r.get("resolved_at"): r["resolved_at"] = r["resolved_at"].isoformat()
    return rows

@app.post("/alerts/{id}/{action}")
async def action_alert(id: str, action: str, user: dict = Depends(get_current_user)):
    if action not in ("acknowledge", "dismiss"):
        raise HTTPException(status_code=404, detail="Not found")
        
    with get_conn() as conn:
        conn.autocommit = True
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SELECT * FROM alerts WHERE id = %s", (id,))
            alert = cur.fetchone()
            if not alert:
                raise HTTPException(status_code=404, detail="Alert not found")
                
            role = user.get("role")
            if role == "merchant" and str(user.get("merchant_id")) != str(alert["merchant_id"]):
                raise HTTPException(status_code=403, detail="Access denied")
                
            status_val = "acknowledged" if action == "acknowledge" else "dismissed"

            # Use separate parameterized queries — no f-string SQL interpolation (CRIT-3 fix)
            if action == "dismiss":
                cur.execute("""
                    UPDATE alerts
                    SET status = %s, resolved_at = now()
                    WHERE id = %s
                    RETURNING *
                """, (status_val, id))
            else:
                cur.execute("""
                    UPDATE alerts
                    SET status = %s, resolved_at = NULL
                    WHERE id = %s
                    RETURNING *
                """, (status_val, id))
            updated = cur.fetchone()
            
            # Audit log
            actor = user.get("sub", "unknown")
            cur.execute("""
                INSERT INTO audit_log (actor, action, entity_type, entity_id, metadata)
                VALUES (%s, %s, 'alert', %s, %s)
            """, (actor, f"alert.{status_val}", id, json.dumps({})))
            
            updated["id"] = str(updated["id"])
            updated["merchant_id"] = str(updated["merchant_id"])
            updated["anomaly_score_id"] = str(updated["anomaly_score_id"])
            if updated.get("created_at"): updated["created_at"] = updated["created_at"].isoformat()
            if updated.get("resolved_at"): updated["resolved_at"] = updated["resolved_at"].isoformat()
            return updated