"""
auth-svc — Authentication & Authorisation microservice
Port: 8001

Endpoints:
  POST /auth/signup               – step 1: create unverified account, send OTP to phone
  POST /auth/signup/verify-otp    – step 2: verify OTP, mark phone_verified=true
  POST /auth/signup/resend-otp    – resend fresh signup OTP for unverified account
  POST /auth/login                – step 1: check creds, send login OTP to phone
  POST /auth/login/verify-otp     – step 2: verify OTP, issue JWT
  POST /auth/forgot-password      – send password-reset OTP to phone
  POST /auth/reset-password       – verify OTP, set new password
  GET  /auth/me                   – introspect JWT
  GET  /health
"""

# ---------------------------------------------------------------------------
# Standard-library imports
# ---------------------------------------------------------------------------
import json
import logging
import os
import re
import secrets
import sys
from datetime import datetime, timedelta, timezone
from typing import Optional
from contextlib import contextmanager

# ---------------------------------------------------------------------------
# Third-party imports
# ---------------------------------------------------------------------------
import bcrypt
import psycopg2
import psycopg2.extras
from psycopg2.pool import ThreadedConnectionPool as _ThreadedConnectionPool
from fastapi import FastAPI, HTTPException, Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware
from jose import JWTError, jwt
from pydantic import BaseModel, field_validator

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, stream=sys.stdout)
log = logging.getLogger("auth-svc")

