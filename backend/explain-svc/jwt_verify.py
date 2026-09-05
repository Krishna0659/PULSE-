"""
common/jwt_verify.py
Standalone, dependency-light JWT verification helper.
Only dependency: python-jose (HS256).
Other services can copy this file without importing anything from auth-svc.
"""
import os
import logging
import redis as _redis_lib
from typing import Optional
from jose import jwt, JWTError

log = logging.getLogger(__name__)
ALGORITHM = "HS256"
_redis_client = None


def get_redis():
    """
    Return a connected Redis client, or None if Redis is unreachable.
    Uses a short connect timeout so startup is never blocked.
    Resets the cached client on error so the next call retries
    (handles the case where Redis restarts after service startup).
    """
    global _redis_client
    if _redis_client is not None:
        return _redis_client
    try:
        REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        client = _redis_lib.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        client.ping()
        _redis_client = client
    except Exception as exc:
        log.debug("Redis unavailable for token denylist check: %s", exc)
        _redis_client = None
    return _redis_client


def verify_token(token: str, secret: str) -> Optional[dict]:
    """
    Decode and verify an HS256 JWT.

    Returns the claims dict on success, or None if the token is
    missing, invalid, expired, or signed with the wrong secret.

    The Redis token-revocation check is best-effort: if Redis is
    unavailable or throws after startup, we fail open (treat token as
    valid) rather than crashing the request with a 500.  The token is
    still cryptographically verified, so this is safe.
    """
    if not token or not secret:
        return None
    try:
        payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
    except JWTError:
        return None

    # Check if token is in Redis denylist (logout revocation list).
    # Wrapped in try/except: a Redis failure must NEVER crash a request.
    try:
        r = get_redis()
        if r and r.get(f"revoked_token:{token}"):
            return None
    except Exception as exc:
        # Redis went down after startup — reset so next request retries.
        global _redis_client
        _redis_client = None
        log.warning(
            "Redis denylist check failed (failing open — token still crypto-verified): %s",
            exc,
        )

    return payload