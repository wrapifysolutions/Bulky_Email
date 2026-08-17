import re
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Lead, LeadStatus, LogType
from app.services.common import is_valid_email, log_activity, normalize_url

EMAIL_PATTERN = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
)

PREFERRED_PREFIXES = ("info", "sales", "contact", "hello", "support", "admin", "enquiry", "inquiry")

CONTACT_PATHS = ["/contact", "/contact-us", "/about", "/about-us", "/get-in-touch"]


def _extract_emails_from_text(text: str) -> list[str]:
    found = EMAIL_PATTERN.findall(text)
    return [e.lower() for e in found if is_valid_email(e)]


def _pick_best_email(emails: list[str]) -> str | None:
    if not emails:
        return None
    for prefix in PREFERRED_PREFIXES:
        for email in emails:
            if email.split("@")[0] == prefix:
                return email
    return emails[0]


def _extract_company_name(soup: BeautifulSoup) -> str | None:
    og = soup.find("meta", property="og:site_name")
    if og and og.get("content"):
        return og["content"].strip()

    schema = soup.find("script", type="application/ld+json")
    if schema and schema.string and "Organization" in schema.string:
        match = re.search(r'"name"\s*:\s*"([^"]+)"', schema.string)
        if match:
            return match.group(1)

    title = soup.find("title")
    if title and title.string:
        name = title.string.strip().split("|")[0].split("-")[0].strip()
        if name:
            return name

    h1 = soup.find("h1")
    if h1:
        return h1.get_text(strip=True)

    logo = soup.find("img", alt=True)
    if logo and logo.get("alt"):
        alt = logo["alt"].strip()
        if alt and len(alt) < 100:
            return alt

    return None


def _extract_phone(soup: BeautifulSoup) -> str | None:
    text = soup.get_text()
    phone_match = re.search(
        r"(\+?\d{1,3}[\s\-]?)?\(?\d{2,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{3,4}",
        text,
    )
    return phone_match.group(0).strip() if phone_match else None


def _extract_social_links(soup: BeautifulSoup, base_url: str) -> dict[str, str | None]:
    social = {"linkedin": None, "facebook": None, "instagram": None}
    for a in soup.find_all("a", href=True):
        href = a["href"].lower()
        if "linkedin.com" in href:
            social["linkedin"] = a["href"]
        elif "facebook.com" in href:
            social["facebook"] = a["href"]
        elif "instagram.com" in href:
            social["instagram"] = a["href"]
    return social


async def crawl_website(url: str) -> dict:
    url = normalize_url(url)
    result = {
        "website": url,
        "company": None,
        "email": None,
        "phone": None,
        "linkedin": None,
        "facebook": None,
        "instagram": None,
        "contact_page": None,
        "address": None,
        "source_url": url,
    }

    all_emails: list[str] = []

    async with httpx.AsyncClient(
        timeout=15.0,
        follow_redirects=True,
        headers={"User-Agent": "BulkyyBot/1.0"},
    ) as client:
        pages_to_check = [url]
        parsed = urlparse(url)
        base = f"{parsed.scheme}://{parsed.netloc}"

        for path in CONTACT_PATHS:
            pages_to_check.append(urljoin(base, path))

        homepage_soup = None

        for page_url in pages_to_check:
            try:
                response = await client.get(page_url)
                if response.status_code != 200:
                    continue
                soup = BeautifulSoup(response.text, "lxml")

                if page_url == url:
                    homepage_soup = soup

                emails = _extract_emails_from_text(response.text)
                all_emails.extend(emails)

                if "/contact" in page_url and not result["contact_page"]:
                    result["contact_page"] = page_url

            except Exception:
                continue

        if homepage_soup:
            result["company"] = _extract_company_name(homepage_soup)
            result["phone"] = _extract_phone(homepage_soup)
            social = _extract_social_links(homepage_soup, url)
            result.update(social)

        result["email"] = _pick_best_email(list(set(all_emails)))
        result["status"] = LeadStatus.VALID if result["email"] else LeadStatus.NO_EMAIL

    return result


async def generate_leads_from_urls(
    db: AsyncSession, urls: list[str]
) -> list[Lead]:
    leads = []
    for url in urls:
        data = await crawl_website(url)

        existing_lead = None
        if data.get("email"):
            result = await db.execute(
                select(Lead).where(Lead.email == data["email"])
            )
            existing_lead = result.scalar_one_or_none()

        if existing_lead:
            leads.append(existing_lead)
            continue

        lead = Lead(
            company=data.get("company"),
            email=data.get("email"),
            website=data.get("website"),
            phone=data.get("phone"),
            linkedin=data.get("linkedin"),
            facebook=data.get("facebook"),
            instagram=data.get("instagram"),
            contact_page=data.get("contact_page"),
            source_url=data.get("source_url"),
            status=data.get("status", LeadStatus.NO_EMAIL),
        )
        db.add(lead)
        leads.append(lead)

    await log_activity(
        db,
        LogType.LEAD_GENERATED,
        f"Generated {len(leads)} leads from {len(urls)} websites",
    )
    await db.flush()
    return leads
