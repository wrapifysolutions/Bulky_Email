from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import CampaignLead, CampaignMailbox, Mailbox, SentEmail
from app.schemas import MailboxCreate, MailboxResponse, MailboxUpdate, MessageResponse

router = APIRouter(prefix="/mailboxes", tags=["Mailboxes"])


@router.get("", response_model=list[MailboxResponse])
async def list_mailboxes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Mailbox).order_by(Mailbox.id))
    return result.scalars().all()


@router.post("", response_model=MailboxResponse, status_code=201)
async def create_mailbox(data: MailboxCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Mailbox).where(Mailbox.email == data.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Mailbox already exists")

    mailbox = Mailbox(**data.model_dump())
    db.add(mailbox)
    await db.flush()
    await db.refresh(mailbox)
    return mailbox


@router.get("/{mailbox_id}", response_model=MailboxResponse)
async def get_mailbox(mailbox_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Mailbox).where(Mailbox.id == mailbox_id))
    mailbox = result.scalar_one_or_none()
    if not mailbox:
        raise HTTPException(status_code=404, detail="Mailbox not found")
    return mailbox


@router.patch("/{mailbox_id}", response_model=MailboxResponse)
async def update_mailbox(
    mailbox_id: int, data: MailboxUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Mailbox).where(Mailbox.id == mailbox_id))
    mailbox = result.scalar_one_or_none()
    if not mailbox:
        raise HTTPException(status_code=404, detail="Mailbox not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(mailbox, key, value)
    await db.flush()
    await db.refresh(mailbox)
    return mailbox


@router.delete("/{mailbox_id}", response_model=MessageResponse)
async def delete_mailbox(mailbox_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Mailbox).where(Mailbox.id == mailbox_id))
    mailbox = result.scalar_one_or_none()
    if not mailbox:
        raise HTTPException(status_code=404, detail="Mailbox not found")

    # Clear FK links first — SQLite will not null non-nullable campaign_mailboxes.mailbox_id
    await db.execute(
        delete(CampaignMailbox).where(CampaignMailbox.mailbox_id == mailbox_id)
    )
    await db.execute(
        update(CampaignLead)
        .where(CampaignLead.mailbox_id == mailbox_id)
        .values(mailbox_id=None)
    )
    await db.execute(
        update(SentEmail)
        .where(SentEmail.mailbox_id == mailbox_id)
        .values(mailbox_id=None)
    )
    await db.delete(mailbox)
    return MessageResponse(message="Mailbox deleted")
