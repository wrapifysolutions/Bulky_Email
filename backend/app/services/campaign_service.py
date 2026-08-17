import asyncio
import html
import random
import smtplib
import threading
import time
from datetime import date
from email.header import Header
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.models import (
    Campaign,
    CampaignLead,
    CampaignLeadStatus,
    CampaignMailbox,
    CampaignStatus,
    EmailTemplate,
    Lead,
    LogType,
    Mailbox,
    MailboxStatus,
    SentEmail,
)
from app.services.common import (
    log_activity,
    personalize_template,
    refresh_all_mailbox_quotas,
    refresh_mailbox_quota,
    utcnow,
)

# process_single_email outcomes
RESULT_SENT = "sent"
RESULT_SENT_SWITCH = "sent_switch"  # sent, and this mailbox just hit daily limit → next inbox next
RESULT_FAILED = "failed"
RESULT_DUPLICATE = "duplicate"
RESULT_STOPPED = "stopped"
RESULT_DEFERRED = "deferred"  # all mailboxes at daily limit — try again tomorrow
RESULT_SKIPPED = "skipped"

_TERMINAL_LEAD = {
    CampaignLeadStatus.SENT,
    CampaignLeadStatus.FAILED,
    CampaignLeadStatus.SKIPPED,
    CampaignLeadStatus.DUPLICATE,
    CampaignLeadStatus.BOUNCED,
}

_queue_lock = threading.Lock()
_running_queues: set[int] = set()


async def create_campaign(
    db: AsyncSession,
    name: str,
    template_id: int,
    mailbox_ids: list[int],
    csv_upload_id: int | None = None,
    lead_ids: list[int] | None = None,
) -> Campaign:
    mailboxes = await db.execute(
        select(Mailbox).where(
            Mailbox.id.in_(mailbox_ids),
            Mailbox.status == MailboxStatus.ACTIVE,
        )
    )
    active = mailboxes.scalars().all()
    if not active:
        raise ValueError("No active mailboxes selected")
    if len(active) < 2:
        raise ValueError(
            "Select at least 2 mailboxes for auto-rotation. "
            "With only 1 mailbox, sending stops when that inbox hits its daily limit."
        )

    campaign = Campaign(
        name=name,
        template_id=template_id,
        csv_upload_id=csv_upload_id,
        status=CampaignStatus.DRAFT,
    )
    db.add(campaign)
    await db.flush()

    for mb in active:
        db.add(CampaignMailbox(campaign_id=campaign.id, mailbox_id=mb.id))

    from app.models import LeadStatus

    if lead_ids:
        leads_query = select(Lead).where(Lead.id.in_(lead_ids))
    else:
        leads_query = select(Lead).where(
            Lead.status.in_([LeadStatus.VALID, LeadStatus.NEW])
        )

    leads_result = await db.execute(leads_query)
    leads = leads_result.scalars().all()

    sent_rows = await db.execute(select(SentEmail.email))
    already_sent = {e.lower() for e in sent_rows.scalars().all() if e}

    # Do not pre-bind a mailbox: sender is chosen at send time so each inbox
    # fills its daily_limit (default 15), then the next inbox takes over.
    pending_count = 0
    for lead in leads:
        if not lead.email:
            continue
        email = lead.email.strip().lower()
        if email in already_sent:
            db.add(
                CampaignLead(
                    campaign_id=campaign.id,
                    lead_id=lead.id,
                    mailbox_id=None,
                    status=CampaignLeadStatus.DUPLICATE,
                )
            )
            campaign.duplicate_count += 1
            continue

        db.add(
            CampaignLead(
                campaign_id=campaign.id,
                lead_id=lead.id,
                mailbox_id=None,
                status=CampaignLeadStatus.PENDING,
            )
        )
        pending_count += 1

    campaign.total_leads = pending_count + campaign.duplicate_count
    await db.flush()
    return campaign


