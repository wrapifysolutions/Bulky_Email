from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import ActivityLog
from app.schemas import ActivityLogResponse, DashboardStats
from app.services.common import get_dashboard_stats

router = APIRouter(tags=["Dashboard"])


@router.get("/dashboard", response_model=DashboardStats)
async def dashboard(db: AsyncSession = Depends(get_db)):
    return await get_dashboard_stats(db)


@router.get("/logs", response_model=list[ActivityLogResponse])
async def activity_logs(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ActivityLog).order_by(ActivityLog.id.desc()).offset(skip).limit(limit)
    )
    return result.scalars().all()
