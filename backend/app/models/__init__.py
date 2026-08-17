import enum
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MailboxStatus(str, enum.Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    FAILED = "failed"
    WARMING = "warming"


class WarmupStatus(str, enum.Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class LeadStatus(str, enum.Enum):
    NEW = "new"
    VALID = "valid"
    INVALID = "invalid"
    NO_EMAIL = "no_email"


class CampaignLeadStatus(str, enum.Enum):
    PENDING = "pending"
    QUEUED = "queued"
    SENDING = "sending"
    SENT = "sent"
    FAILED = "failed"
    BOUNCED = "bounced"
    SKIPPED = "skipped"
    DUPLICATE = "duplicate"


class CampaignStatus(str, enum.Enum):
    DRAFT = "draft"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    ABORTED = "aborted"


class LogType(str, enum.Enum):
    CAMPAIGN_STARTED = "campaign_started"
    CAMPAIGN_FINISHED = "campaign_finished"
    CAMPAIGN_PAUSED = "campaign_paused"
    CAMPAIGN_ABORTED = "campaign_aborted"
    MAILBOX_CONNECTED = "mailbox_connected"
    MAILBOX_FAILED = "mailbox_failed"
    EMAIL_SENT = "email_sent"
    EMAIL_FAILED = "email_failed"
    CSV_UPLOADED = "csv_uploaded"
    LEAD_GENERATED = "lead_generated"
    DAILY_LIMIT_REACHED = "daily_limit_reached"


class Mailbox(Base):
    __tablename__ = "mailboxes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    smtp_host: Mapped[str] = mapped_column(String(255), nullable=False)
    smtp_port: Mapped[int] = mapped_column(Integer, default=587)
    imap_host: Mapped[str | None] = mapped_column(String(255))
    imap_port: Mapped[int | None] = mapped_column(Integer, default=993)
    password: Mapped[str | None] = mapped_column(String(500))
    oauth_token: Mapped[str | None] = mapped_column(Text)
    use_tls: Mapped[bool] = mapped_column(Boolean, default=True)
    daily_limit: Mapped[int] = mapped_column(Integer, default=15)
    sent_today: Mapped[int] = mapped_column(Integer, default=0)
    # Calendar day that sent_today belongs to (auto-resets next day).
    quota_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[MailboxStatus] = mapped_column(
        Enum(MailboxStatus), default=MailboxStatus.ACTIVE
    )
    health_score: Mapped[float] = mapped_column(Float, default=100.0)
    warmup_status: Mapped[WarmupStatus] = mapped_column(
        Enum(WarmupStatus), default=WarmupStatus.NOT_STARTED
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    campaign_mailboxes: Mapped[list["CampaignMailbox"]] = relationship(back_populates="mailbox")
    sent_emails: Mapped[list["SentEmail"]] = relationship(back_populates="mailbox")


class EmailTemplate(Base):
    __tablename__ = "email_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body_html: Mapped[str] = mapped_column(Text, nullable=False)
    body_text: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    campaigns: Mapped[list["Campaign"]] = relationship(back_populates="template")


class Lead(Base):
    __tablename__ = "leads"
    __table_args__ = (UniqueConstraint("email", name="uq_lead_email"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    company: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255), index=True)
    first_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    website: Mapped[str | None] = mapped_column(String(500))
    phone: Mapped[str | None] = mapped_column(String(50))
    country: Mapped[str | None] = mapped_column(String(100))
    industry: Mapped[str | None] = mapped_column(String(100))
    linkedin: Mapped[str | None] = mapped_column(String(500))
    facebook: Mapped[str | None] = mapped_column(String(500))
    instagram: Mapped[str | None] = mapped_column(String(500))
    contact_page: Mapped[str | None] = mapped_column(String(500))
    address: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[LeadStatus] = mapped_column(Enum(LeadStatus), default=LeadStatus.NEW)
    last_contacted: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    campaign_leads: Mapped[list["CampaignLead"]] = relationship(back_populates="lead")
    sent_emails: Mapped[list["SentEmail"]] = relationship(back_populates="lead")


class CsvUpload(Base):
    __tablename__ = "csv_uploads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    total_rows: Mapped[int] = mapped_column(Integer, default=0)
    valid_rows: Mapped[int] = mapped_column(Integer, default=0)
    duplicate_rows: Mapped[int] = mapped_column(Integer, default=0)
    invalid_rows: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    template_id: Mapped[int] = mapped_column(ForeignKey("email_templates.id"), nullable=False)
    csv_upload_id: Mapped[int | None] = mapped_column(ForeignKey("csv_uploads.id"))
    status: Mapped[CampaignStatus] = mapped_column(
        Enum(CampaignStatus), default=CampaignStatus.DRAFT
    )
    total_leads: Mapped[int] = mapped_column(Integer, default=0)
    sent_count: Mapped[int] = mapped_column(Integer, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, default=0)
    duplicate_count: Mapped[int] = mapped_column(Integer, default=0)
    bounce_count: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    template: Mapped["EmailTemplate"] = relationship(back_populates="campaigns")
    csv_upload: Mapped["CsvUpload | None"] = relationship()
    campaign_mailboxes: Mapped[list["CampaignMailbox"]] = relationship(
        back_populates="campaign", cascade="all, delete-orphan"
    )
    campaign_leads: Mapped[list["CampaignLead"]] = relationship(
        back_populates="campaign", cascade="all, delete-orphan"
    )


class CampaignMailbox(Base):
    __tablename__ = "campaign_mailboxes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.id"), nullable=False)
    mailbox_id: Mapped[int] = mapped_column(ForeignKey("mailboxes.id"), nullable=False)

    campaign: Mapped["Campaign"] = relationship(back_populates="campaign_mailboxes")
    mailbox: Mapped["Mailbox"] = relationship(back_populates="campaign_mailboxes")


class CampaignLead(Base):
    __tablename__ = "campaign_leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.id"), nullable=False)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), nullable=False)
    mailbox_id: Mapped[int | None] = mapped_column(ForeignKey("mailboxes.id"))
    status: Mapped[CampaignLeadStatus] = mapped_column(
        Enum(CampaignLeadStatus), default=CampaignLeadStatus.PENDING
    )
    error_message: Mapped[str | None] = mapped_column(Text)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    campaign: Mapped["Campaign"] = relationship(back_populates="campaign_leads")
    lead: Mapped["Lead"] = relationship(back_populates="campaign_leads")
    mailbox: Mapped["Mailbox | None"] = relationship()


class SentEmail(Base):
    __tablename__ = "sent_emails"
    __table_args__ = (UniqueConstraint("email", name="uq_sent_email"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id"))
    mailbox_id: Mapped[int | None] = mapped_column(ForeignKey("mailboxes.id"))
    campaign_id: Mapped[int | None] = mapped_column(ForeignKey("campaigns.id"))
    company: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    sent_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    lead: Mapped["Lead | None"] = relationship(back_populates="sent_emails")
    mailbox: Mapped["Mailbox | None"] = relationship(back_populates="sent_emails")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    log_type: Mapped[LogType] = mapped_column(Enum(LogType), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    details: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
