# Pariksha-ki-Suraksha (LeakGuard AI)

> **A secure, end-to-end question paper management system** with AES-256-GCM encryption, Shamir Secret Sharing, watermarked printing, AI-powered print-room surveillance, and forensic QR tracing.

---

## Project Structure

```
pariksha-ki-suraksha/
├── apps/
│   ├── frontend/          # Next.js 16 (React 19) — Operator UI
│   └── backend/           # FastAPI — Core API orchestrator
├── workers/
│   ├── vision_agent/      # YOLOv8 print-room surveillance worker
│   └── forensic_worker/   # QR/barcode forensic scan worker
├── supabase/
│   └── migrations/        # All SQL migrations (run in order)
├── scripts/               # Dev utility scripts
├── shared/                # Shared types / constants
└── .env                   # Root environment variables (never commit)
```

---

## Prerequisites

Make sure you have these installed before starting:

| Tool | Version | Check |
|------|---------|-------|
| Node.js | ≥ 18 | `node -v` |
| Python | 3.10 – 3.11 | `python --version` |
| npm | ≥ 9 | `npm -v` |
| Git | any | `git --version` |

---

## 1 — Clone the Repository

```bash
git clone https://github.com/<your-username>/pariksha-ki-suraksha.git
cd pariksha-ki-suraksha
```

---

## 2 — Set Up Environment Variables

Copy the example and fill in your values:

```bash
# Windows
copy .env.example .env

# Mac / Linux
cp .env.example .env
```

Open `.env` and fill in:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VAULT_MASTER_SALT=any-long-random-string-you-choose
```

Then for the frontend, create `apps/frontend/.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

---

## 3 — Set Up the Database (Supabase)

## 4 — Set Up the Backend (FastAPI)

```bash
# From the project root
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Mac / Linux)
source venv/bin/activate

# Install dependencies
pip install -r apps/backend/requirements.txt
```

Start the backend:

```bash
cd apps/backend
uvicorn main:app --reload --port 8000
```

Backend runs at → **http://localhost:8000**
API docs (Swagger) → **http://localhost:8000/docs**

---

## 5 — Set Up the Frontend (Next.js)

```bash
cd apps/frontend
npm install
npm run dev
```

Frontend runs at → **http://localhost:3000**

---

## 6 — (Optional) Set Up Workers

The vision and forensic workers run separately. Use the shared `worker_venv`:

```bash
# From the project root
python -m venv worker_venv

# Activate (Windows)
worker_venv\Scripts\activate

# Activate (Mac / Linux)
source worker_venv/bin/activate

# Install vision agent deps
pip install -r workers/vision_agent/requirements.txt

# Or forensic worker deps
pip install -r workers/forensic_worker/requirements.txt
```

---

## 7 — Verify Everything Works

| Check | URL |
|-------|-----|
| Backend health | http://localhost:8000/api/v1/system/health |
| Swagger API docs | http://localhost:8000/docs |
| Frontend login | http://localhost:3000/auth/login |
| Print room | http://localhost:3000/print-room |

---

## Common Issues

| Problem | Fix |
|---------|-----|
| `proxy` error on backend start | Run `pip install "supabase==2.9.1" --upgrade` inside `venv` |
| `422 Unauthorized` in Swagger | Click **Authorize** in Swagger and paste your Bearer token |
| `403 Forbidden` on vault endpoints | Check your role in the `user_profiles` table in Supabase |
| Frontend blank page | Check browser console (F12) and verify `.env.local` exists |
| Port already in use | Kill the existing process or change the port |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Backend | FastAPI, Python 3.11, Uvicorn |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| Encryption | AES-256-GCM + Shamir 2-of-2 SSS (pycryptodome) |
| PDF Processing | PyMuPDF (fitz) |
| Vision AI | YOLOv8 (ultralytics) |
| Forensics | EasyOCR, pyzbar, pylibdmtx |
