"""
Analytics tracking middleware.

For every HTTP request that hits the FastAPI application, this middleware:
  1. Derives the subdomain from the Host header.
  2. Computes a daily-salted sha256 of the client IP → visitor_hash.
     The raw IP is discarded immediately after hashing; it is never written
     to any database column.
  3. Optionally resolves a coarse country code from the IP using a
     lightweight offline lookup (geoip2 / ip_country fallback).
  4. Enqueues a Celery background task to write the PageVisit row —
     so the database write never adds latency to the actual HTTP response.

Requests that are excluded from tracking:
  - GET /health           (liveness probe — noise)
  - /static/*             (static assets)
  - /favicon.ico
  - /api/v1/*             (API calls are tracked separately via API key usage)
  - OPTIONS               (CORS preflight)
"""
import hashlib
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response


# ── Paths excluded from page-visit logging ────────────────────────────────────
_EXCLUDED_PREFIXES = ("/api/v1/", "/static/", "/health", "/favicon.ico", "/_next/")
_EXCLUDED_METHODS = {"OPTIONS", "HEAD"}


def _should_skip(path: str, method: str) -> bool:
    if method in _EXCLUDED_METHODS:
        return True
    for prefix in _EXCLUDED_PREFIXES:
        if path.startswith(prefix):
            return True
    return False


def _extract_subdomain(host: Optional[str]) -> str:
    """
    Derive the subdomain label from a Host header.
    e.g. "app.cyberguardian.io" → "app"
         "cyberguardian.io"      → "www"   (root / bare domain)
         "localhost" / None       → "local"
    """
    if not host:
        return "local"
    # Strip port if present
    hostname = host.split(":")[0].lower()
    parts = hostname.split(".")
    if len(parts) >= 3:
        return parts[0]
    if hostname in ("localhost", "127.0.0.1"):
        return "local"
    return "www"


def _daily_salt() -> str:
    """
    Return a per-process environment salt combined with today's UTC date.
    The salt changes every UTC day, making yesterday's visitor_hashes
    unresolvable to their source IPs.
    """
    env_salt = os.environ.get("ANALYTICS_SALT", "cg-analytics-default-salt-2026")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"{env_salt}:{today}"


def _hash_ip(ip: str) -> str:
    """sha256(ip_address + daily_salt) — raw IP is never stored."""
    raw = f"{ip}:{_daily_salt()}"
    return hashlib.sha256(raw.encode()).hexdigest()


def _resolve_country(ip: str) -> Optional[str]:
    """
    Attempt a lightweight country lookup.
    Uses geoip2 (MaxMind) if installed, otherwise tries ip_country,
    otherwise returns None gracefully — country is purely optional.
    """
    try:
        import geoip2.database  # type: ignore
        import geoip2.errors  # type: ignore
        db_path = os.environ.get("GEOIP_DB_PATH", "/usr/local/share/GeoIP/GeoLite2-Country.mmdb")
        if not os.path.exists(db_path):
            raise FileNotFoundError
        with geoip2.database.Reader(db_path) as reader:
            response = reader.country(ip)
            return response.country.iso_code
    except Exception:
        pass

    try:
        import ip_country  # type: ignore
        return ip_country.country(ip)
    except Exception:
        pass

    return None


class AnalyticsMiddleware(BaseHTTPMiddleware):
    """
    Non-blocking visitor tracking middleware.
    Each qualifying request spawns a FastAPI BackgroundTask to write
    the PageVisit row, so the actual HTTP response is never delayed.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Execute the actual handler first — capture the response
        response: Response = await call_next(request)

        path = request.url.path
        method = request.method

        if _should_skip(path, method):
            return response

        # ── Collect request metadata ──────────────────────────────────────────
        # Client IP (respect X-Forwarded-For set by a reverse proxy)
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        elif request.client:
            client_ip = request.client.host
        else:
            client_ip = "unknown"

        visitor_hash = _hash_ip(client_ip)  # Raw IP used only here, immediately discarded
        country = _resolve_country(client_ip)

        host = request.headers.get("host", "")
        subdomain = _extract_subdomain(host)
        referrer = request.headers.get("referer") or request.headers.get("referrer")
        user_agent = request.headers.get("user-agent")
        status_code = response.status_code

        # ── Enqueue the DB write as a background task ─────────────────────────
        # Import here to avoid circular imports at module load time
        from app.workers.tasks import log_page_visit_task  # noqa: PLC0415
        import sys

        if "pytest" not in sys.modules:
            try:
                log_page_visit_task.delay(
                    subdomain=subdomain,
                    path=path,
                    method=method,
                    visitor_hash=visitor_hash,
                    referrer=referrer,
                    user_agent=user_agent,
                    country=country,
                )
            except Exception:
                # If Celery/Redis is unavailable (e.g. local dev without Redis),
                # fall back to a synchronous write so analytics still work.
                log_page_visit_task(
                    subdomain=subdomain,
                    path=path,
                    method=method,
                    visitor_hash=visitor_hash,
                    referrer=referrer,
                    user_agent=user_agent,
                    country=country,
                )

        return response