# ---------------------------------------------------------------------------
# Startup guard — fail loudly if required secrets are missing
# ---------------------------------------------------------------------------
JWT_SECRET = os.environ.get("JWT_SECRET", "")
if not JWT_SECRET:
    print(
        "FATAL: JWT_SECRET environment variable is not set. "
        "auth-svc refuses to start without it.",
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

ALGORITHM = "HS256"
JWT_TTL_HOURS = 24
OTP_TTL_SECONDS = 120           # 2 minutes for SMS OTP
OTP_MAX_WRONG_GUESSES = 5       # OTP is invalidated after this many bad attempts
OTP_RATE_LIMIT_MAX = 3          # max OTP sends per phone per window
OTP_RATE_LIMIT_WINDOW_SECONDS = 600  # 10 minutes
DEV_MODE = os.environ.get("DEV_MODE", "false").lower() == "true"  # Set to true ONLY in local dev; NEVER in production

# Twilio credentials (optional — falls back to console logging if not set)
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM_NUMBER = os.environ.get("TWILIO_FROM_NUMBER", "+917307379811")
# Twilio Verify Service SID (starts with VA). When set, Verify API is used instead
# of raw messages.create() — Verify handles code generation, delivery, and check.
TWILIO_VERIFY_SERVICE_SID = os.environ.get("TWILIO_VERIFY_SERVICE_SID", "")

# Redis URL
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# ---------------------------------------------------------------------------
# Redis client — graceful fallback to in-memory if Redis unavailable
# ---------------------------------------------------------------------------
_redis_client = None
_otp_send_log: dict[str, list[float]] = {}  # fallback in-memory store


def _get_redis():
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        import redis
        client = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        client.ping()
        _redis_client = client
        log.info("Redis connected at %s", REDIS_URL)
    except Exception as exc:
        log.warning("Redis unavailable (%s) — using in-memory rate-limit store.", exc)
        _redis_client = None
    return _redis_client


# ---------------------------------------------------------------------------
# Password helpers — bcrypt
# ---------------------------------------------------------------------------

def hash_password(plaintext: str) -> str:
    return bcrypt.hashpw(plaintext.encode(), bcrypt.gensalt()).decode()


def verify_password(plaintext: str, hashed: str) -> bool:
    return bcrypt.checkpw(plaintext.encode(), hashed.encode())


# ---------------------------------------------------------------------------
# Password complexity
# ---------------------------------------------------------------------------
_SPECIAL_CHARS = r"""!"#$%&'()*+,-./:;<=>?@[\]^_`{|}~"""


def check_password_complexity(password: str) -> Optional[str]:
    """Return a human-readable error string if the password fails any rule, else None."""
    if len(password) < 8:
        return "Password must be at least 8 characters long"
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter"
    if not re.search(r"[a-z]", password):
        return "Password must contain at least one lowercase letter"
    if not re.search(r"\d", password):
        return "Password must contain at least one digit"
    if not re.search(r"""[!"#$%&'()*+,\-./:;<=>?@\[\\\]^_`{|}~]""", password):
        return "Password must contain at least one special character (!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~)"
    return None


# ---------------------------------------------------------------------------
# Phone number helpers
# ---------------------------------------------------------------------------

def normalise_phone(phone: str) -> str:
    """
    Strip all non-digit characters except leading '+'.
    E.g. '+91 98765-43210' → '+919876543210'
    """
    phone = phone.strip()
    if phone.startswith("+"):
        return "+" + re.sub(r"\D", "", phone[1:])
    return "+" + re.sub(r"\D", "", phone)


def is_valid_phone(phone: str) -> bool:
    """Basic E.164 validation: starts with +, 7–15 digits."""
    return bool(re.match(r"^\+[1-9]\d{6,14}$", phone))


# ---------------------------------------------------------------------------
# DB connection pool
# ---------------------------------------------------------------------------

_db_pool: Optional[_ThreadedConnectionPool] = None


def _get_db_pool() -> _ThreadedConnectionPool:
    global _db_pool
    if _db_pool is None:
        _db_pool = _ThreadedConnectionPool(minconn=1, maxconn=10, dsn=DATABASE_URL)
    return _db_pool


@contextmanager
def get_conn():
    """Yield a pooled DB connection; commits on success, rolls back on error."""
    pool = _get_db_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def db_execute(sql: str, params=(), fetch: str = "none"):
    """
    fetch: "one" | "all" | "none"
    Commits on write, returns rows on read.
    """
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            if fetch == "one":
                return cur.fetchone()
            if fetch == "all":
                return cur.fetchall()
            return None


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_token(payload: dict) -> str:
    data = payload.copy()
    data["exp"] = datetime.now(timezone.utc) + timedelta(hours=JWT_TTL_HOURS)
    return jwt.encode(data, JWT_SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        claims = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
    except JWTError:
        return None
    # Check token revocation list in Redis (populated by /auth/logout)
    r = _get_redis()
    if r:
        try:
            if r.exists(f"revoked_token:{token}"):
                return None
        except Exception as exc:
            log.warning("Redis revocation check failed (failing open): %s", exc)
    return claims


def extract_bearer(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[len("Bearer "):]
    return None


# ---------------------------------------------------------------------------
# OTP helpers
# ---------------------------------------------------------------------------

def _generate_otp_code() -> str:
    """
    6-digit numeric OTP using the cryptographically secure secrets module.
    """
    return str(secrets.randbelow(1_000_000)).zfill(6)


def _check_otp_send_rate_limit(phone: str) -> bool:
    """
    Rate-limit OTP sends per phone number.
    Uses Redis if available, falls back to in-memory dict.
    Returns True if the caller may send an OTP.
    """
    r = _get_redis()
    if r:
        # Redis-backed rate limiting with TTL sliding window
        key = f"otp_rate:{phone}"
        try:
            now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
            window_start_ms = now_ms - (OTP_RATE_LIMIT_WINDOW_SECONDS * 1000)
            pipe = r.pipeline()
            pipe.zremrangebyscore(key, "-inf", window_start_ms)
            pipe.zcard(key)
            pipe.zadd(key, {str(now_ms): now_ms})
            pipe.expire(key, OTP_RATE_LIMIT_WINDOW_SECONDS)
            results = pipe.execute()
            current_count = results[1]  # count BEFORE adding new entry
            if current_count >= OTP_RATE_LIMIT_MAX:
                # Rollback the zadd by removing the just-added entry
                r.zrem(key, str(now_ms))
                return False
            return True
        except Exception as exc:
            log.warning("Redis rate-limit check failed (%s), allowing request.", exc)
            return True
    else:
        # In-memory fallback
        now = datetime.now(timezone.utc).timestamp()
        window_start = now - OTP_RATE_LIMIT_WINDOW_SECONDS
        history = _otp_send_log.get(phone, [])
        history = [ts for ts in history if ts > window_start]
        _otp_send_log[phone] = history
        if len(history) >= OTP_RATE_LIMIT_MAX:
            return False
        history.append(now)
        _otp_send_log[phone] = history
        return True


def _get_twilio_client():
    """Return a Twilio REST client if credentials are configured, else None."""
    if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
        try:
            from twilio.rest import Client
            return Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        except Exception as exc:
            log.error("Failed to initialise Twilio client: %s", exc)
    return None


def send_otp_sms(to_phone: str, otp_code: str, purpose: str) -> None:
    """
    Send the OTP via SMS.
    - If TWILIO_VERIFY_SERVICE_SID is set: delegates entirely to Twilio Verify
      (Verify generates and sends the code; otp_code arg is unused in that path).
    - If only TWILIO_ACCOUNT_SID/AUTH_TOKEN are set: uses legacy messages.create().
    - Falls back to console logging in dev when no Twilio is configured.
    """
    # ── Twilio Verify path (preferred) ───────────────────────────────────────
    if TWILIO_VERIFY_SERVICE_SID:
        client = _get_twilio_client()
        if client:
            try:
                verification = client.verify.v2 \
                    .services(TWILIO_VERIFY_SERVICE_SID) \
                    .verifications \
                    .create(to=to_phone, channel="sms")
                log.info(
                    "Twilio Verify OTP sent to %s (sid=%s, status=%s, purpose=%s)",
                    to_phone, verification.sid, verification.status, purpose,
                )
                return
            except Exception as exc:
                log.error("Twilio Verify send failed for %s: %s", to_phone, exc)
                # Do not fall through to legacy path — raise so caller can 502
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to send verification code. Please try again.",
                )
        # Client could not be constructed — fall through to console fallback

    # ── Legacy messages.create() path (kept for backward compat) ────────────
    elif TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
        purpose_map = {
            "login": "login",
            "signup": "account verification",
            "password_reset": "password reset",
        }
        purpose_label = purpose_map.get(purpose, "verification")
        body = (
            f"[Pulse] Your {purpose_label} code is: {otp_code}. "
            f"Valid for {OTP_TTL_SECONDS // 60} min. Do not share."
        )
        client = _get_twilio_client()
        if client:
            try:
                msg = client.messages.create(
                    body=body,
                    from_=TWILIO_FROM_NUMBER,
                    to=to_phone,
                )
                log.info("SMS sent to %s (sid=%s, purpose=%s)", to_phone, msg.sid, purpose)
                return
            except Exception as exc:
                log.error("Twilio SMS failed for %s: %s", to_phone, exc)
                log.warning("[DEV-ONLY FALLBACK] OTP for %s (purpose=%s): %s", to_phone, purpose, otp_code)
                return

    # ── No Twilio configured — DEV-ONLY console fallback ────────────────────
    log.warning(
        "========== [DEV-ONLY — CONFIGURE TWILIO FOR REAL SMS] ==========\n"
        "SMS OTP for %s (purpose=%s): %s\n"
        "=================================================================",
        to_phone, purpose, otp_code,
    )


def verify_otp_via_twilio(phone: str, code: str) -> bool:
    """
    Check an OTP code against Twilio Verify.
    Returns True if Twilio confirms status == 'approved'.
    Raises HTTPException for all failure conditions (invalid code, expired,
    max attempts, Twilio error) so callers need no extra logic.
    Only called when TWILIO_VERIFY_SERVICE_SID is configured.
    """
    client = _get_twilio_client()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Verification service is temporarily unavailable.",
        )
    try:
        check = client.verify.v2 \
            .services(TWILIO_VERIFY_SERVICE_SID) \
            .verification_checks \
            .create(to=phone, code=code)
    except Exception as exc:
        error_str = str(exc)
        # Twilio Verify surfaces specific error codes in the exception message.
        # 60202 = max check attempts reached; 60203 = expired; 60200 = invalid param
        if "60202" in error_str:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Too many incorrect OTP attempts. Please request a new code.",
            )
        if "60203" in error_str or "not found" in error_str.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This OTP has expired or does not exist. Please request a new one.",
            )
        log.error("Twilio Verify check failed for %s: %s", phone, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Verification service error. Please try again.",
        )

    if check.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect OTP. Please check the code and try again.",
        )
    return True


