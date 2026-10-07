-- =============================================================================
-- Migration 006 – Switch from phone_verified to email_verified
-- Apply with:  psql "$DATABASE_URL" -f 006_email_auth.sql
-- =============================================================================

-- 1. Ensure email_verified column exists (it was added in 004_auth_security.sql
--    as a general "verified" flag; here we confirm and set correct defaults)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

-- 2. Backfill: users who had phone_verified=true should keep access
--    (migrate their verification status to email_verified)
UPDATE users
SET email_verified = true
WHERE phone_verified = true AND email_verified = false;

-- 3. Ensure email column is present and has a partial unique index
--    (email was the original PK field before phone_auth migration made it nullable)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;

-- Re-create unique index on email where not null
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_key
    ON users (email)
    WHERE email IS NOT NULL;

-- 4. phone_number is now optional profile info only — drop unique constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_number_key;
DROP INDEX IF EXISTS users_phone_number_key;

-- 5. No otp_codes table changes needed — OTPs are now stored in Redis only,
--    not in the DB. The existing otp_codes table can be left or cleaned up later.
--    We do NOT drop it in case there are in-flight sessions during deploy.