async def start_campaign(db: AsyncSession, campaign_id: int) -> Campaign:
    await refresh_all_mailbox_quotas(db)

    result = await db.execute(
        select(Campaign)
        .options(
            selectinload(Campaign.campaign_leads).selectinload(CampaignLead.lead),
            selectinload(Campaign.campaign_mailboxes),
        )
        .where(Campaign.id == campaign_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise ValueError("Campaign not found")

    status_label = (
        campaign.status.value if hasattr(campaign.status, "value") else str(campaign.status)
    )

    # Already sending with a live worker
    if campaign.status == CampaignStatus.RUNNING and campaign_id in _running_queues:
        raise ValueError("Campaign is already sending")

    # Stuck RUNNING (server reload / dead worker) OR normal draft/paused → (re)start sender
    if campaign.status not in (
        CampaignStatus.DRAFT,
        CampaignStatus.PAUSED,
        CampaignStatus.RUNNING,
    ):
        raise ValueError(f"Cannot start campaign in status: {status_label}")

    if not await campaign_has_capacity(db, campaign_id):
        # Keep paused if every mailbox is full — do not fake-run
        if campaign.status == CampaignStatus.RUNNING:
            campaign.status = CampaignStatus.PAUSED
            await db.flush()
        raise ValueError(
            "All selected mailboxes are full for today. Try again tomorrow or add another mailbox."
        )

    campaign.status = CampaignStatus.RUNNING
    if not campaign.started_at:
        campaign.started_at = utcnow()

    queued = 0
    for cl in campaign.campaign_leads:
        # Never re-queue finished leads (SENT / DUPLICATE / FAILED / …)
        if cl.status in _TERMINAL_LEAD:
            continue

        email = (cl.lead.email or "").strip().lower() if cl.lead else ""
        if email and await check_duplicate(db, email):
            cl.status = CampaignLeadStatus.DUPLICATE
            campaign.duplicate_count += 1
            continue

        if cl.status in (
            CampaignLeadStatus.PENDING,
            CampaignLeadStatus.SENDING,
            CampaignLeadStatus.QUEUED,
        ):
            cl.status = CampaignLeadStatus.QUEUED
            queued += 1

    if queued == 0:
        await finalize_campaign_if_done(db, campaign_id)
        await db.flush()
        # Re-load status after finalize
        await db.refresh(campaign)
        if campaign.status == CampaignStatus.COMPLETED:
            raise ValueError("Nothing left to send — campaign is already complete")
        raise ValueError("No pending leads to send")

    await log_activity(
        db,
        LogType.CAMPAIGN_STARTED,
        f"Campaign started: {campaign.name}",
        f"Campaign ID: {campaign.id}, Queued remaining: {queued} (already-sent leads are skipped)",
    )
    await db.flush()
    return campaign


async def pause_campaign(db: AsyncSession, campaign_id: int) -> Campaign:
    result = await db.execute(
        select(Campaign)
        .options(selectinload(Campaign.campaign_leads))
        .where(Campaign.id == campaign_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise ValueError("Campaign not found")
    if campaign.status != CampaignStatus.RUNNING:
        raise ValueError(f"Cannot stop campaign in status: {campaign.status}")

    campaign.status = CampaignStatus.PAUSED

    # Keep remaining work as PENDING so Start can resume cleanly.
    for cl in campaign.campaign_leads:
        if cl.status in (CampaignLeadStatus.QUEUED, CampaignLeadStatus.SENDING):
            cl.status = CampaignLeadStatus.PENDING

    await log_activity(
        db,
        LogType.CAMPAIGN_PAUSED,
        f"Campaign paused: {campaign.name}",
        f"Campaign ID: {campaign.id}, Sent so far: {campaign.sent_count}",
    )
    await db.flush()
    return campaign


async def abort_campaign(db: AsyncSession, campaign_id: int) -> Campaign:
    result = await db.execute(
        select(Campaign)
        .options(selectinload(Campaign.campaign_leads))
        .where(Campaign.id == campaign_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise ValueError("Campaign not found")
    if campaign.status not in (CampaignStatus.RUNNING, CampaignStatus.PAUSED):
        raise ValueError(f"Cannot abort campaign in status: {campaign.status}")

    skipped = 0
    for cl in campaign.campaign_leads:
        if cl.status in (
            CampaignLeadStatus.PENDING,
            CampaignLeadStatus.QUEUED,
            CampaignLeadStatus.SENDING,
        ):
            cl.status = CampaignLeadStatus.SKIPPED
            skipped += 1

    campaign.skipped_count += skipped
    campaign.status = CampaignStatus.ABORTED
    campaign.completed_at = utcnow()

    await log_activity(
        db,
        LogType.CAMPAIGN_ABORTED,
        f"Campaign aborted: {campaign.name}",
        f"Campaign ID: {campaign.id}, Skipped remaining: {skipped}",
    )
    await db.flush()
    return campaign


async def set_campaign_mailboxes(
    db: AsyncSession, campaign_id: int, mailbox_ids: list[int]
) -> Campaign:
    """Replace linked mailboxes on a draft/paused campaign (needed for auto-rotate)."""
    result = await db.execute(
        select(Campaign)
        .options(selectinload(Campaign.campaign_mailboxes))
        .where(Campaign.id == campaign_id)
    )
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise ValueError("Campaign not found")
    if campaign.status not in (CampaignStatus.DRAFT, CampaignStatus.PAUSED):
        raise ValueError("Can only change mailboxes when campaign is draft or paused")

    if len(mailbox_ids) < 2:
        raise ValueError(
            "Select at least 2 mailboxes so auto-rotation can switch when one is full"
        )

    mailboxes = await db.execute(
        select(Mailbox).where(
            Mailbox.id.in_(mailbox_ids),
            Mailbox.status == MailboxStatus.ACTIVE,
        )
    )
    active = mailboxes.scalars().all()
    if len(active) < 2:
        raise ValueError("Need at least 2 active mailboxes selected")

    # Clear old links
    for cm in list(campaign.campaign_mailboxes):
        await db.delete(cm)
    await db.flush()

    for mb in active:
        db.add(CampaignMailbox(campaign_id=campaign.id, mailbox_id=mb.id))

    await log_activity(
        db,
        LogType.CAMPAIGN_STARTED,
        f"Updated mailboxes for campaign: {campaign.name}",
        f"Now using {len(active)} inboxes for auto-rotation: "
        + ", ".join(m.email for m in active),
    )
    await db.flush()
    return campaign


async def check_duplicate(db: AsyncSession, email: str) -> bool:
    normalized = email.strip().lower()
    result = await db.execute(select(SentEmail).where(SentEmail.email == normalized))
    return result.scalar_one_or_none() is not None


async def pick_available_mailbox(
    db: AsyncSession, campaign_id: int
) -> tuple[Mailbox | None, str | None]:
    """
    Round-fill rotation (same campaign, no Resume):
      Mailbox 1 sends until daily_limit is full
      → Mailbox 2 starts immediately and runs until ITS daily_limit is full
      → Mailbox 3 … etc.
    Returns None only when EVERY selected mailbox is full for today.
    """
    await refresh_all_mailbox_quotas(db)

    cm_result = await db.execute(
        select(CampaignMailbox)
        .options(selectinload(CampaignMailbox.mailbox))
        .where(CampaignMailbox.campaign_id == campaign_id)
        .order_by(CampaignMailbox.id.asc())
    )
    campaign_mailboxes = cm_result.scalars().all()
    if not campaign_mailboxes:
        return None, None

    exhausted: list[str] = []
    for cm in campaign_mailboxes:
        mailbox = cm.mailbox
        if not mailbox:
            result = await db.execute(select(Mailbox).where(Mailbox.id == cm.mailbox_id))
            mailbox = result.scalar_one_or_none()
        if not mailbox:
            continue

        # Re-read counters from DB so the previous send's commit is visible
        await db.refresh(mailbox)
        await refresh_mailbox_quota(mailbox)

        if mailbox.status == MailboxStatus.FAILED:
            exhausted.append(f"{mailbox.email} (failed)")
            continue

        remaining = mailbox.daily_limit - mailbox.sent_today
        if remaining > 0:
            note = None
            if exhausted:
                note = (
                    f"Mailbox switch: {', '.join(exhausted)} full today → "
                    f"NOW sending from {mailbox.email} "
                    f"({mailbox.sent_today}/{mailbox.daily_limit}, {remaining} left)"
                )
            return mailbox, note

        exhausted.append(f"{mailbox.email} ({mailbox.sent_today}/{mailbox.daily_limit})")

    return None, None


async def campaign_has_capacity(db: AsyncSession, campaign_id: int) -> bool:
    mailbox, _ = await pick_available_mailbox(db, campaign_id)
    return mailbox is not None


def send_smtp_email(
    mailbox: Mailbox,
    to_email: str,
    subject: str,
    body_html: str,
    body_text: str | None = None,
) -> None:
    msg = MIMEMultipart("alternative")
    msg["From"] = mailbox.email
    msg["To"] = to_email
    msg["Subject"] = Header(subject, "utf-8")

    if body_text:
        msg.attach(MIMEText(body_text, "plain", "utf-8"))
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    if mailbox.use_tls:
        server = smtplib.SMTP(mailbox.smtp_host, mailbox.smtp_port)
        server.starttls()
    else:
        server = smtplib.SMTP_SSL(mailbox.smtp_host, mailbox.smtp_port)

    if mailbox.password:
        server.login(mailbox.email, mailbox.password)
    server.sendmail(
        mailbox.email,
        to_email,
        msg.as_string().encode("utf-8"),
    )
    server.quit()


async def process_single_email(
    db: AsyncSession,
    campaign_lead_id: int,
) -> str:
    result = await db.execute(
        select(CampaignLead)
        .options(
            selectinload(CampaignLead.lead),
            selectinload(CampaignLead.campaign).selectinload(Campaign.template),
        )
        .where(CampaignLead.id == campaign_lead_id)
    )
    cl = result.scalar_one_or_none()
    if not cl or not cl.lead or not cl.lead.email:
        return RESULT_FAILED

    # Already finished — never send again / never overwrite SENT → DUPLICATE
    if cl.status in _TERMINAL_LEAD:
        return RESULT_SKIPPED

    if cl.status not in (CampaignLeadStatus.QUEUED, CampaignLeadStatus.SENDING):
        return RESULT_STOPPED

    lead = cl.lead
    campaign = cl.campaign
    template: EmailTemplate = campaign.template
    email = lead.email.strip().lower()

    # Respect stop/abort that happened while this lead was already queued.
    if campaign.status != CampaignStatus.RUNNING:
        if cl.status in (CampaignLeadStatus.QUEUED, CampaignLeadStatus.SENDING):
            cl.status = CampaignLeadStatus.PENDING
        return RESULT_STOPPED

    if await check_duplicate(db, email):
        cl.status = CampaignLeadStatus.DUPLICATE
        campaign.duplicate_count += 1
        return RESULT_DUPLICATE

    mailbox, switch_note = await pick_available_mailbox(db, campaign.id)
    if not mailbox:
        # Double-check after refresh — never pause if another inbox still has quota
        await refresh_all_mailbox_quotas(db)
        mailbox, switch_note = await pick_available_mailbox(db, campaign.id)

    if not mailbox:
        # ALL campaign mailboxes are at daily limit — keep pending, pause until tomorrow
        cl.status = CampaignLeadStatus.PENDING
        await log_activity(
            db,
            LogType.DAILY_LIMIT_REACHED,
            f"All campaign mailboxes hit daily limit for: {campaign.name}",
            "Only now pausing. Pending leads kept — Resume tomorrow. "
            "Mailbox switches within the day do NOT pause and need no approval.",
        )
        return RESULT_DEFERRED

    if switch_note:
        await log_activity(db, LogType.DAILY_LIMIT_REACHED, switch_note)
        # Stay RUNNING — continue pending on the next mailbox automatically

    cl.mailbox_id = mailbox.id
    cl.status = CampaignLeadStatus.SENDING
    await db.flush()

    subject = personalize_template(template.subject, lead)
    body_html = personalize_template(template.body_html, lead)
    body_text = (
        personalize_template(template.body_text, lead) if template.body_text else None
    )

    try:
        send_smtp_email(mailbox, email, subject, body_html, body_text)

        cl.status = CampaignLeadStatus.SENT
        cl.sent_at = utcnow()
        campaign.sent_count += 1
        mailbox.sent_today += 1
        mailbox.quota_date = date.today()
        lead.last_contacted = utcnow()
        await db.flush()

        just_filled = mailbox.sent_today >= mailbox.daily_limit

        try:
            async with db.begin_nested():
                db.add(
                    SentEmail(
                        lead_id=lead.id,
                        mailbox_id=mailbox.id,
                        campaign_id=campaign.id,
                        company=lead.company,
                        email=email,
                    )
                )
                await db.flush()
        except IntegrityError:
            # Already recorded as sent elsewhere — keep SENT, do not reclassify as duplicate
            pass

        if just_filled:
            await log_activity(
                db,
                LogType.DAILY_LIMIT_REACHED,
                f"{mailbox.email} daily limit complete ({mailbox.sent_today}/{mailbox.daily_limit})",
                "Next campaign mailbox starts on the following email automatically — no Resume.",
            )
            await log_activity(
                db,
                LogType.EMAIL_SENT,
                f"Email sent to {email}",
                f"Campaign: {campaign.name}, Mailbox: {mailbox.email} "
                f"({mailbox.sent_today}/{mailbox.daily_limit} today) — switching inbox",
            )
            return RESULT_SENT_SWITCH

        await log_activity(
            db,
            LogType.EMAIL_SENT,
            f"Email sent to {email}",
            f"Campaign: {campaign.name}, Mailbox: {mailbox.email} "
            f"({mailbox.sent_today}/{mailbox.daily_limit} today)",
        )
        return RESULT_SENT

    except Exception as e:
        cl.status = CampaignLeadStatus.FAILED
        cl.error_message = str(e)
        campaign.failed_count += 1
        mailbox.health_score = max(mailbox.health_score - 5, 0)

        await log_activity(
            db,
            LogType.EMAIL_FAILED,
            f"Failed to send to {email}",
            str(e),
        )
        return RESULT_FAILED


def get_random_delay() -> int:
    return random.choice(settings.delay_list)


def _run_async(coro):
    loop = asyncio.new_event_loop()
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


async def _process_campaign_lead(campaign_lead_id: int) -> str:
    from app.database import async_session

    async with async_session() as db:
        try:
            outcome = await process_single_email(db, campaign_lead_id)
            await db.commit()
            return outcome
        except Exception:
            await db.rollback()
            raise


async def _finalize_campaign(campaign_id: int) -> None:
    from app.database import async_session

    async with async_session() as db:
        try:
            await finalize_campaign_if_done(db, campaign_id)
            await db.commit()
        except Exception:
            await db.rollback()
            raise


async def _check_capacity(campaign_id: int) -> bool:
    from app.database import async_session

    async with async_session() as db:
        return await campaign_has_capacity(db, campaign_id)


async def _requeue_pending(campaign_id: int) -> None:
    """Keep campaign RUNNING and put pending leads back to QUEUED for next mailbox."""
    from app.database import async_session

    async with async_session() as db:
        try:
            result = await db.execute(
                select(Campaign)
                .options(selectinload(Campaign.campaign_leads))
                .where(Campaign.id == campaign_id)
            )
            campaign = result.scalar_one_or_none()
            if not campaign or campaign.status != CampaignStatus.RUNNING:
                return
            for cl in campaign.campaign_leads:
                if cl.status == CampaignLeadStatus.PENDING:
                    cl.status = CampaignLeadStatus.QUEUED
            await log_activity(
                db,
                LogType.CAMPAIGN_STARTED,
                f"Auto-continuing pending on next mailbox: {campaign.name}",
                "No approval needed — same campaign, remaining leads only.",
            )
            await db.commit()
        except Exception:
            await db.rollback()
            raise


async def _claim_next_queued_lead(campaign_id: int) -> int | None:
    """Return next QUEUED lead id, promoting PENDING → QUEUED when needed."""
    from app.database import async_session

    async with async_session() as db:
        try:
            result = await db.execute(
                select(Campaign).where(Campaign.id == campaign_id)
            )
            campaign = result.scalar_one_or_none()
            if not campaign or campaign.status != CampaignStatus.RUNNING:
                return None

            # Prefer already-queued
            queued = (
                await db.execute(
                    select(CampaignLead)
                    .where(
                        CampaignLead.campaign_id == campaign_id,
                        CampaignLead.status == CampaignLeadStatus.QUEUED,
                    )
                    .order_by(CampaignLead.id.asc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            if queued:
                return queued.id

            # Promote pending so mailbox rotation can keep draining
            pending = (
                await db.execute(
                    select(CampaignLead)
                    .where(
                        CampaignLead.campaign_id == campaign_id,
                        CampaignLead.status == CampaignLeadStatus.PENDING,
                    )
                    .order_by(CampaignLead.id.asc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            if not pending:
                return None

            pending.status = CampaignLeadStatus.QUEUED
            await db.commit()
            return pending.id
        except Exception:
            await db.rollback()
            raise


async def _campaign_still_runnable(campaign_id: int) -> tuple[bool, bool]:
    """
    Returns (should_keep_running, has_capacity).
    should_keep_running = campaign RUNNING and has pending/queued work.
    """
    from app.database import async_session

    async with async_session() as db:
        result = await db.execute(
            select(Campaign)
            .options(selectinload(Campaign.campaign_leads))
            .where(Campaign.id == campaign_id)
        )
        campaign = result.scalar_one_or_none()
        if not campaign or campaign.status != CampaignStatus.RUNNING:
            return False, False

        has_work = any(
            cl.status
            in (
                CampaignLeadStatus.PENDING,
                CampaignLeadStatus.QUEUED,
                CampaignLeadStatus.SENDING,
            )
            for cl in campaign.campaign_leads
        )
        if not has_work:
            return False, False

        has_cap = await campaign_has_capacity(db, campaign_id)
        return True, has_cap


def ensure_campaign_worker(campaign_id: int) -> bool:
    """Start queue thread if not already running. Returns True if started/already running."""
    with _queue_lock:
        if campaign_id in _running_queues:
            return True
    # Fire in background thread so callers (API / reconcile) never block
    t = threading.Thread(
        target=run_campaign_queue,
        args=(campaign_id,),
        daemon=True,
        name=f"campaign-queue-{campaign_id}",
    )
    t.start()
    return True


async def reconcile_stuck_running_campaigns(db: AsyncSession) -> list[int]:
    """
    Keep campaigns sending without human Resume:
    - pending + capacity + dead worker → auto-restart (return ids to start)
    - pending + NO capacity → pause until tomorrow
    """
    result = await db.execute(
        select(Campaign)
        .options(
            selectinload(Campaign.campaign_leads),
            selectinload(Campaign.campaign_mailboxes),
        )
        .where(Campaign.status == CampaignStatus.RUNNING)
    )
    campaigns = list(result.scalars().all())
    restart_ids: list[int] = []

    for campaign in campaigns:
        cid = campaign.id
        cname = campaign.name
        pending = [
            cl
            for cl in campaign.campaign_leads
            if cl.status
            in (
                CampaignLeadStatus.PENDING,
                CampaignLeadStatus.QUEUED,
                CampaignLeadStatus.SENDING,
            )
        ]
        if not pending:
            await finalize_campaign_if_done(db, cid)
            continue

        has_cap = await campaign_has_capacity(db, cid)
        queue_alive = cid in _running_queues

        refreshed = await db.execute(
            select(Campaign)
            .options(selectinload(Campaign.campaign_leads))
            .where(Campaign.id == cid)
        )
        campaign = refreshed.scalar_one()

        if not has_cap:
            for cl in campaign.campaign_leads:
                if cl.status in (
                    CampaignLeadStatus.QUEUED,
                    CampaignLeadStatus.SENDING,
                ):
                    cl.status = CampaignLeadStatus.PENDING
            campaign.status = CampaignStatus.PAUSED
            await log_activity(
                db,
                LogType.CAMPAIGN_PAUSED,
                f"Auto-paused: {cname}",
                f"All mailboxes full for today. {len(pending)} pending left — continues tomorrow.",
            )
            continue

        # Capacity remains — keep RUNNING and restart worker if dead
        if not queue_alive:
            for cl in campaign.campaign_leads:
                if cl.status in (
                    CampaignLeadStatus.PENDING,
                    CampaignLeadStatus.SENDING,
                ):
                    cl.status = CampaignLeadStatus.QUEUED
            await log_activity(
                db,
                LogType.CAMPAIGN_STARTED,
                f"Auto-resumed sending: {cname}",
                "Daily target not finished — continuing without Resume click.",
            )
            restart_ids.append(cid)

    await db.flush()
    return restart_ids


async def _pause_for_daily_limit(campaign_id: int) -> None:
    """Leave unfinished leads pending and pause so it can continue tomorrow."""
    from app.database import async_session

    async with async_session() as db:
        try:
            result = await db.execute(
                select(Campaign)
                .options(selectinload(Campaign.campaign_leads))
                .where(Campaign.id == campaign_id)
            )
            campaign = result.scalar_one_or_none()
            if not campaign or campaign.status != CampaignStatus.RUNNING:
                return

            # Safety: if any mailbox still has quota, do NOT pause — keep running
            if await campaign_has_capacity(db, campaign_id):
                for cl in campaign.campaign_leads:
                    if cl.status == CampaignLeadStatus.PENDING:
                        cl.status = CampaignLeadStatus.QUEUED
                await log_activity(
                    db,
                    LogType.CAMPAIGN_STARTED,
                    f"Skipped pause — mailbox capacity still available: {campaign.name}",
                    "Continuing pending leads automatically.",
                )
                await db.commit()
                return

            remaining = 0
            for cl in campaign.campaign_leads:
                if cl.status in (CampaignLeadStatus.QUEUED, CampaignLeadStatus.SENDING):
                    cl.status = CampaignLeadStatus.PENDING
                    remaining += 1
                elif cl.status == CampaignLeadStatus.PENDING:
                    remaining += 1

            campaign.status = CampaignStatus.PAUSED
            await log_activity(
                db,
                LogType.CAMPAIGN_PAUSED,
                f"Daily mailbox limits reached — campaign paused: {campaign.name}",
                f"All selected mailboxes full today. {remaining} emails left — auto-continues when quota resets.",
            )
            await db.commit()
        except Exception:
            await db.rollback()
            raise


def run_campaign_queue(campaign_id: int) -> None:
    """
    Continuously send while campaign is RUNNING, has pending work, and any
    selected mailbox still has today's quota. Auto-switches mailboxes — no Resume.
    """
    with _queue_lock:
        if campaign_id in _running_queues:
            return
        _running_queues.add(campaign_id)

    try:
        idle_rounds = 0
        while True:
            keep_going, has_cap = _run_async(_campaign_still_runnable(campaign_id))
            if not keep_going:
                break

            if not has_cap:
                _run_async(_pause_for_daily_limit(campaign_id))
                break

            lead_id = _run_async(_claim_next_queued_lead(campaign_id))
            if lead_id is None:
                idle_rounds += 1
                if idle_rounds >= 3:
                    break
                time.sleep(0.4)
                continue

            idle_rounds = 0
            outcome = _run_async(_process_campaign_lead(lead_id))

            if outcome == RESULT_DEFERRED:
                # Another mailbox may still have quota — requeue and continue loop
                if _run_async(_check_capacity(campaign_id)):
                    _run_async(_requeue_pending(campaign_id))
                    continue
                _run_async(_pause_for_daily_limit(campaign_id))
                break

            if outcome == RESULT_STOPPED:
                break

            if outcome == RESULT_SENT_SWITCH:
                # This inbox just filled — immediately continue on the next mailbox
                # (no long delay between mailbox handoff)
                time.sleep(1)
                continue

            if outcome == RESULT_SENT:
                time.sleep(min(get_random_delay(), 12))
                continue

            # skipped / duplicate / failed → immediately next lead
            continue

        _run_async(_finalize_campaign(campaign_id))
    finally:
        with _queue_lock:
            _running_queues.discard(campaign_id)
        # If work + capacity remain, continue automatically (no Resume)
        try:
            keep_going, has_cap = _run_async(_campaign_still_runnable(campaign_id))
            if keep_going and has_cap:
                time.sleep(0.5)
                ensure_campaign_worker(campaign_id)
            elif keep_going and not has_cap:
                _run_async(_pause_for_daily_limit(campaign_id))
            else:
                _run_async(_reconcile_one(campaign_id))
        except Exception:
            try:
                _run_async(_reconcile_one(campaign_id))
            except Exception:
                pass


async def _reconcile_one(campaign_id: int) -> None:
    from app.database import async_session

    async with async_session() as db:
        try:
            restart = await reconcile_stuck_running_campaigns(db)
            await db.commit()
            for cid in restart:
                ensure_campaign_worker(cid)
        except Exception:
            await db.rollback()
            raise


async def finalize_campaign_if_done(db: AsyncSession, campaign_id: int) -> None:
    campaign_result = await db.execute(
        select(Campaign).where(Campaign.id == campaign_id)
    )
    campaign = campaign_result.scalar_one_or_none()
    if not campaign:
        return

    # Do not override pause/abort decisions.
    if campaign.status in (CampaignStatus.PAUSED, CampaignStatus.ABORTED):
        return

    result = await db.execute(
        select(CampaignLead).where(CampaignLead.campaign_id == campaign_id)
    )
    leads = result.scalars().all()

    terminal = {
        CampaignLeadStatus.SENT,
        CampaignLeadStatus.FAILED,
        CampaignLeadStatus.SKIPPED,
        CampaignLeadStatus.DUPLICATE,
        CampaignLeadStatus.BOUNCED,
    }
    if leads and all(cl.status in terminal for cl in leads):
        campaign.status = CampaignStatus.COMPLETED
        campaign.completed_at = utcnow()
        await log_activity(
            db,
            LogType.CAMPAIGN_FINISHED,
            f"Campaign completed: {campaign.name}",
            f"Sent: {campaign.sent_count}, Failed: {campaign.failed_count}",
        )
