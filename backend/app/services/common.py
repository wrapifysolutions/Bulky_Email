import html
import re
from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    ActivityLog,
    Campaign,
    CampaignStatus,
    CsvUpload,
    Lead,
    LeadStatus,
    LogType,
    Mailbox,
    MailboxStatus,
    SentEmail,
)
from app.schemas import DashboardStats, MailboxUsageStat, NamedCount


async def refresh_mailbox_quota(mailbox: Mailbox) -> Mailbox:
    """Reset sent_today when the calendar day rolls over (no Celery required)."""
    today = date.today()
    if mailbox.quota_date != today:
        mailbox.sent_today = 0
        mailbox.quota_date = today
    return mailbox


async def refresh_all_mailbox_quotas(db: AsyncSession) -> None:
    result = await db.execute(select(Mailbox))
    for mailbox in result.scalars().all():
        await refresh_mailbox_quota(mailbox)


async def get_dashboard_stats(db: AsyncSession) -> DashboardStats:
    await refresh_all_mailbox_quotas(db)

    total_mailboxes = await db.scalar(select(func.count()).select_from(Mailbox)) or 0
    active_mailboxes = (
        await db.scalar(
            select(func.count())
            .select_from(Mailbox)
            .where(Mailbox.status == MailboxStatus.ACTIVE)
        )
        or 0
    )

    emails_sent_today = (
        await db.scalar(select(func.coalesce(func.sum(Mailbox.sent_today), 0))) or 0
    )

    daily_capacity = (
        await db.scalar(
            select(func.coalesce(func.sum(Mailbox.daily_limit), 0))
            .select_from(Mailbox)
            .where(Mailbox.status == MailboxStatus.ACTIVE)
        )
        or 0
    )
    emails_remaining = max(daily_capacity - emails_sent_today, 0)

    campaigns_running = (
        await db.scalar(
            select(func.count())
            .select_from(Campaign)
            .where(Campaign.status == CampaignStatus.RUNNING)
        )
        or 0
    )

    csv_uploaded = await db.scalar(select(func.count()).select_from(CsvUpload)) or 0
    total_leads = await db.scalar(select(func.count()).select_from(Lead)) or 0
    valid_emails = (
        await db.scalar(
            select(func.count())
            .select_from(Lead)
            .where(Lead.status == LeadStatus.VALID)
        )
        or 0
    )

    total_sent = await db.scalar(select(func.count()).select_from(SentEmail)) or 0
    failed_emails = (
        await db.scalar(
            select(func.count())
            .select_from(Lead)
            .where(Lead.status == LeadStatus.INVALID)
        )
        or 0
    )

    bounce_rate = 0.0
    if total_sent > 0:
        bounce_count = (
            await db.scalar(select(func.coalesce(func.sum(Campaign.bounce_count), 0)))
            or 0
        )
        bounce_rate = round((bounce_count / total_sent) * 100, 2)

    mailbox_rows = (
        await db.execute(select(Mailbox).order_by(Mailbox.id))
    ).scalars().all()
    mailbox_usage = [
        MailboxUsageStat(
            id=mb.id,
            email=mb.email,
            sent_today=mb.sent_today,
            daily_limit=mb.daily_limit,
            remaining_today=max(mb.daily_limit - mb.sent_today, 0),
            status=mb.status.value if hasattr(mb.status, "value") else str(mb.status),
            health_score=mb.health_score,
        )
        for mb in mailbox_rows
    ]

    lead_breakdown: list[NamedCount] = []
    for status in LeadStatus:
        count = (
            await db.scalar(
                select(func.count()).select_from(Lead).where(Lead.status == status)
            )
            or 0
        )
        if count:
            lead_breakdown.append(NamedCount(name=status.value, count=count))

    campaign_breakdown: list[NamedCount] = []
    for status in CampaignStatus:
        count = (
            await db.scalar(
                select(func.count()).select_from(Campaign).where(Campaign.status == status)
            )
            or 0
        )
        if count:
            campaign_breakdown.append(NamedCount(name=status.value, count=count))

    return DashboardStats(
        total_mailboxes=total_mailboxes,
        active_mailboxes=active_mailboxes,
        emails_sent_today=emails_sent_today,
        emails_remaining=emails_remaining,
        campaigns_running=campaigns_running,
        csv_uploaded=csv_uploaded,
        total_leads=total_leads,
        valid_emails=valid_emails,
        failed_emails=failed_emails,
        bounce_rate=bounce_rate,
        total_sent_all_time=total_sent,
        daily_capacity=daily_capacity,
        mailbox_usage=mailbox_usage,
        lead_breakdown=lead_breakdown,
        campaign_breakdown=campaign_breakdown,
    )


async def log_activity(
    db: AsyncSession,
    log_type: LogType,
    message: str,
    details: str | None = None,
) -> ActivityLog:
    log = ActivityLog(log_type=log_type, message=message, details=details)
    db.add(log)
    await db.flush()
    return log


def personalize_template(template: str, lead: Lead) -> str:
    """Replace {{tokens}} and decode HTML/hex entities into real Unicode."""
    variables = {
        "FirstName": lead.first_name or "",
        "LastName": lead.last_name or "",
        "Company": lead.company or "",
        "Website": lead.website or "",
        "Email": lead.email or "",
    }
    result = template
    for key, value in variables.items():
        result = result.replace(f"{{{{{key}}}}}", value)
    # Convert &#x2705; / &amp; / etc. into actual Unicode characters
    return html.unescape(result)


EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
)

IGNORED_PREFIXES = ("noreply", "donotreply", "no-reply", "do-not-reply")


def is_valid_email(email: str) -> bool:
    if not email or not EMAIL_REGEX.match(email):
        return False
    local = email.split("@")[0].lower()
    return not any(local.startswith(p) for p in IGNORED_PREFIXES)


def normalize_url(url: str) -> str:
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"
    return url


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)
