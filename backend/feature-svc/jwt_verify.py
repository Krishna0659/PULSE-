"""
common/jwt_verify.py
Standalone, dependency-light JWT verification helper.
Only dependency: python-jose (HS256).
Other services can copy this file without importing anything from auth-svc.
"""
import os
import redis as _redis_lib
from typing import Optional
from jose import jwt, JWTError

ALGORITHM = "HS256"
_redis_client = None

def get_redis():
    global _redis_client
    if _redis_client is None:
        try:
            REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
            _redis_client = _redis_lib.from_url(REDIS_URL, decode_responses=True)
            _redis_client.ping()
        except Exception:
            pass
    return _redis_client


def verify_token(token: str, secret: str) -> Optional[dict]:
    """
    Decode and verify an HS256 JWT.

    Returns the claims dict on success, or None if the token is
    missing, invalid, expired, or signed with the wrong secret.
    """
    if not token or not secret:
        return None
    try:
        payload = jwt.decode(token, secret, algorithms=[ALGORITHM])
        
        # NEW: Check if token is in Redis denylist
        r = get_redis()
        if r and r.get(f"revoked_token:{token}"):
            return None
            
        return payload
    except JWTError:
        return None