-- =============================================================================
-- Migration 004 – Auth-svc security hardening
-- Apply with:  psql "$DATABASE_URL" -f 004_auth_security.sql
-- =============================================================================

-- Add "name" column to users (nullable so existing rows aren't broken)
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;

-- Add email_verified flag (defaults false, so all existing accounts need re-verification
-- ONLY if you want to enforce it; comment the DEFAULT out if you want existing users kept active)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

-- Backfill: treat existing, already-working accounts as verified so login still works.
UPDATE users SET email_verified = true WHERE email_verified = false;

-- OTP codes table
CREATE TABLE IF NOT EXISTS otp_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id) NOT NULL,
    code        TEXT NOT NULL,
    purpose     TEXT NOT NULL CHECK (purpose IN ('login','signup','password_reset')),
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN DEFAULT false,
    wrong_guesses INT NOT NULL DEFAULT 0,   -- invalidate after 5 bad attempts
    created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_otp_user_purpose
    ON otp_codes (user_id, purpose, created_at DESC);
