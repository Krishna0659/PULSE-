"""
redis_client.py — Shared Redis connection for Pulse backend services.

Usage:
    from common.redis_client import get_redis

Falls back gracefully if Redis is not available (DEV mode without Redis).
"""
import logging
import os

log = logging.getLogger("redis_client")

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

_redis = None


def get_redis():
    """
    Returns a Redis client instance, lazily initialised.
    Returns None if Redis is unavailable (graceful degradation for dev).
    """
    global _redis
    if _redis is not None:
        return _redis
    try:
        import redis
        client = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        client.ping()  # fail fast if not available
        _redis = client
        log.info("Redis connected: %s", REDIS_URL)
    except Exception as exc:
        log.warning("Redis unavailable (%s). Falling back to in-process store.", exc)
        _redis = None
    return _redis
