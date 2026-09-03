import os
import sys
import json
from datetime import date, datetime, timezone
from typing import Optional

import pandas as pd
import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from jwt_verify import verify_token
import statistical
import ml_layer
import classifier

JWT_SECRET = os.environ.get("JWT_SECRET", "")
if not JWT_SECRET:
    print("FATAL: JWT_SECRET environment variable is not set.", file=sys.stderr)
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    print("FATAL: DATABASE_URL environment variable is not set.", file=sys.stderr)
    sys.exit(1)

def get_conn():
    return psycopg2.connect(DATABASE_URL)

app = FastAPI(title="anomaly-svc")
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    claims = verify_token(credentials.credentials, JWT_SECRET)
    if not claims:
        raise HTTPException(status_code=401, detail="Token is missing, invalid, or expired")
    return claims

@app.get("/health")
async def health():
    return {"status": "ok", "service": "anomaly-svc"}

@app.get("/merchants/{id}/detect")
async def get_detection(id: str, day: Optional[str] = None, user: dict = Depends(get_current_user)):
    role = user.get("role")
    if role == "merchant" and str(user.get("merchant_id")) != id:
        raise HTTPException(status_code=403, detail="Access denied")

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if day:
                try:
                    target_date = datetime.strptime(day, "%Y-%m-%d").date()
                except ValueError:
                    raise HTTPException(status_code=422, detail="Invalid date format, use YYYY-MM-DD")
                
                cur.execute("""
                    SELECT * FROM features_daily
                    WHERE merchant_id = %s AND day <= %s
                    ORDER BY day ASC
                """, (id, target_date))
                rows = cur.fetchall()
                if not rows or rows[-1]["day"] != target_date:
                    raise HTTPException(status_code=404, detail="No features_daily row for this merchant on requested day")
            else:
                cur.execute("""
                    SELECT * FROM features_daily
                    WHERE merchant_id = %s
                    ORDER BY day ASC
                """, (id,))
                rows = cur.fetchall()
                if not rows:
                    raise HTTPException(status_code=404, detail="No features_daily rows found for this merchant")
                target_date = rows[-1]["day"]

    df = pd.DataFrame([dict(r) for r in rows])
    for col in df.columns:
        if col not in ['id', 'merchant_id', 'day']:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    recent_days = df['day'].tail(3).tolist()
    zscores_history = []
    
    for d in recent_days:
        zs = statistical.compute_zscores(df, d)
        zscores_history.append(zs)
        
    sustained_flags = statistical.compute_sustained_flags(zscores_history, len(zscores_history) - 1)
    cusum = statistical.compute_cusum(df, target_date)
    target_zscores = zscores_history[-1]
    
    return {
        "merchant_id": id,
        "day": target_date.isoformat(),
        "zscores": target_zscores,
        "sustained_flags": sustained_flags,
        "cusum": cusum,
        "days_of_history": rows[-1].get("days_of_history")
    }

def _score_day(cur, merchant_id, history_rows, target_date):
    df = pd.DataFrame([dict(r) for r in history_rows])
    for col in df.columns:
        if col not in ['id', 'merchant_id', 'day']:
            df[col] = pd.to_numeric(df[col], errors='coerce')
    
    recent_days = df['day'].tail(3).tolist()
    zscores_history = []
    for d in recent_days:
        zs = statistical.compute_zscores(df, d)
        zscores_history.append(zs)
        
    sustained_flags = statistical.compute_sustained_flags(zscores_history, len(zscores_history) - 1)
    cusum = statistical.compute_cusum(df, target_date)
    target_zscores = zscores_history[-1]
    days_of_history = history_rows[-1].get("days_of_history", 0)

    ml_score = ml_layer.compute_ml_anomaly_score(df, target_date)
    c_result = classifier.classify(target_zscores, sustained_flags, cusum, ml_score, days_of_history, target_date)

    contributing_features = {
        "zscores": target_zscores,
        "cusum": cusum,
        "ml_score": ml_score,
        "reasoning": c_result["reasoning"]
    }

    cur.execute("SELECT id FROM anomaly_scores WHERE merchant_id = %s AND day = %s", (merchant_id, target_date))
    existing = cur.fetchone()
    if existing:
        cur.execute("""
            UPDATE anomaly_scores SET
                classification = %s,
                severity = %s,
                contributing_features = %s,
                model_version = %s
            WHERE id = %s
            RETURNING *
        """, (c_result["classification"], c_result["severity"], json.dumps(contributing_features), "v1-layered", existing["id"]))
    else:
        cur.execute("""
            INSERT INTO anomaly_scores (
                merchant_id, day, classification, severity, contributing_features, model_version
            ) VALUES (
                %s, %s, %s, %s, %s, %s
            )
            RETURNING *
        """, (merchant_id, target_date, c_result["classification"], c_result["severity"], json.dumps(contributing_features), "v1-layered"))
    return dict(cur.fetchone())