def create_and_send_otp(user_id: str, phone: str, purpose: str) -> str:
    """
    Send an OTP for the given purpose.

    - When TWILIO_VERIFY_SERVICE_SID is set: Twilio Verify generates and sends
      the code. No code is stored locally; an empty string is returned so that
      callers (and DEV_MODE) don't expose a Verify-managed code.
    - Otherwise: generates a local code, stores it in otp_codes, and sends via
      SMS (or logs to console in dev). Returns the code for DEV_MODE display.
    """
    if TWILIO_VERIFY_SERVICE_SID:
        # Twilio Verify owns the code — do not generate or store locally
        send_otp_sms(phone, "", purpose)  # otp_code arg unused in Verify path
        return ""  # empty: never expose a Verify-managed code in responses

    # Fallback: local generation + DB storage + legacy SMS / console log
    code = _generate_otp_code()
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=OTP_TTL_SECONDS)
    db_execute(
        """
        INSERT INTO otp_codes (user_id, code, purpose, expires_at)
        VALUES (%s, %s, %s, %s)
        """,
        (user_id, code, purpose, expires_at),
    )
    send_otp_sms(phone, code, purpose)
    return code


def validate_otp(user_id: str, code: str, purpose: str) -> dict:
    """
    Validate an OTP. Returns the otp_codes row if valid.
    Raises HTTPException with a clear message if invalid, expired, used, or
    invalidated (too many wrong guesses).
    """
    now = datetime.now(timezone.utc)

    otp_row = db_execute(
        """
        SELECT id, code, expires_at, used, wrong_guesses
        FROM otp_codes
        WHERE user_id = %s AND purpose = %s AND used = false
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (user_id, purpose),
        fetch="one",
    )

    if not otp_row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active OTP found for this account. Please request a new one.",
        )

    # Check invalidated by too many wrong guesses
    if otp_row["wrong_guesses"] >= OTP_MAX_WRONG_GUESSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This OTP has been invalidated due to too many incorrect attempts. Please request a new one.",
        )

    # Check expiry
    expires_at = otp_row["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if now > expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This OTP has expired. Please request a new one.",
        )

    # Check code match
    if otp_row["code"] != code:
        new_wrong = otp_row["wrong_guesses"] + 1
        db_execute(
            "UPDATE otp_codes SET wrong_guesses = %s WHERE id = %s",
            (new_wrong, otp_row["id"]),
        )
        remaining = OTP_MAX_WRONG_GUESSES - new_wrong
        if remaining <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Incorrect OTP. This code has now been invalidated due to too many wrong attempts. Please request a new one.",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Incorrect OTP. {remaining} attempt(s) remaining before this code is invalidated.",
        )

    # Mark as used
    db_execute(
        "UPDATE otp_codes SET used = true WHERE id = %s",
        (otp_row["id"],),
    )
    return otp_row


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class BasePhoneRequest(BaseModel):
    phone_number: str

    @field_validator("phone_number", mode="before")
    @classmethod
    def normalise_phone_field(cls, v: str) -> str:
        if not isinstance(v, str):
            raise ValueError("phone_number must be a string")
        normalised = normalise_phone(v)
        if not is_valid_phone(normalised):
            raise ValueError(
                "Invalid phone number. Please use E.164 format e.g. +919876543210"
            )
        return normalised


class SignupRequest(BasePhoneRequest):
    password: str
    confirm_password: str
    name: str
    role: str
    merchant_name: Optional[str] = None


class SignupVerifyOtpRequest(BasePhoneRequest):
    otp: str


class SignupResendOtpRequest(BasePhoneRequest):
    pass


class LoginRequest(BasePhoneRequest):
    password: str


class LoginVerifyOtpRequest(BasePhoneRequest):
    otp: str


class ForgotPasswordRequest(BasePhoneRequest):
    pass


class ResetPasswordRequest(BasePhoneRequest):
    otp: str
    new_password: str


# ---------------------------------------------------------------------------
# Security headers middleware
# ---------------------------------------------------------------------------

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'none'"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="auth-svc")
app.add_middleware(SecurityHeadersMiddleware)


@app.get("/health")
async def health():
    r = _get_redis()
    return {"status": "ok", "service": "auth-svc", "redis": "connected" if r else "unavailable"}


# ── POST /auth/signup ────────────────────────────────────────────────────────

@app.post("/auth/signup", status_code=status.HTTP_201_CREATED)
async def signup(body: SignupRequest):
    # Validate role
    # Only 'merchant' is open for public self-registration
    if body.role != "merchant":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Public registration is only available for the 'merchant' role. Contact an administrator for analyst or admin access.",
        )

    # Confirm-password match
    if body.password != body.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="password and confirm_password do not match",
        )

    # Password complexity
    complexity_error = check_password_complexity(body.password)
    if complexity_error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=complexity_error,
        )

    # Merchant requires a name
    if body.role == "merchant" and not (body.merchant_name or "").strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="merchant_name is required when role is 'merchant'",
        )

    # Rate-limit OTP sends
    if not _check_otp_send_rate_limit(body.phone_number):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OTP requests for this number. Please wait 10 minutes before trying again.",
        )

    # Check for existing account
    existing = db_execute(
        "SELECT id, phone_verified FROM users WHERE phone_number = %s",
        (body.phone_number,),
        fetch="one",
    )

    if existing:
        if existing["phone_verified"]:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this phone number already exists",
            )
        else:
            # Unverified account exists → resend a fresh OTP (don't 409)
            user_id = str(existing["id"])
            code = create_and_send_otp(user_id, body.phone_number, "signup")
            _resp = {
                "status": "otp_sent",
                "message": (
                    "An account with this number is pending verification. "
                    "A fresh verification code has been sent to your phone."
                ),
            }
            if DEV_MODE:
                _resp["dev_otp"] = code
            return _resp

    password_hash = hash_password(body.password)
    merchant_id = None

    # Create merchant row first (FK must exist before users row)
    if body.role == "merchant":
        merchant_row = db_execute(
            """
            INSERT INTO merchants (name, category, persona, is_synthetic)
            VALUES (%s, NULL, 'real_upload', FALSE)
            RETURNING id
            """,
            (body.merchant_name.strip(),),
            fetch="one",
        )
        merchant_id = str(merchant_row["id"])

    # Create user row (phone_verified=false)
    user_row = db_execute(
        """
        INSERT INTO users (phone_number, password_hash, role, merchant_id, name, phone_verified)
        VALUES (%s, %s, %s, %s, %s, false)
        RETURNING id, phone_number, role, merchant_id
        """,
        (body.phone_number, password_hash, body.role, merchant_id, body.name.strip()),
        fetch="one",
    )

    user_id = str(user_row["id"])

    # Audit log
    db_execute(
        """
        INSERT INTO audit_log (actor, action, entity_type, entity_id, metadata)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (
            "system:auth-svc",
            "user.signup",
            "user",
            user_id,
            json.dumps({"role": body.role, "phone_verified": False}),
        ),
    )

    # Generate and send signup OTP
    code = create_and_send_otp(user_id, body.phone_number, "signup")

    _resp = {
        "status": "otp_sent",
        "message": "Account created. Please check your phone for a 6-digit verification code.",
        "user_id": user_id,
    }
    if DEV_MODE:
        _resp["dev_otp"] = code
    return _resp


