from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import EmailTemplate
from app.schemas import TemplateCreate, TemplateResponse, TemplateUpdate, MessageResponse

router = APIRouter(prefix="/templates", tags=["Templates"])


@router.get("", response_model=list[TemplateResponse])
async def list_templates(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(EmailTemplate).order_by(EmailTemplate.id))
    return result.scalars().all()


@router.post("", response_model=TemplateResponse, status_code=201)
async def create_template(data: TemplateCreate, db: AsyncSession = Depends(get_db)):
    template = EmailTemplate(**data.model_dump())
    db.add(template)
    await db.flush()
    await db.refresh(template)
    return template


@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EmailTemplate).where(EmailTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


@router.patch("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: int, data: TemplateUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(EmailTemplate).where(EmailTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(template, key, value)
    await db.flush()
    await db.refresh(template)
    return template


@router.delete("/{template_id}", response_model=MessageResponse)
async def delete_template(template_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EmailTemplate).where(EmailTemplate.id == template_id)
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(template)
    return MessageResponse(message="Template deleted")
