import os
import sys
import asyncio
from datetime import date, datetime, timedelta, timezone
from typing import Optional

import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from jwt_verify import verify_token

JWT_SECRET = os.environ.get("JWT_SECRET", "")
if not JWT_SECRET:
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL", "")
if not DATABASE_URL:
    sys.exit(1)

def get_conn():
    return psycopg2.connect(DATABASE_URL)

app = FastAPI(title="feature-svc")
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    claims = verify_token(credentials.credentials, JWT_SECRET)
    if not claims:
        raise HTTPException(status_code=401, detail="Token is missing, invalid, or expired")
    return claims


def compute_features_for_day(merchant_id: str, target_day: date, conn) -> dict:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute("""
            SELECT 
                COUNT(*) as txn_count,
                SUM(amount) FILTER (WHERE status = 'success') as txn_volume,
                AVG(amount) FILTER (WHERE status = 'success') as avg_ticket_size,
                STDDEV_SAMP(amount) FILTER (WHERE status = 'success') as ticket_size_stddev,
                COUNT(*) FILTER (WHERE status = 'refunded') as count_refunded,
                COUNT(*) FILTER (WHERE status = 'chargeback') as count_chargeback,
                COUNT(*) FILTER (WHERE status = 'success') as count_success,
                COUNT(*) FILTER (WHERE status = 'failed') as count_failed,
                COUNT(DISTINCT customer_id) as unique_customers
            FROM transactions
            WHERE merchant_id = %s AND date(ts) = %s
        """, (merchant_id, target_day))
        day_stats = cur.fetchone()

        txn_count = day_stats["txn_count"] or 0
        txn_volume = float(day_stats["txn_volume"] or 0.0)
        avg_ticket_size = float(day_stats["avg_ticket_size"]) if day_stats["avg_ticket_size"] is not None else None
        ticket_size_stddev = float(day_stats["ticket_size_stddev"]) if day_stats["ticket_size_stddev"] is not None else None
        
        c_succ = day_stats["count_success"] or 0
        refund_ratio = float(day_stats["count_refunded"] or 0) / c_succ if c_succ > 0 else None
        chargeback_ratio = float(day_stats["count_chargeback"] or 0) / c_succ if c_succ > 0 else None
        failed_txn_ratio = float(day_stats["count_failed"] or 0) / txn_count if txn_count > 0 else None
        unique_customers = day_stats["unique_customers"] or 0

        cur.execute("""
            WITH today_custs AS (
                SELECT customer_id, SUM(amount) FILTER (WHERE status='success') as vol
                FROM transactions 
                WHERE merchant_id = %(m)s AND date(ts) = %(d)s
                GROUP BY customer_id
            ),
            past_custs AS (
                SELECT DISTINCT customer_id
                FROM transactions
                WHERE merchant_id = %(m)s AND date(ts) < %(d)s
            )
            SELECT 
                (SELECT COUNT(*) FROM today_custs WHERE customer_id IN (SELECT customer_id FROM past_custs)) as repeat_customer_count,
                (SELECT SUM(vol) FROM today_custs WHERE customer_id NOT IN (SELECT customer_id FROM past_custs)) as new_customer_volume
        """, {"m": merchant_id, "d": target_day})
        cust_stats = cur.fetchone()
        
        rep_c = cust_stats["repeat_customer_count"] or 0
        repeat_customer_rate = float(rep_c) / unique_customers if unique_customers > 0 else None
        
        ncv = cust_stats["new_customer_volume"]
        new_customer_conc = float(ncv) / txn_volume if (txn_volume > 0 and ncv is not None) else None

        cur.execute("""
            SELECT date(ts) as d, COUNT(*) as cnt
            FROM transactions
            WHERE merchant_id = %(m)s AND date(ts) > %(d)s - INTERVAL '14 days' AND date(ts) <= %(d)s
            GROUP BY date(ts)
        """, {"m": merchant_id, "d": target_day})
        daily_counts = {r['d']: r['cnt'] for r in cur.fetchall()}
        
        curr_7d = sum(daily_counts.get(target_day - timedelta(days=i), 0) for i in range(7))
        prior_7d = sum(daily_counts.get(target_day - timedelta(days=i), 0) for i in range(7, 14))
        
        velocity_7d_avg = curr_7d / 7.0
        
        cur.execute("""
            SELECT COUNT(DISTINCT date(ts)) as days_of_history, MIN(date(ts)) as first_day
            FROM transactions
            WHERE merchant_id = %s AND date(ts) <= %s
        """, (merchant_id, target_day))
        hist = cur.fetchone()
        days_of_history = hist["days_of_history"] or 0
        first_day = hist["first_day"]
        
        if first_day and (target_day - first_day).days >= 13:
            if prior_7d > 0:
                velocity_7d_change_pct = ((curr_7d - prior_7d) / prior_7d) * 100.0
            else:
                velocity_7d_change_pct = None
        else:
            velocity_7d_change_pct = None

        return {
            "merchant_id": merchant_id,
            "day": target_day,
            "txn_count": txn_count,
            "txn_volume": txn_volume,
            "avg_ticket_size": avg_ticket_size,
            "ticket_size_stddev": ticket_size_stddev,
            "refund_ratio": refund_ratio,
            "chargeback_ratio": chargeback_ratio,
            "unique_customers": unique_customers,
            "repeat_customer_rate": repeat_customer_rate,
            "failed_txn_ratio": failed_txn_ratio,
            "velocity_7d_avg": velocity_7d_avg,
            "velocity_7d_change_pct": velocity_7d_change_pct,
            "new_customer_conc": new_customer_conc,
            "days_of_history": days_of_history
        }


