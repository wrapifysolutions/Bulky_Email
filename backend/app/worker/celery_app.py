from celery import Celery
from celery.schedules import crontab

from app.config import settings

celery_app = Celery(
    "bulkyy",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "reset-daily-mailbox-counts": {
            "task": "app.worker.tasks.reset_daily_counts",
            "schedule": crontab(hour=0, minute=0),
        },
    },
)

celery_app.autodiscover_tasks(["app.worker"])