@app.post("/merchants/{id}/analyze")
async def analyze_merchant(id: str, day: Optional[str] = None, user: dict = Depends(get_current_user)):
    role = user.get("role")
    if role == "merchant" and str(user.get("merchant_id")) != id:
        raise HTTPException(status_code=403, detail="Access denied")

    with get_conn() as conn:
        conn.autocommit = True
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if day:
                try:
                    target_date = datetime.strptime(day, "%Y-%m-%d").date()
                except ValueError:
                    raise HTTPException(status_code=422, detail="Invalid date format, use YYYY-MM-DD")
                
                cur.execute("""
                    SELECT * FROM features_daily
                    WHERE merchant_id = %s AND day <= %s
                    ORDER BY day ASC
                """, (id, target_date))
                rows = cur.fetchall()
                if not rows or rows[-1]["day"] != target_date:
                    raise HTTPException(status_code=404, detail="No features_daily row for this merchant on requested day")

                final_row = _score_day(cur, id, rows, target_date)
                final_row["id"] = str(final_row["id"])
                final_row["merchant_id"] = str(final_row["merchant_id"])
                final_row["day"] = final_row["day"].isoformat()
                return final_row
            else:
                cur.execute("""
                    SELECT * FROM features_daily
                    WHERE merchant_id = %s
                    ORDER BY day ASC
                """, (id,))
                all_rows = cur.fetchall()
                if not all_rows:
                    raise HTTPException(status_code=404, detail="No features_daily rows found for this merchant")

                cur.execute("SELECT day FROM anomaly_scores WHERE merchant_id = %s", (id,))
                already_scored = {r["day"] for r in cur.fetchall()}

                days_to_score = [r["day"] for r in all_rows if r["day"] not in already_scored]

                scored = 0
                classifications = {}
                for target_date in days_to_score:
                    history_rows = [r for r in all_rows if r["day"] <= target_date]
                    result = _score_day(cur, id, history_rows, target_date)
                    cls = result["classification"]
                    classifications[cls] = classifications.get(cls, 0) + 1
                    scored += 1

                return {
                    "merchant_id": id,
                    "days_scored": scored,
                    "days_skipped_already_scored": len(already_scored),
                    "classifications": classifications
                }

@app.get("/merchants/{id}/anomalies")
async def get_anomalies(id: str, range: str = "30d", user: dict = Depends(get_current_user)):
    role = user.get("role")
    if role == "merchant" and str(user.get("merchant_id")) != id:
        raise HTTPException(status_code=403, detail="Access denied")

    days_back = 30
    if range.endswith('d') and range[:-1].isdigit():
        days_back = min(int(range[:-1]), 365)  # cap at 1 year to prevent full-table scan

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM (
                    SELECT * FROM anomaly_scores
                    WHERE merchant_id = %s
                    ORDER BY day DESC
                    LIMIT %s
                ) sub
                ORDER BY day ASC
            """, (id, days_back))
            rows = cur.fetchall()
            
    for row in rows:
        row["id"] = str(row["id"])
        row["merchant_id"] = str(row["merchant_id"])
        row["day"] = row["day"].isoformat()
    return rows