from datetime import datetime
from enum import Enum

from pydantic import BaseModel, EmailStr, Field


class MailboxStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    FAILED = "failed"
    WARMING = "warming"


class WarmupStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class CampaignLeadStatus(str, Enum):
    PENDING = "pending"
    QUEUED = "queued"
    SENDING = "sending"
    SENT = "sent"
    FAILED = "failed"
    BOUNCED = "bounced"
    SKIPPED = "skipped"
    DUPLICATE = "duplicate"


class CampaignStatus(str, Enum):
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    ABORTED = "aborted"


# Mailbox schemas
class MailboxCreate(BaseModel):
    email: EmailStr
    smtp_host: str
    smtp_port: int = 587
    imap_host: str | None = None
    imap_port: int = 993
    password: str | None = None
    oauth_token: str | None = None
    use_tls: bool = True
    daily_limit: int = 15


class MailboxUpdate(BaseModel):
    smtp_host: str | None = None
    smtp_port: int | None = None
    imap_host: str | None = None
    imap_port: int | None = None
    password: str | None = None
    daily_limit: int | None = None
    status: MailboxStatus | None = None


class MailboxResponse(BaseModel):
    id: int
    email: str
    smtp_host: str
    smtp_port: int
    imap_host: str | None
    imap_port: int | None
    use_tls: bool
    daily_limit: int
    sent_today: int
    status: MailboxStatus
    health_score: float
    warmup_status: WarmupStatus
    created_at: datetime

    model_config = {"from_attributes": True}


# Template schemas
class TemplateCreate(BaseModel):
    name: str
    subject: str
    body_html: str
    body_text: str | None = None
    category: str | None = None


class TemplateUpdate(BaseModel):
    name: str | None = None
    subject: str | None = None
    body_html: str | None = None
    body_text: str | None = None
    category: str | None = None


class TemplateResponse(BaseModel):
    id: int
    name: str
    subject: str
    body_html: str
    body_text: str | None
    category: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# Lead schemas
class LeadResponse(BaseModel):
    id: int
    company: str | None
    email: str | None
    first_name: str | None
    last_name: str | None
    website: str | None
    phone: str | None
    country: str | None
    industry: str | None
    linkedin: str | None
    status: str
    last_contacted: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class LeadFilter(BaseModel):
    country: str | None = None
    industry: str | None = None
    has_email: bool | None = None
    sent: bool | None = None
    search: str | None = None
    skip: int = 0
    limit: int = 50


class LeadCreate(BaseModel):
    email: str | None = None
    company: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    website: str | None = None
    phone: str | None = None
    country: str | None = None
    industry: str | None = None


class LeadGenerateRequest(BaseModel):
    urls: list[str] = Field(..., min_length=1)


class CsvUploadResponse(BaseModel):
    id: int
    filename: str
    original_filename: str
    total_rows: int
    valid_rows: int
    duplicate_rows: int
    invalid_rows: int
    created_at: datetime

    model_config = {"from_attributes": True}


# Campaign schemas
class CampaignCreate(BaseModel):
    name: str
    template_id: int
    csv_upload_id: int | None = None
    lead_ids: list[int] | None = None
    mailbox_ids: list[int]


class CampaignMailboxesUpdate(BaseModel):
    mailbox_ids: list[int]


class CampaignMailboxInfo(BaseModel):
    id: int
    email: str
    daily_limit: int
    sent_today: int
    remaining_today: int
    status: str


class CampaignResponse(BaseModel):
    id: int
    name: str
    template_id: int
    status: CampaignStatus
    total_leads: int
    sent_count: int
    failed_count: int
    skipped_count: int
    duplicate_count: int
    bounce_count: int
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    mailboxes: list[CampaignMailboxInfo] = []
    remaining_leads: int = 0

    model_config = {"from_attributes": True}


class CampaignReport(BaseModel):
    uploaded_leads: int
    sent: int
    remaining: int
    skipped: int
    failed: int
    bounce: int
    duplicates: int


# Dashboard
class MailboxUsageStat(BaseModel):
    id: int
    email: str
    sent_today: int
    daily_limit: int
    remaining_today: int
    status: str
    health_score: float


class NamedCount(BaseModel):
    name: str
    count: int


class DashboardStats(BaseModel):
    total_mailboxes: int
    active_mailboxes: int
    emails_sent_today: int
    emails_remaining: int
    campaigns_running: int
    csv_uploaded: int
    total_leads: int
    valid_emails: int
    failed_emails: int
    bounce_rate: float
    total_sent_all_time: int = 0
    daily_capacity: int = 0
    mailbox_usage: list[MailboxUsageStat] = []
    lead_breakdown: list[NamedCount] = []
    campaign_breakdown: list[NamedCount] = []


# Activity log
class ActivityLogResponse(BaseModel):
    id: int
    log_type: str
    message: str
    details: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# Generic
class MessageResponse(BaseModel):
    message: str
    detail: str | None = None