# ── POST /auth/signup/verify-otp ─────────────────────────────────────────────

@app.post("/auth/signup/verify-otp")
async def signup_verify_otp(body: SignupVerifyOtpRequest):
    user = db_execute(
        "SELECT id, phone_verified FROM users WHERE phone_number = %s",
        (body.phone_number,),
        fetch="one",
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with that phone number",
        )

    if user["phone_verified"]:
        return {"message": "Phone is already verified. You can log in."}

    # Verify the OTP — use Twilio Verify if configured, else local DB check
    if TWILIO_VERIFY_SERVICE_SID:
        verify_otp_via_twilio(body.phone_number, body.otp)
    else:
        validate_otp(str(user["id"]), body.otp, "signup")

    db_execute(
        "UPDATE users SET phone_verified = true WHERE id = %s",
        (user["id"],),
    )

    db_execute(
        """
        INSERT INTO audit_log (actor, action, entity_type, entity_id, metadata)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (
            "system:auth-svc",
            "user.phone_verified",
            "user",
            str(user["id"]),
            json.dumps({"phone_number": body.phone_number}),
        ),
    )

    return {"message": "Phone verified successfully. You can now log in."}


# ── POST /auth/signup/resend-otp ──────────────────────────────────────────────

@app.post("/auth/signup/resend-otp")
async def signup_resend_otp(body: SignupResendOtpRequest):
    user = db_execute(
        "SELECT id, phone_verified FROM users WHERE phone_number = %s",
        (body.phone_number,),
        fetch="one",
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with that phone number",
        )
    if user["phone_verified"]:
        return {"message": "Phone is already verified. You can log in."}

    # Rate-limit
    if not _check_otp_send_rate_limit(body.phone_number):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OTP requests for this number. Please wait 10 minutes before trying again.",
        )

    code = create_and_send_otp(str(user["id"]), body.phone_number, "signup")
    _resp = {
        "status": "otp_sent",
        "message": "A fresh verification code has been sent to your phone.",
    }
    if DEV_MODE:
        _resp["dev_otp"] = code
    return _resp


# ── POST /auth/login ──────────────────────────────────────────────────────────

@app.post("/auth/login")
async def login(body: LoginRequest):
    user = db_execute(
        "SELECT id, phone_number, password_hash, role, merchant_id, phone_verified FROM users WHERE phone_number = %s",
        (body.phone_number,),
        fetch="one",
    )

    # Generic 401 — do not reveal whether phone or password was wrong
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    # Block unverified accounts
    if not user["phone_verified"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Your phone number has not been verified. "
                "Please complete signup verification before logging in."
            ),
        )

    # Rate-limit OTP sends
    if not _check_otp_send_rate_limit(body.phone_number):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OTP requests for this number. Please wait 10 minutes before trying again.",
        )

    # Send 2FA OTP via SMS
    code = create_and_send_otp(str(user["id"]), body.phone_number, "login")

    _resp = {
        "status": "otp_sent",
        "message": "Credentials verified. Please check your phone for a 6-digit login code.",
    }
    if DEV_MODE:
        _resp["dev_otp"] = code
    return _resp


# ── POST /auth/login/verify-otp ───────────────────────────────────────────────

@app.post("/auth/login/verify-otp")
async def login_verify_otp(body: LoginVerifyOtpRequest):
    user = db_execute(
        "SELECT id, phone_number, role, merchant_id FROM users WHERE phone_number = %s AND phone_verified = true",
        (body.phone_number,),
        fetch="one",
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials or unverified account",
        )

    # Verify the OTP — use Twilio Verify if configured, else local DB check
    if TWILIO_VERIFY_SERVICE_SID:
        verify_otp_via_twilio(body.phone_number, body.otp)
    else:
        validate_otp(str(user["id"]), body.otp, "login")

    merchant_id_str = str(user["merchant_id"]) if user["merchant_id"] else None
    token = create_token({
        "sub": str(user["id"]),
        "phone_number": user["phone_number"],
        "role": user["role"],
        "merchant_id": merchant_id_str,
    })

    db_execute(
        """
        INSERT INTO audit_log (actor, action, entity_type, entity_id, metadata)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (
            "system:auth-svc",
            "user.login",
            "user",
            str(user["id"]),
            json.dumps({"phone_number": user["phone_number"], "method": "sms_otp_2fa"}),
        ),
    )

    return {
        "token": token,
        "role": user["role"],
        "merchant_id": merchant_id_str,
    }


