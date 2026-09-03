-- Add idempotency index to prevent duplicate transaction ingestion
CREATE UNIQUE INDEX idx_txn_idempotency ON transactions (merchant_id, ts, amount, customer_id, status);