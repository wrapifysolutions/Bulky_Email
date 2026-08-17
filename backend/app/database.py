import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


def _engine_kwargs() -> dict:
    kwargs: dict = {
        "echo": False,
        "pool_pre_ping": True,
    }
    if settings.database_url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    elif "postgresql" in settings.database_url:
        # Serverless: avoid holding many idle connections.
        kwargs["pool_size"] = 1
        kwargs["max_overflow"] = 0
    if os.getenv("VERCEL"):
        kwargs["pool_recycle"] = 300
    return kwargs


engine = create_async_engine(settings.database_url, **_engine_kwargs())
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
