# Curiva.ai

Curiva.ai is an agentic AI hospital workflow platform that automates patient intake, radiology scheduling, clinical summarization, and EHR coordination. It offers role-based portals for doctors, patients, and hospital managers—with vitals tracking, diet plans, women's and children's health protocols, demo payments, and an AI clinical assistant.

## Stack

- **Frontend:** React + Vite (`frontend/`)
- **Backend:** FastAPI + SQLite (`backend/`)

## Local development

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — the Vite dev server proxies `/api` to the backend.

## Deploy to Vercel (frontend)

Vercel hosts the **React app only**. The FastAPI backend must run elsewhere (see Render below).

### Option A — Import from GitHub (recommended)

1. Go to [vercel.com/new](https://vercel.com/new) and import `Mani9516/Curiva.ai`.
2. **Root Directory:** leave as repo root (uses root `vercel.json`) **or** set to `frontend` (uses `frontend/vercel.json`).
3. **Environment variables** (Project → Settings → Environment Variables):

   | Name | Value |
   |------|--------|
   | `VITE_API_BASE_URL` | Your backend URL, e.g. `https://curiva-api.onrender.com` (no trailing slash) |

4. Deploy. Redeploy after changing `VITE_API_BASE_URL` (it is baked in at build time).

### Option B — Vercel CLI

```bash
npm i -g vercel
cd frontend
vercel
# Set VITE_API_BASE_URL in the Vercel dashboard, then:
vercel --prod
```

## Deploy backend (Render)

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New** → **Blueprint**.
2. Connect the same GitHub repo — Render reads `render.yaml`.
3. After deploy, copy the service URL (e.g. `https://curiva-api.onrender.com`).
4. Set that URL as `VITE_API_BASE_URL` in Vercel and redeploy the frontend.

> **Note:** Render free tier uses ephemeral disk; the SQLite demo database resets on cold starts. Fine for demos; use a managed DB for production.

## Demo logins

| Role | Username | Password |
|------|----------|----------|
| Doctor | `doctor1` | `doctor123` |
| Patient | (see seeded users in `backend/app/db.py`) | |
| Hospital manager | `hospitalmgr` | `hospital123` |