def sync_features():
    with get_conn() as conn:
        conn.autocommit = True
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                WITH t_counts AS (
                    SELECT merchant_id, date(ts) as day, COUNT(*) as tx_count
                    FROM transactions
                    GROUP BY merchant_id, date(ts)
                )
                SELECT t.merchant_id, t.day, t.tx_count, f.txn_count as f_tx_count
                FROM t_counts t
                LEFT JOIN features_daily f ON f.merchant_id = t.merchant_id AND f.day = t.day
                WHERE f.id IS NULL OR f.txn_count != t.tx_count
                ORDER BY t.merchant_id, t.day ASC
            """)
            tasks = cur.fetchall()
            
            for t in tasks:
                f = compute_features_for_day(t['merchant_id'], t['day'], conn)
                
                cur.execute("""
                    INSERT INTO features_daily (
                        merchant_id, day, txn_count, txn_volume, avg_ticket_size, ticket_size_stddev,
                        refund_ratio, chargeback_ratio, unique_customers, repeat_customer_rate,
                        failed_txn_ratio, velocity_7d_avg, velocity_7d_change_pct, new_customer_conc,
                        days_of_history
                    ) VALUES (
                        %(merchant_id)s, %(day)s, %(txn_count)s, %(txn_volume)s, %(avg_ticket_size)s, %(ticket_size_stddev)s,
                        %(refund_ratio)s, %(chargeback_ratio)s, %(unique_customers)s, %(repeat_customer_rate)s,
                        %(failed_txn_ratio)s, %(velocity_7d_avg)s, %(velocity_7d_change_pct)s, %(new_customer_conc)s,
                        %(days_of_history)s
                    )
                    ON CONFLICT (merchant_id, day) DO UPDATE SET
                        txn_count = EXCLUDED.txn_count,
                        txn_volume = EXCLUDED.txn_volume,
                        avg_ticket_size = EXCLUDED.avg_ticket_size,
                        ticket_size_stddev = EXCLUDED.ticket_size_stddev,
                        refund_ratio = EXCLUDED.refund_ratio,
                        chargeback_ratio = EXCLUDED.chargeback_ratio,
                        unique_customers = EXCLUDED.unique_customers,
                        repeat_customer_rate = EXCLUDED.repeat_customer_rate,
                        failed_txn_ratio = EXCLUDED.failed_txn_ratio,
                        velocity_7d_avg = EXCLUDED.velocity_7d_avg,
                        velocity_7d_change_pct = EXCLUDED.velocity_7d_change_pct,
                        new_customer_conc = EXCLUDED.new_customer_conc,
                        days_of_history = EXCLUDED.days_of_history;
                """, f)


async def feature_polling_loop():
    while True:
        try:
            await asyncio.to_thread(sync_features)
        except Exception as e:
            print(f"Error in polling loop: {e}", file=sys.stderr)
        await asyncio.sleep(5)


@app.on_event("startup")
async def startup_event():
    asyncio.create_task(feature_polling_loop())


@app.get("/health")
async def health():
    return {"status": "ok", "service": "feature-svc"}


@app.get("/merchants/{id}/features")
async def get_merchant_features(id: str, range: str = "30d", user: dict = Depends(get_current_user)):
    role = user.get("role")
    if role == "merchant" and str(user.get("merchant_id")) != id:
        raise HTTPException(status_code=403, detail="Access denied")
        
    days_back = 30
    if range.endswith('d') and range[:-1].isdigit():
        days_back = int(range[:-1])

    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT * FROM (
                    SELECT * FROM features_daily
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
