import logging
import time
from collections import defaultdict
from fastapi import Request, HTTPException, status
import redis

from app.core.config import settings

logger = logging.getLogger(__name__)

# Initialize redis client if configured
redis_client = None
if settings.REDIS_URL:
    try:
        redis_client = redis.from_url(settings.REDIS_URL, socket_timeout=1.0)
    except Exception as e:
        logger.warning(f"Failed to connect to Redis for rate limiting: {str(e)}")


class RateLimiter:
    """
    FastAPI dependency for sliding-window rate limiting.
    """

    def __init__(self, requests_limit: int, window_seconds: int):
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        # Fallback local in-memory store
        self.in_memory_history = defaultdict(list)

    def __call__(self, request: Request):
        import sys
        # Bypass rate limits during test suite executions unless explicitly requested for security testing
        if "pytest" in sys.modules and not request.headers.get("X-Test-Rate-Limit"):
            return

        ip = request.client.host if request.client else "unknown"
        # Scope the rate limit to both IP and request path
        key = f"rate_limit:{ip}:{request.url.path}"
        now = time.time()

        if redis_client:
            try:
                # Remove timestamps outside the sliding window
                pipe = redis_client.pipeline()
                pipe.zremrangebyscore(key, 0, now - self.window_seconds)
                # Add the current timestamp (using timestamp string as score & value)
                pipe.zadd(key, {str(now): now})
                # Count total requests remaining in the window
                pipe.zcard(key)
                # Set dynamic TTL expiration to clean up unused keys
                pipe.expire(key, self.window_seconds)
                results = pipe.execute()

                request_count = results[2]
                if request_count > self.requests_limit:
                    logger.warning(f"Rate limit exceeded for IP {ip} on path {request.url.path} (Redis)")
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Too many requests. Please try again later.",
                    )
                return
            except redis.RedisError as e:
                logger.warning(f"Redis rate limiting failed, falling back to in-memory: {str(e)}")

        # Local In-Memory sliding-window rate limit check
        self.in_memory_history[ip] = [
            t for t in self.in_memory_history[ip] if now - t < self.window_seconds
        ]
        
        if len(self.in_memory_history[ip]) >= self.requests_limit:
            logger.warning(f"Rate limit exceeded for IP {ip} on path {request.url.path} (In-Memory)")
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
            )

        self.in_memory_history[ip].append(now)
