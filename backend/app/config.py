from pydantic_settings import BaseSettings


def _normalize_database_urls(async_url: str, sync_url: str) -> tuple[str, str]:
    """Render/Neon often give postgres:// — SQLAlchemy needs postgresql:// (+asyncpg)."""
    async_url = async_url.strip()
    sync_url = sync_url.strip()

    if async_url.startswith("postgres://"):
        async_url = "postgresql://" + async_url[len("postgres://") :]
    if sync_url.startswith("postgres://"):
        sync_url = "postgresql://" + sync_url[len("postgres://") :]

    # If only one URL was set (common on Render), derive the other
    if async_url.startswith("postgresql://") and "+asyncpg" not in async_url:
        # Keep sync as plain postgresql; make async use asyncpg
        if sync_url.startswith("sqlite"):
            sync_url = async_url
        async_url = async_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif async_url.startswith("postgresql+asyncpg://") and sync_url.startswith("sqlite"):
        sync_url = async_url.replace("postgresql+asyncpg://", "postgresql://", 1)

    return async_url, sync_url


class Settings(BaseSettings):
    database_url: str = "sqlite+aiosqlite:///./bulkyy.db"
    database_url_sync: str = "sqlite:///./bulkyy.db"
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"
    secret_key: str = "change-me-in-production"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    default_daily_limit: int = 15
    send_delays: str = "30,60,90,120"
    upload_dir: str = "uploads"

    def model_post_init(self, __context) -> None:
        self.database_url, self.database_url_sync = _normalize_database_urls(
            self.database_url, self.database_url_sync
        )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def delay_list(self) -> list[int]:
        return [int(d.strip()) for d in self.send_delays.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
