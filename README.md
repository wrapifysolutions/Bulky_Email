# Bulkyy — Smart Bulk Email Outreach & Lead Generation Platform

Centralized B2B cold outreach with multi-mailbox rotation, CSV import, lead generation from websites, and campaign tracking.

## Features

- **Multi-mailbox management** — Unlimited mailboxes with configurable daily limits (default 15/day)
- **Round-robin sending** — Even distribution across active mailboxes
- **CSV import** — Upload prospects with validation and deduplication
- **Campaign engine** — Template-based personalized outreach with random delays
- **Lead generation** — Crawl websites to extract company info and contact emails
- **Duplicate protection** — Never send to the same email twice
- **Dashboard** — Real-time stats, campaign reports, and activity logs

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| Queue | Redis + Celery |
| Crawler | Playwright, BeautifulSoup |
| Email | SMTP / OAuth2 (Gmail, Microsoft 365) |

## Quick Start

### Prerequisites

- Docker & Docker Compose (optional)
- Node.js 20+ (for local frontend dev)
- Python 3.11 (recommended for local backend dev)

### Run with Docker

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- API docs: http://localhost:8000/docs
- API: http://localhost:8000

### Local Development

**Backend (Windows, local SQLite):**

```bash
cd backend
py -3.11 -m venv .venv311
.venv311\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Celery worker:**

```bash
cd backend
celery -A app.worker.celery_app worker --loglevel=info
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev -- -H 127.0.0.1 -p 3000
```

## Project Structure

```
Bulkyy/
├── backend/
│   ├── app/
│   │   ├── api/          # REST endpoints
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── services/     # Business logic
│   │   ├── worker/       # Celery tasks
│   │   └── crawler/      # Lead extraction
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── app/          # Next.js pages
│       ├── components/   # UI components
│       └── lib/          # API client & utilities
└── docker-compose.yml
```

## API Overview

| Endpoint | Description |
|----------|-------------|
| `GET /api/dashboard` | Dashboard statistics |
| `GET/POST /api/mailboxes` | Mailbox management |
| `POST /api/leads/upload` | CSV upload |
| `GET/POST /api/leads` | Lead database |
| `POST /api/leads/generate` | Website lead generation |
| `GET/POST /api/campaigns` | Campaign management |
| `GET/POST /api/templates` | Email templates |
| `GET /api/logs` | Activity logs |

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and adjust values.

## License

Private — All rights reserved.
