# Deploy Bulkyy for free

Recommended free stack:

1. **Frontend** → [Vercel](https://vercel.com) (Next.js)
2. **Backend** → [Render](https://render.com) (FastAPI)
3. **Database** → Render Postgres free **or** [Neon](https://neon.tech) free

> SQLite is fine locally only. On free cloud hosts the disk resets — use Postgres.

---

## A) Backend on Render

1. Push this repo to GitHub.
2. Render → **New** → **Blueprint** → select repo (uses `render.yaml`)  
   **or** **Web Service** manually:
   - Root directory: `backend`
   - Runtime: Python 3.12
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Add a **Postgres** database (free) and set env vars:

```env
DATABASE_URL=postgresql+asyncpg://USER:PASS@HOST/DB
DATABASE_URL_SYNC=postgresql://USER:PASS@HOST/DB
SECRET_KEY=any-long-random-string
CORS_ORIGINS=https://YOUR-APP.vercel.app
```

If Render gives `postgres://...`, change it to:
- `postgresql+asyncpg://...` for `DATABASE_URL`
- `postgresql://...` for `DATABASE_URL_SYNC`

4. After deploy, open: `https://YOUR-API.onrender.com/health` → should show `{"status":"ok"}`.

---

## B) Frontend on Vercel

1. Vercel → **Add New Project** → import the same GitHub repo.
2. Root directory: `frontend`
3. Framework: Next.js (auto)
4. Environment variable:

```env
NEXT_PUBLIC_API_URL=https://YOUR-API.onrender.com
```

5. Deploy. Open your `*.vercel.app` URL.

6. Go back to Render and set `CORS_ORIGINS` to that Vercel URL (comma-separated if you have more).

---

## C) Important free-tier limits

| Limit | Effect on Bulkyy |
|--------|------------------|
| Render free sleeps after ~15 min idle | First request is slow; **long campaigns may pause** if the server sleeps |
| No always-on worker on free | Email sending runs inside the API process — keep the tab / ping the API during big sends |
| Free DB storage is small | Fine for testing; not for huge lead lists |

For serious client campaigns you’ll eventually want a paid always-on plan (Render Starter / Railway / Fly.io).

---

## Quick local check before deploy

```bash
# backend
cd backend
.\.venv_local\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# frontend
cd frontend
npx next build
```

---

## After deploy checklist

- [ ] `/health` works on API
- [ ] Frontend loads and can list mailboxes
- [ ] CORS allows your Vercel domain
- [ ] Create campaign with **2+ mailboxes** (auto-rotate)
- [ ] Send a test email
