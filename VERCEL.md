# Deploy frontend + backend together on Vercel

This repo is configured for **one Vercel project** with two services (Next.js + FastAPI) via root `vercel.json`.

## Bundle size (225 MB limit on Hobby)

**Do not commit virtualenvs** — `backend/.venv_local` was accidentally in git (~290 MB) and caused deploy failures. It is now in `.gitignore`. If deploy still fails, run:

```bash
git rm -r --cached backend/.venv_local
git rm --cached backend/bulkyy.db backend/campaigns.json
```

Vercel installs slim `backend/requirements.txt` automatically (~53 MB with deps).

- **Removed from Vercel deps:** pandas, Playwright, Celery, Redis, uvicorn, etc.
- **CSV/Excel:** Python `csv` + `openpyxl` (no pandas)

Local / Docker / Render:

```bash
pip install -r requirements-full.txt
```

1. Push the repo to **GitHub**.
2. Use **Postgres** in production (SQLite does not persist on Vercel). Options:
   - [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres) / Neon integration
   - [Neon](https://neon.tech) — paste connection string into env vars

## Deploy steps

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo.
2. **Root directory:** leave as `.` (repo root — not `frontend`).
3. **Framework preset:** choose **Other** or **Services** if shown (project must read `vercel.json` services).
4. Add **Environment variables** (Production + Preview):

| Variable | Example | Notes |
|----------|---------|--------|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host/db` | Required |
| `DATABASE_URL_SYNC` | `postgresql://user:pass@host/db` | Required for Celery (optional on Vercel) |
| `SECRET_KEY` | long random string | |
| `CORS_ORIGINS` | `https://your-app.vercel.app` | Optional if using same-origin; auto-added from `VERCEL_URL` |
| `NEXT_PUBLIC_API_URL` | *(delete this var on Vercel)* | Leave unset — browser uses same domain `/api/...` |

5. Click **Deploy**.

## URLs after deploy

| URL | Service |
|-----|---------|
| `https://YOUR-APP.vercel.app` | Next.js UI |
| `https://YOUR-APP.vercel.app/api/...` | FastAPI |
| `https://YOUR-APP.vercel.app/health` | API health |
| `https://YOUR-APP.vercel.app/docs` | Swagger |

## Local test (optional)

Install Vercel CLI and run both services locally:

```bash
npm i -g vercel
cd D:\Bulkyy
vercel dev
```

Open http://localhost:3000 — API routes go to the backend service.

## Important limits on Vercel

| Limit | Impact |
|-------|--------|
| Serverless timeouts | Long email campaigns may stop mid-run (max ~300s per request on Pro) |
| No persistent disk | Uploads / SQLite reset — use Postgres |
| No always-on Celery | Campaign workers run in-process only |
| Free tier sleep | Cold starts after idle |

For heavy production sending, keep backend on Render/Railway and frontend-only on Vercel (see `DEPLOY.md`).

## Troubleshooting

- **502 on `/api/*`:** Check `DATABASE_URL` and Vercel function logs.
- **CORS errors:** Set `CORS_ORIGINS` to your exact Vercel URL (https, no trailing slash).
- **Frontend calls wrong host:** Leave `NEXT_PUBLIC_API_URL` empty on Vercel.
