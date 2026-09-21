from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.sql import text

from app.core.config import settings
from app.core.database import get_db, engine, Base
from app.workers.tasks import test_celery_worker
from app.core.logging_middleware import StructuredLoggingMiddleware

# Import models to ensure they are registered with Base metadata before creation
from app.models import user as user_models
from app.models import asset as asset_models
from app.models import scan as scan_models
from app.models import bounty as bounty_models
from app.models import audit as audit_models
from app.api.v1.endpoints import auth, assets, scans, dashboard, billing, findings, badge, identity, ci, assistant, bounty

# Automatically create tables on startup (convenient for local/development runtimes)
Base.metadata.create_all(bind=engine)

def _ensure_sqlite_columns():
    try:
        with engine.connect() as conn:
            user_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(users)"))]
            if "is_researcher" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN is_researcher BOOLEAN DEFAULT 0"))
            
            scan_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(scans)"))]
            if "scan_type" not in scan_cols:
                conn.execute(text("ALTER TABLE scans ADD COLUMN scan_type VARCHAR DEFAULT 'vulnerability'"))
            if "execution_log" not in scan_cols:
                conn.execute(text("ALTER TABLE scans ADD COLUMN execution_log TEXT"))

            finding_cols = [row[1] for row in conn.execute(text("PRAGMA table_info(findings)"))]
            if "verified_by_poc" not in finding_cols:
                conn.execute(text("ALTER TABLE findings ADD COLUMN verified_by_poc BOOLEAN DEFAULT 0"))
            
            conn.commit()
    except Exception as e:
        pass

_ensure_sqlite_columns()

# Only expose Swagger UI and OpenAPI documentation schema details in development
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if settings.ENVIRONMENT == "development" else None,
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
)

# Register middleware
app.add_middleware(StructuredLoggingMiddleware)


from app.api.v1.endpoints import auth, assets, scans, dashboard, billing, findings, badge, identity, ci, assistant, bounty, system_health

# Register routes
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(assets.router, prefix=f"{settings.API_V1_STR}/assets", tags=["assets"])
app.include_router(scans.router, prefix=f"{settings.API_V1_STR}/scans", tags=["scans"])
app.include_router(dashboard.router, prefix=f"{settings.API_V1_STR}/dashboard", tags=["dashboard"])
app.include_router(billing.router, prefix=f"{settings.API_V1_STR}/billing", tags=["billing"])
app.include_router(findings.router, prefix=f"{settings.API_V1_STR}/findings", tags=["findings"])
app.include_router(badge.router, prefix=f"{settings.API_V1_STR}/badge", tags=["badge"])
app.include_router(identity.router, prefix=f"{settings.API_V1_STR}/identity", tags=["identity"])
app.include_router(ci.router, prefix=f"{settings.API_V1_STR}/ci", tags=["ci"])
app.include_router(assistant.router, prefix=f"{settings.API_V1_STR}/assistant", tags=["assistant"])
app.include_router(bounty.router, prefix=f"{settings.API_V1_STR}/bounty", tags=["bounty"])
app.include_router(system_health.router, prefix=f"{settings.API_V1_STR}/admin/system-health", tags=["system-health"])

# Set up Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none';"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# Set up CORS middleware
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/")
def read_root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "docs_url": "/docs",
    }


@app.get("/health")
@app.get("/health/scanner")
def health_check(db: Session = Depends(get_db)):
    """
    Enhanced pipeline health check verifying Database, Redis, Celery broker, and ZAP daemon reachability.
    """
    db_status = "healthy"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    redis_status = "healthy"
    if getattr(settings, "REDIS_URL", None):
        try:
            import redis
            r = redis.from_url(settings.REDIS_URL, socket_timeout=1.0)
            r.ping()
        except Exception as e:
            redis_status = f"unhealthy: {str(e)}"
    else:
        redis_status = "unconfigured"

    celery_status = "healthy"
    try:
        from app.workers.celery_app import celery_app
        inspector = celery_app.control.inspect(timeout=1.0)
        workers = inspector.ping()
        if not workers:
            celery_status = "unhealthy: no active workers found"
    except Exception as e:
        celery_status = f"unhealthy: {str(e)}"

    zap_status = "healthy"
    zap_url = getattr(settings, "ZAP_API_URL", "http://localhost:8090")
    try:
        import requests
        resp = requests.get(f"{zap_url}/JSON/core/view/version/", timeout=2.0)
        if resp.status_code != 200:
            zap_status = f"unhealthy: status code {resp.status_code}"
    except Exception as e:
        zap_status = f"unreachable ({str(e)})"

    overall_status = "online"
    if any("unhealthy" in s for s in [db_status, redis_status, celery_status]):
        overall_status = "degraded"

    return {
        "status": overall_status,
        "environment": settings.ENVIRONMENT,
        "database": db_status,
        "redis": redis_status,
        "celery": celery_status,
        "zap_daemon": zap_status,
    }



@app.post("/test-celery-task")
def trigger_celery_task(word: str = "hello"):
    """
    Test endpoint to queue a Celery task and return its task_id.
    """
    task = test_celery_worker.delay(word)
    return {
        "message": "Task queued successfully",
        "task_id": task.id,
        "status": task.status,
    }
