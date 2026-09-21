import json
import time
import logging
import traceback
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger("cybercortex.api")

SENSITIVE_KEYS = {"password", "password_hash", "token", "access_token", "secret", "api_key", "authorization", "stripe_secret_key", "llm_api_key"}

def redact_sensitive_data(data: dict) -> dict:
    """Recursively redacts sensitive keys in log payloads."""
    if not isinstance(data, dict):
        return data
    redacted = {}
    for k, v in data.items():
        if k.lower() in SENSITIVE_KEYS:
            redacted[k] = "[REDACTED]"
        elif isinstance(v, dict):
            redacted[k] = redact_sensitive_data(v)
        else:
            redacted[k] = v
    return redacted

class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()
        client_ip = request.client.host if request.client else "unknown"
        method = request.method
        path = request.url.path

        try:
            response = await call_next(request)
            process_time = (time.time() - start_time) * 1000
            
            content_length = response.headers.get("content-length", "unknown")

            log_data = {
                "client_ip": client_ip,
                "method": method,
                "path": path,
                "status_code": response.status_code,
                "duration_ms": round(process_time, 2),
                "size_bytes": content_length,
            }
            logger.info(json.dumps(redact_sensitive_data(log_data)))
            return response

        except Exception as e:
            process_time = (time.time() - start_time) * 1000
            error_log = {
                "client_ip": client_ip,
                "method": method,
                "path": path,
                "error": str(e),
                "traceback": traceback.format_exc(),
                "duration_ms": round(process_time, 2),
            }
            logger.error(json.dumps(redact_sensitive_data(error_log)))

            # Shield internal stack trace details from client responses
            return JSONResponse(
                status_code=500,
                content={"detail": "An internal server error occurred. Please contact system administrators."},
            )