# ── POST /auth/forgot-password ────────────────────────────────────────────────

@app.post("/auth/forgot-password")
async def forgot_password(body: ForgotPasswordRequest):
    user = db_execute(
        "SELECT id FROM users WHERE phone_number = %s",
        (body.phone_number,),
        fetch="one",
    )

    # Rate-limit OTP sends
    if not _check_otp_send_rate_limit(body.phone_number):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many OTP requests for this number. Please wait 10 minutes before trying again.",
        )

    # Always return success to avoid user-enumeration
    code = ""
    if user:
        code = create_and_send_otp(str(user["id"]), body.phone_number, "password_reset")

    _resp = {
        "status": "otp_sent",
        "message": (
            "If an account with that phone number exists, "
            "a password-reset code has been sent to it."
        ),
    }
    if DEV_MODE:
        _resp["dev_otp"] = code
    return _resp


# ── POST /auth/reset-password ─────────────────────────────────────────────────

@app.post("/auth/reset-password")
async def reset_password(body: ResetPasswordRequest):
    user = db_execute(
        "SELECT id FROM users WHERE phone_number = %s",
        (body.phone_number,),
        fetch="one",
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with that phone number",
        )

    # Password complexity
    complexity_error = check_password_complexity(body.new_password)
    if complexity_error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=complexity_error,
        )

    # Verify the OTP — use Twilio Verify if configured, else local DB check
    if TWILIO_VERIFY_SERVICE_SID:
        verify_otp_via_twilio(body.phone_number, body.otp)
    else:
        validate_otp(str(user["id"]), body.otp, "password_reset")

    new_hash = hash_password(body.new_password)
    db_execute(
        "UPDATE users SET password_hash = %s WHERE id = %s",
        (new_hash, user["id"]),
    )

    db_execute(
        """
        INSERT INTO audit_log (actor, action, entity_type, entity_id, metadata)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (
            "system:auth-svc",
            "user.password_reset",
            "user",
            str(user["id"]),
            json.dumps({"phone_number": body.phone_number}),
        ),
    )

    return {"message": "Password has been reset successfully. You can now log in with your new password."}


# ── GET /auth/me ──────────────────────────────────────────────────────────────

@app.get("/auth/me")
async def me(request: Request):
    token = extract_bearer(request)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header",
        )

    claims = decode_token(token)
    if not claims:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or expired",
        )

    return {
        "user_id": claims.get("sub"),
        "phone_number": claims.get("phone_number"),
        "role": claims.get("role"),
        "merchant_id": claims.get("merchant_id"),
    }


# ── POST /auth/logout ─────────────────────────────────────────────────────────

@app.post("/auth/logout")
async def logout(request: Request):
    """
    Revoke the current JWT in Redis so it cannot be reused for the remainder of its TTL.
    Best-effort: if Redis is unavailable the endpoint still succeeds (client discards token).
    """
    token = extract_bearer(request)
    if token:
        r = _get_redis()
        if r:
            try:
                r.setex(f"revoked_token:{token}", JWT_TTL_HOURS * 3600, "1")
                log.info("Token revoked (logout)")
            except Exception as exc:
                log.warning("Could not revoke token in Redis: %s", exc)
    return {"message": "Logged out successfully."}
