-- MERCHANTS -------------------------------------------------------------
CREATE TABLE merchants (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT NOT NULL,
    category            TEXT,              -- e.g. 'ecommerce','food','saas','retail'
    persona             TEXT,              -- 'healthy'|'declining'|'viral_growth'|'fraud_ring'|'seasonal'|'real_upload'
    onboarded_at        TIMESTAMPTZ DEFAULT now(),
    baseline_daily_txn  NUMERIC,           -- learned baseline, updated by feature-svc
    baseline_ticket_size NUMERIC,
    is_synthetic        BOOLEAN DEFAULT true
);

-- USERS / AUTH ---------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('merchant','analyst','admin')),
    merchant_id     UUID REFERENCES merchants(id), -- null for analyst/admin
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- RAW TRANSACTIONS --------------------------------------------------------
CREATE TABLE transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id     UUID REFERENCES merchants(id) NOT NULL,
    ts              TIMESTAMPTZ NOT NULL,
    amount          NUMERIC NOT NULL,
    currency        TEXT DEFAULT 'INR',
    status          TEXT NOT NULL CHECK (status IN ('success','failed','refunded','chargeback')),
    payment_method  TEXT,             -- card/upi/netbanking/wallet
    customer_id     TEXT,             -- pseudonymous id, used for repeat-rate calc
    is_refund       BOOLEAN DEFAULT false,
    source          TEXT DEFAULT 'simulator'  -- 'simulator' | 'upload'
);
CREATE INDEX idx_txn_merchant_ts ON transactions (merchant_id, ts DESC);

-- If you have time, convert this to a TimescaleDB hypertable on ts -- free win for time-series queries.

-- DAILY FEATURE ROLLUPS ----------------------------------------------------
CREATE TABLE features_daily (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id             UUID REFERENCES merchants(id) NOT NULL,
    day                     DATE NOT NULL,
    txn_count               INT,
    txn_volume              NUMERIC,
    avg_ticket_size         NUMERIC,
    ticket_size_stddev      NUMERIC,
    refund_ratio            NUMERIC,       -- refunds / successful txns
    chargeback_ratio        NUMERIC,
    unique_customers        INT,
    repeat_customer_rate    NUMERIC,       -- returning / total customers
    failed_txn_ratio        NUMERIC,
    velocity_7d_avg         NUMERIC,       -- rolling 7-day mean daily txn_count
    velocity_7d_change_pct  NUMERIC,       -- % change vs prior 7d window
    new_customer_conc       NUMERIC,       -- % of volume from customers first seen <48h ago (fraud signal)
    UNIQUE(merchant_id, day)
);

-- ANOMALY SCORES -------------------------------------------------------
CREATE TABLE anomaly_scores (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id         UUID REFERENCES merchants(id) NOT NULL,
    day                 DATE NOT NULL,
    classification      TEXT CHECK (classification IN
                          ('normal','distress','breakout','fraud_pattern','seasonal_dip','insufficient_data')),
    severity            NUMERIC,      -- 0.0-1.0
    contributing_features JSONB,      -- {"velocity_7d_change_pct": -40, "refund_ratio_change": 3.0, ...}
    model_version        TEXT,
    created_at            TIMESTAMPTZ DEFAULT now()
);

-- ALERTS / RECOMMENDED ACTIONS ------------------------------------------
CREATE TABLE alerts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id       UUID REFERENCES merchants(id) NOT NULL,
    anomaly_score_id  UUID REFERENCES anomaly_scores(id) NOT NULL,
    recommended_action TEXT CHECK (recommended_action IN
                          ('capital_outreach','risk_review','growth_upsell','no_action')),
    explanation_text  TEXT,           -- LLM-generated, plain English, cited
    status            TEXT DEFAULT 'open' CHECK (status IN ('open','acknowledged','dismissed','actioned')),
    created_at        TIMESTAMPTZ DEFAULT now(),
    resolved_at       TIMESTAMPTZ
);

-- AUDIT TRAIL (mandatory for the "bounded and gated" judging bar) -------
CREATE TABLE audit_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor         TEXT,            -- 'system:anomaly-svc' | user id
    action        TEXT,            -- 'alert.created','alert.dismissed','data.uploaded', etc
    entity_type   TEXT,
    entity_id     UUID,
    metadata      JSONB,
    created_at    TIMESTAMPTZ DEFAULT now()
);