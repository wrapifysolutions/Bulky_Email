import os
import re
import uuid
from io import BytesIO

import pandas as pd
from email_validator import EmailNotValidError, validate_email
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import CsvUpload, Lead, LeadStatus, LogType, SentEmail
from app.services.common import is_valid_email, log_activity

EMAIL_IN_TEXT = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
)

COLUMN_MAP = {
    "company": "company",
    "company name": "company",
    "company_name": "company",
    "organisation": "company",
    "organization": "company",
    "business": "company",
    "client": "company",
    "email": "email",
    "e-mail": "email",
    "email address": "email",
    "email_address": "email",
    "mail": "email",
    "first name": "first_name",
    "firstname": "first_name",
    "first_name": "first_name",
    "last name": "last_name",
    "lastname": "last_name",
    "last_name": "last_name",
    "name": "first_name",
    "full name": "first_name",
    "contact": "first_name",
    "contact name": "first_name",
    "website": "website",
    "web": "website",
    "url": "website",
    "phone": "phone",
    "phone number": "phone",
    "phonenumber": "phone",
    "phone_number": "phone",
    "mobile": "phone",
    "mobile number": "phone",
    "telephone": "phone",
    "tel": "phone",
    "country": "country",
    "industry": "industry",
    "category": "industry",
    "notes / source": "source_url",
    "notes/source": "source_url",
    "notes": "address",
    "source": "source_url",
    "remarks": "address",
    "remark": "address",
}


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    cleaned = []
    for c in df.columns:
        name = str(c).replace("\ufeff", "").strip().lower()
        name = re.sub(r"\s+", " ", name)
        cleaned.append(name)
    df = df.copy()
    df.columns = cleaned
    rename = {col: COLUMN_MAP[col] for col in df.columns if col in COLUMN_MAP}
    return df.rename(columns=rename)


def _read_tabular(file_content: bytes, original_filename: str) -> pd.DataFrame:
    lower = original_filename.lower()
    if lower.endswith((".xlsx", ".xls")):
        return pd.read_excel(BytesIO(file_content))

    try:
        return pd.read_csv(
            BytesIO(file_content),
            encoding="utf-8-sig",
            sep=None,
            engine="python",
        )
    except Exception:
        return pd.read_csv(BytesIO(file_content), encoding="latin-1")


def _validate_email_address(email: str) -> bool:
    try:
        validate_email(email, check_deliverability=False)
        return is_valid_email(email)
    except EmailNotValidError:
        return False


def _extract_email_from_row(row: pd.Series) -> str | None:
    """Prefer dedicated email column, else scan every cell for an email address."""
    direct = _safe_str(row.get("email") if "email" in row.index else None)
    if direct and _validate_email_address(direct.lower()):
        return direct.lower()

    for value in row.values:
        text = _safe_str(value)
        if not text:
            continue
        match = EMAIL_IN_TEXT.search(text)
        if match:
            candidate = match.group(0).lower()
            if _validate_email_address(candidate):
                return candidate
    return None


async def _email_already_sent(db: AsyncSession, email: str) -> bool:
    result = await db.execute(select(SentEmail).where(SentEmail.email == email.lower()))
    return result.scalar_one_or_none() is not None


async def _lead_exists(db: AsyncSession, email: str) -> Lead | None:
    result = await db.execute(select(Lead).where(Lead.email == email.lower()))
    return result.scalar_one_or_none()


async def _lead_exists_by_phone(db: AsyncSession, phone: str) -> Lead | None:
    result = await db.execute(select(Lead).where(Lead.phone == phone))
    return result.scalar_one_or_none()


