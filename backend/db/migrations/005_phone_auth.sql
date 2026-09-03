-- Migration 005: Replace email auth with phone number auth
-- Add phone_number and phone_verified; keep email as optional legacy column for now.

-- 1. Add phone_number column (nullable during migration)
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false;

-- 2. Copy email to phone_number for any existing rows (they won't have a real phone, just placeholder)
--    In production you'd collect real phone numbers; for dev we leave existing rows as-is.

-- 3. Make phone_number unique (only after data migration if needed)
-- We do a partial unique index so NULL values don't conflict
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_number_key 
  ON users (phone_number) 
  WHERE phone_number IS NOT NULL;

-- 4. Make email nullable — phone-auth flow doesn't collect email
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;

-- 5. Update audit_log references (just metadata JSON, no schema change needed)
