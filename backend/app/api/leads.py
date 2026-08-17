from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from io import BytesIO
from sqlalchemy import delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import CampaignLead, Lead, LeadStatus, SentEmail
from app.schemas import (
    CsvUploadResponse,
    LeadCreate,
    LeadFilter,
    LeadGenerateRequest,
    LeadResponse,
    MessageResponse,
)
from app.services.csv_service import export_leads_to_excel, export_sent_leads, process_csv_upload
from app.services.crawler_service import generate_leads_from_urls
from app.services.common import is_valid_email

router = APIRouter(prefix="/leads", tags=["Leads"])


@router.get("", response_model=list[LeadResponse])
async def list_leads(
    country: str | None = None,
    industry: str | None = None,
    has_email: bool | None = None,
    sent: bool | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    query = select(Lead)

    if country:
        query = query.where(Lead.country.ilike(f"%{country}%"))
    if industry:
        query = query.where(Lead.industry.ilike(f"%{industry}%"))
    if has_email is True:
        query = query.where(Lead.email.isnot(None))
    elif has_email is False:
        query = query.where(Lead.email.is_(None))
    if search:
        query = query.where(
            or_(
                Lead.company.ilike(f"%{search}%"),
                Lead.email.ilike(f"%{search}%"),
                Lead.website.ilike(f"%{search}%"),
                Lead.phone.ilike(f"%{search}%"),
            )
        )
    if sent is True:
        sent_emails = select(SentEmail.email)
        query = query.where(Lead.email.in_(sent_emails))
    elif sent is False:
        sent_emails = select(SentEmail.email)
        query = query.where(
            or_(Lead.email.is_(None), Lead.email.notin_(sent_emails))
        )

    query = query.order_by(Lead.id.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=LeadResponse, status_code=201)
async def create_lead(data: LeadCreate, db: AsyncSession = Depends(get_db)):
    email = (data.email or "").strip().lower() or None
    phone = (data.phone or "").strip() or None

    if not email and not phone:
        raise HTTPException(status_code=400, detail="Provide at least an email or phone number")

    if email:
        if not is_valid_email(email):
            raise HTTPException(status_code=400, detail="Invalid email address")
        existing = await db.execute(select(Lead).where(Lead.email == email))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Lead with this email already exists")
        status = LeadStatus.VALID
    else:
        status = LeadStatus.NO_EMAIL

    lead = Lead(
        email=email,
        company=data.company,
        first_name=data.first_name,
        last_name=data.last_name,
        website=data.website,
        phone=phone,
        country=data.country,
        industry=data.industry,
        status=status,
    )
    db.add(lead)
    await db.flush()
    await db.refresh(lead)
    return lead


@router.post("/upload", response_model=CsvUploadResponse)
async def upload_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    allowed = (".csv", ".xlsx", ".xls")
    if not file.filename.lower().endswith(allowed):
        raise HTTPException(status_code=400, detail="File must be CSV or Excel")

    content = await file.read()
    try:
        upload = await process_csv_upload(db, content, file.filename)
        return upload
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/generate", response_model=list[LeadResponse])
async def generate_leads(
    data: LeadGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    leads = await generate_leads_from_urls(db, data.urls)
    return leads


@router.get("/export/csv")
async def export_csv(db: AsyncSession = Depends(get_db)):
    content = await export_leads_to_excel(db)
    return StreamingResponse(
        BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=leads.xlsx"},
    )


@router.get("/export/sent")
async def export_sent(campaign_id: int | None = None, db: AsyncSession = Depends(get_db)):
    content = await export_sent_leads(db, campaign_id)
    return StreamingResponse(
        BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=sent_leads.xlsx"},
    )


@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(lead_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    return lead


@router.delete("/{lead_id}", response_model=MessageResponse)
async def delete_lead(lead_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    await db.execute(delete(CampaignLead).where(CampaignLead.lead_id == lead_id))
    await db.execute(
        update(SentEmail).where(SentEmail.lead_id == lead_id).values(lead_id=None)
    )
    await db.delete(lead)
    return MessageResponse(message="Lead deleted")
