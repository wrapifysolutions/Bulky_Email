from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import campaigns, dashboard, leads, mailboxes, templates
from app.config import settings
from app.database import Base, engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_ensure_mailbox_quota_column)
    await _remove_dummy_mailboxes()
    await _reconcile_campaigns_on_boot()
    yield
    await engine.dispose()


async def _reconcile_campaigns_on_boot():
    from app.database import async_session
    from app.services.campaign_service import (
        ensure_campaign_worker,
        reconcile_stuck_running_campaigns,
    )

    async with async_session() as db:
        restart_ids = await reconcile_stuck_running_campaigns(db)
        await db.commit()
    for cid in restart_ids:
        ensure_campaign_worker(cid)


def _ensure_mailbox_quota_column(sync_conn) -> None:
    """Add quota_date to existing SQLite DBs created before this field existed."""
    from sqlalchemy import inspect, text

    inspector = inspect(sync_conn)
    if "mailboxes" not in inspector.get_table_names():
        return
    columns = {col["name"] for col in inspector.get_columns("mailboxes")}
    if "quota_date" not in columns:
        sync_conn.execute(text("ALTER TABLE mailboxes ADD COLUMN quota_date DATE"))


async def _remove_dummy_mailboxes():
    """Remove placeholder seed mailboxes if they still exist."""
    from sqlalchemy import delete, select

    from app.database import async_session
    from app.models import Mailbox

    dummy_emails = {
        "mailbox1@company.com",
        "mailbox2@company.com",
        "mailbox3@company.com",
    }
    async with async_session() as db:
        result = await db.execute(select(Mailbox).where(Mailbox.email.in_(dummy_emails)))
        if result.scalars().first():
            await db.execute(delete(Mailbox).where(Mailbox.email.in_(dummy_emails)))
            await db.commit()


app = FastAPI(
    title="Bulkyy API",
    description="Smart Bulk Email Outreach & Lead Generation Platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router, prefix="/api")
app.include_router(mailboxes.router, prefix="/api")
app.include_router(templates.router, prefix="/api")
app.include_router(leads.router, prefix="/api")
app.include_router(campaigns.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
