"""
Scan Execution Logging & Real-Time Stream Publisher.
Emits structured timestamped logs for scan jobs, stores them in Redis lists,
publishes via Redis Pub/Sub for WebSockets, and persists to PostgreSQL execution_log column.
"""

import json
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

import redis
from app.core.config import settings

logger = logging.getLogger(__name__)

# Global in-memory log buffer fallback when Redis server is unreachable
_MEMORY_LOG_STORE: Dict[str, List[str]] = {}
_MEMORY_SUBSCRIBERS: Dict[str, List[Any]] = {}


def get_redis_client() -> Optional[redis.Redis]:
    """Returns a Redis client instance or None if connection fails."""
    try:
        r = redis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        r.ping()
        return r
    except Exception:
        return None


def emit_scan_log(scan_id: str, level: str, tool: str, message: str) -> str:
    """
    Emits a structured log line for a scan job.
    Format: [HH:MM:SS] [{LEVEL}] [{TOOL}] {message}
    Pushes to Redis list and publishes via Redis Pub/Sub (with in-memory fallback).
    """
    now_str = datetime.now(timezone.utc).strftime("%H:%M:%S")
    log_line = f"[{now_str}] [{level.upper()}] [{tool}] {message}"

    # Print to Python standard logger
    logger.info(f"Scan[{scan_id}] {log_line}")

    # Try Redis Pub/Sub and Redis List
    r = get_redis_client()
    if r:
        try:
            r.rpush(f"scan_log_list:{scan_id}", log_line)
            r.expire(f"scan_log_list:{scan_id}", 86400)  # 24h TTL
            r.publish(f"scan_logs:{scan_id}", json.dumps({"scan_id": scan_id, "line": log_line}))
        except Exception as e:
            logger.warning(f"Failed to push log to Redis: {e}")
            _store_memory_log(scan_id, log_line)
    else:
        _store_memory_log(scan_id, log_line)

    return log_line


def _store_memory_log(scan_id: str, log_line: str):
    if scan_id not in _MEMORY_LOG_STORE:
        _MEMORY_LOG_STORE[scan_id] = []
    _MEMORY_LOG_STORE[scan_id].append(log_line)


def fetch_scan_log_lines(scan_id: str) -> List[str]:
    """
    Retrieves all log lines emitted so far for a scan job from Redis or memory.
    """
    r = get_redis_client()
    if r:
        try:
            lines = r.lrange(f"scan_log_list:{scan_id}", 0, -1)
            if lines:
                return lines
        except Exception as e:
            logger.warning(f"Failed to fetch logs from Redis: {e}")

    return _MEMORY_LOG_STORE.get(scan_id, [])
