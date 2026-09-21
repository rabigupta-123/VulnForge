from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "cyberguardian_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

# General Celery configuration
celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
)

# Auto-discover tasks in app.workers package
celery_app.autodiscover_tasks(["app.workers"])

# Register recurring monthly re-check task schedule (every 30 days)
celery_app.conf.beat_schedule = {
    "monthly-identity-recheck": {
        "task": "app.workers.tasks.recheck_identity_breaches",
        "schedule": 30 * 24 * 3600,
    }
}