async def process_csv_upload(
    db: AsyncSession,
    file_content: bytes,
    original_filename: str,
) -> CsvUpload:
    """
    Flexible import: maps common Excel headers (phone number, country, category,
    notes / source, remarks, …). Email can be its own column or found inside notes.
    Company is optional. Phone-only rows are kept as no_email leads.
    """
    os.makedirs(settings.upload_dir, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}_{original_filename}"
    filepath = os.path.join(settings.upload_dir, stored_name)

    with open(filepath, "wb") as f:
        f.write(file_content)

    df = _normalize_columns(_read_tabular(file_content, original_filename))

    if df.empty:
        raise ValueError("File is empty — no rows to import")

    upload = CsvUpload(
        filename=stored_name,
        original_filename=original_filename,
        total_rows=len(df),
    )
    db.add(upload)
    await db.flush()

    valid = duplicate = invalid = 0

    for _, row in df.iterrows():
        email_raw = _extract_email_from_row(row)
        phone = _safe_str(row.get("phone") if "phone" in row.index else None)
        company = _safe_str(row.get("company") if "company" in row.index else None)
        industry = _safe_str(row.get("industry") if "industry" in row.index else None)
        country = _safe_str(row.get("country") if "country" in row.index else None)
        first_name = _safe_str(row.get("first_name") if "first_name" in row.index else None)
        last_name = _safe_str(row.get("last_name") if "last_name" in row.index else None)
        website = _safe_str(row.get("website") if "website" in row.index else None)
        source_url = _safe_str(row.get("source_url") if "source_url" in row.index else None)
        address = _safe_str(row.get("address") if "address" in row.index else None)

        if not company and industry:
            company = industry

        # Skip completely empty rows
        if not email_raw and not phone and not company and not first_name:
            invalid += 1
            continue

        if email_raw:
            if await _email_already_sent(db, email_raw):
                duplicate += 1
                continue
            existing = await _lead_exists(db, email_raw)
            if existing:
                duplicate += 1
                continue
            status = LeadStatus.VALID
        else:
            # Phone / contact without email — still import, not usable for sending yet
            if phone:
                existing_phone = await _lead_exists_by_phone(db, phone)
                if existing_phone:
                    duplicate += 1
                    continue
            status = LeadStatus.NO_EMAIL

        lead = Lead(
            company=company,
            email=email_raw,
            first_name=first_name,
            last_name=last_name,
            website=website,
            phone=phone,
            country=country,
            industry=industry,
            source_url=source_url,
            address=address,
            status=status,
        )
        db.add(lead)
        valid += 1

    upload.valid_rows = valid
    upload.duplicate_rows = duplicate
    upload.invalid_rows = invalid

    await log_activity(
        db,
        LogType.CSV_UPLOADED,
        f"CSV/Excel uploaded: {original_filename}",
        f"Imported: {valid}, Duplicates: {duplicate}, Skipped empty: {invalid}",
    )

    return upload


def _safe_str(value) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = str(value).strip()
    return s if s and s != "nan" else None


async def export_leads_to_excel(db: AsyncSession, lead_ids: list[int] | None = None) -> bytes:
    query = select(Lead)
    if lead_ids:
        query = query.where(Lead.id.in_(lead_ids))
    result = await db.execute(query)
    leads = result.scalars().all()

    data = [
        {
            "Company": l.company,
            "Email": l.email,
            "First Name": l.first_name,
            "Last Name": l.last_name,
            "Website": l.website,
            "Phone": l.phone,
            "Country": l.country,
            "Status": l.status.value,
            "Created": l.created_at,
        }
        for l in leads
    ]
    df = pd.DataFrame(data)
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Prospects", index=False)
    buffer.seek(0)
    return buffer.read()


async def export_sent_leads(db: AsyncSession, campaign_id: int | None = None) -> bytes:
    query = select(SentEmail)
    if campaign_id:
        query = query.where(SentEmail.campaign_id == campaign_id)
    result = await db.execute(query)
    sent = result.scalars().all()

    data = [
        {
            "Company": s.company,
            "Email": s.email,
            "Sent Date": s.sent_at,
            "Campaign ID": s.campaign_id,
            "Mailbox ID": s.mailbox_id,
        }
        for s in sent
    ]
    df = pd.DataFrame(data)
    buffer = BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Sent Successfully", index=False)
    buffer.seek(0)
    return buffer.read()
