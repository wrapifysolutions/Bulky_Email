from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.models import Mailbox
from app.services.campaign_service import run_campaign_queue
from app.worker.celery_app import celery_app

sync_engine = create_engine(settings.database_url_sync)
SyncSession = sessionmaker(bind=sync_engine)


@celery_app.task(name="app.worker.tasks.process_campaign_queue")
def process_campaign_queue(campaign_id: int):
    run_campaign_queue(campaign_id)


@celery_app.task(name="app.worker.tasks.reset_daily_counts")
def reset_daily_counts():
    from datetime import date

    with SyncSession() as db:
        mailboxes = db.execute(select(Mailbox)).scalars().all()
        today = date.today()
        for mb in mailboxes:
            mb.sent_today = 0
            mb.quota_date = today
        db.commit()
