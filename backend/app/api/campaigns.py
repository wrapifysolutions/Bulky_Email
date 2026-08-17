from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import Campaign, CampaignLead, CampaignLeadStatus, CampaignMailbox, SentEmail
from app.schemas import (
    CampaignCreate,
    CampaignMailboxInfo,
    CampaignMailboxesUpdate,
    CampaignReport,
    CampaignResponse,
    MessageResponse,
)
from app.services.campaign_service import (
    abort_campaign,
    create_campaign,
    ensure_campaign_worker,
    pause_campaign,
    reconcile_stuck_running_campaigns,
    run_campaign_queue,
    set_campaign_mailboxes,
    start_campaign,
)
from app.services.common import refresh_mailbox_quota

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])


async def _to_campaign_response(db: AsyncSession, campaign: Campaign) -> CampaignResponse:
    mailbox_infos: list[CampaignMailboxInfo] = []
    for cm in sorted(campaign.campaign_mailboxes, key=lambda x: x.id):
        mb = cm.mailbox
        if not mb:
            continue
        await refresh_mailbox_quota(mb)
        remaining = max(mb.daily_limit - mb.sent_today, 0)
        mailbox_infos.append(
            CampaignMailboxInfo(
                id=mb.id,
                email=mb.email,
                daily_limit=mb.daily_limit,
                sent_today=mb.sent_today,
                remaining_today=remaining,
                status=mb.status.value if hasattr(mb.status, "value") else str(mb.status),
            )
        )

    remaining_leads = sum(
        1
        for cl in campaign.campaign_leads
        if cl.status
        in (
            CampaignLeadStatus.PENDING,
            CampaignLeadStatus.QUEUED,
            CampaignLeadStatus.SENDING,
        )
    )

    return CampaignResponse(
        id=campaign.id,
        name=campaign.name,
        template_id=campaign.template_id,
        status=campaign.status,
        total_leads=campaign.total_leads,
        sent_count=campaign.sent_count,
        failed_count=campaign.failed_count,
        skipped_count=campaign.skipped_count,
        duplicate_count=campaign.duplicate_count,
        bounce_count=campaign.bounce_count,
        started_at=campaign.started_at,
        completed_at=campaign.completed_at,
        created_at=campaign.created_at,
        mailboxes=mailbox_infos,
        remaining_leads=remaining_leads,
    )


async def _load_campaign(db: AsyncSession, campaign_id: int) -> Campaign | None:
    result = await db.execute(
        select(Campaign)
        .options(
            selectinload(Campaign.campaign_mailboxes).selectinload(CampaignMailbox.mailbox),
            selectinload(Campaign.campaign_leads),
        )
        .where(Campaign.id == campaign_id)
    )
    return result.scalar_one_or_none()


@router.get("", response_model=list[CampaignResponse])
async def list_campaigns(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    # Auto-continue: restart dead workers if daily capacity remains (no Resume click)
    restart_ids = await reconcile_stuck_running_campaigns(db)
    for cid in restart_ids:
        background_tasks.add_task(run_campaign_queue, cid)

    result = await db.execute(
        select(Campaign)
        .options(
            selectinload(Campaign.campaign_mailboxes).selectinload(CampaignMailbox.mailbox),
            selectinload(Campaign.campaign_leads),
        )
        .order_by(Campaign.id.desc())
    )
    campaigns = result.scalars().all()
    return [await _to_campaign_response(db, c) for c in campaigns]


@router.post("", response_model=CampaignResponse, status_code=201)
async def create_new_campaign(
    data: CampaignCreate, db: AsyncSession = Depends(get_db)
):
    try:
        campaign = await create_campaign(
            db,
            name=data.name,
            template_id=data.template_id,
            mailbox_ids=data.mailbox_ids,
            csv_upload_id=data.csv_upload_id,
            lead_ids=data.lead_ids,
        )
        await db.flush()
        loaded = await _load_campaign(db, campaign.id)
        return await _to_campaign_response(db, loaded)  # type: ignore[arg-type]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: int, db: AsyncSession = Depends(get_db)):
    campaign = await _load_campaign(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return await _to_campaign_response(db, campaign)


@router.post("/{campaign_id}/start", response_model=CampaignResponse)
async def start_campaign_endpoint(
    campaign_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    try:
        await start_campaign(db, campaign_id)
        # Prefer dedicated worker thread so send continues even if request ends
        ensure_campaign_worker(campaign_id)
        loaded = await _load_campaign(db, campaign_id)
        return await _to_campaign_response(db, loaded)  # type: ignore[arg-type]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{campaign_id}/mailboxes", response_model=CampaignResponse)
async def update_campaign_mailboxes(
    campaign_id: int,
    data: CampaignMailboxesUpdate,
    db: AsyncSession = Depends(get_db),
):
    try:
        await set_campaign_mailboxes(db, campaign_id, data.mailbox_ids)
        loaded = await _load_campaign(db, campaign_id)
        return await _to_campaign_response(db, loaded)  # type: ignore[arg-type]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{campaign_id}/stop", response_model=CampaignResponse)
async def stop_campaign_endpoint(
    campaign_id: int, db: AsyncSession = Depends(get_db)
):
    try:
        await pause_campaign(db, campaign_id)
        loaded = await _load_campaign(db, campaign_id)
        return await _to_campaign_response(db, loaded)  # type: ignore[arg-type]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{campaign_id}/abort", response_model=CampaignResponse)
async def abort_campaign_endpoint(
    campaign_id: int, db: AsyncSession = Depends(get_db)
):
    try:
        await abort_campaign(db, campaign_id)
        loaded = await _load_campaign(db, campaign_id)
        return await _to_campaign_response(db, loaded)  # type: ignore[arg-type]
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{campaign_id}/report", response_model=CampaignReport)
async def campaign_report(campaign_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    remaining = (
        await db.execute(
            select(CampaignLead).where(
                CampaignLead.campaign_id == campaign_id,
                CampaignLead.status.in_(
                    [CampaignLeadStatus.PENDING, CampaignLeadStatus.QUEUED]
                ),
            )
        )
    )
    remaining_count = len(remaining.scalars().all())

    return CampaignReport(
        uploaded_leads=campaign.total_leads,
        sent=campaign.sent_count,
        remaining=remaining_count,
        skipped=campaign.skipped_count,
        failed=campaign.failed_count,
        bounce=campaign.bounce_count,
        duplicates=campaign.duplicate_count,
    )


@router.delete("/{campaign_id}", response_model=MessageResponse)
async def delete_campaign(campaign_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Campaign).where(Campaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    await db.execute(
        delete(CampaignMailbox).where(CampaignMailbox.campaign_id == campaign_id)
    )
    await db.execute(delete(CampaignLead).where(CampaignLead.campaign_id == campaign_id))
    await db.execute(
        update(SentEmail)
        .where(SentEmail.campaign_id == campaign_id)
        .values(campaign_id=None)
    )
    await db.delete(campaign)
    return MessageResponse(message="Campaign deleted")
