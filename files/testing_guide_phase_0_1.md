# ParikshaSetu AI — Phase 0 & Phase 1 Testing Guide

This guide describes how to thoroughly test and verify the custom database authentication hook, supporting services, and the administrative console pages.

---

## 1. Local Networking Setup (Multi-Tenant Routing)
Because ParikshaSetu routes requests based on subdomain headers (e.g., `admin.localhost` rewritten to `/admin` and `agency-slug.localhost` to `/agency/slug`), you need to map subdomains in your OS hosts file for browser-based testing.

### Windows Hosts File Configuration
1. Open PowerShell or Command Prompt as **Administrator**.
2. Open the hosts file:
   ```cmd
   notepad C:\Windows\System32\drivers\etc\hosts
   ```
3. Append the following lines at the bottom:
   ```text
   127.0.0.1    parikshasetu.localhost
   127.0.0.1    admin.localhost
   127.0.0.1    agency1.localhost
   ```
4. Save and close the file.

---

## 2. Testing Frontend Pages
First, run the Next.js development server from the `apps/web` directory:
```bash
npm run dev
```

### A. Public Landing Page & Exam Listings
- **URL**: `http://localhost:3000` (or `http://parikshasetu.localhost:3000`)
- **Vibe Checks**:
  - Monospace code fonts for codes/badges (`IBM Plex Mono`) and sans-serif layout (`Inter`).
  - Active exams section (should load dynamic stats like vetted agencies count and list exams by pulling from `http://localhost:8000/api/v1/public/exams`).
  - Try using the search bar and mode selectors (`ALL`, `ONLINE`, `OFFLINE`).

### B. Exam Detail Page
- **URL**: Click "View Details" on any public exam card, or navigate directly to `http://localhost:3000/exams/<exam-uuid>`.
- **Vibe Checks**:
  - The left panel should load the embedded brochure PDF if it exists, or fall back to the dynamic syllabus text.
  - The right column should sticky-lock key statistics (price in INR, exam dates, capacity limits).

### C. Admin Console & Login
- **URL**: `http://admin.localhost:3000/login`
- **Bypass Login**:
  - Enter Email: `admin@parikshasetu.in`
  - Enter Secret Token: `AdminPassword123`
  - Submit the form. It should set the bypass session and redirect you directly to the root admin dashboard `http://admin.localhost:3000/`.
- **Administrative Pages**:
  - **Dashboard**: Displays four key metric slots (agencies, open exams, escalated issues) and matches with the 10 most recent ledger changes.
  - **Agencies (`/agencies`)**: Tab views displaying registered agencies. Click a row to open the inspect drawer. Test approving/suspending an agency.
  - **Audit Logs (`/audit`)**: Scroll through the ledger. Test the CSV exporter.
  - **Global Config (`/config`)**: Edit the visibility settings or geofence numbers and press "Commit Settings to Ledger" to write values.

---

## 3. Testing Backend REST Endpoints (Swagger UI)
Start the FastAPI server:
```bash
uvicorn apps.api.main:app --reload --port 8000
```
Open **`http://127.0.0.1:8000/api/docs`** in your browser.

### Authentication for Admin Endpoints
Since administrative endpoints require `RequireRole("platform_admin")`, you need to set the authorization header in Swagger:
1. Create a mock JWT token carrying `role: "platform_admin"` or generate one using the secret. (For local development, the security middleware decodes the claims directly).
2. Click the **Authorize** lock button in the top right of the Swagger UI.
3. Paste your admin JWT into the Bearer input field and click **Authorize**.

### API Checkpoints:
- `GET /api/v1/public/exams`: Returns lists of active public examinations.
- `GET /api/v1/admin/stats`: Returns dashboard indicators.
- `GET /api/v1/admin/agencies`: Checks status lists.
- `PATCH /api/v1/admin/agencies/{id}/approve`: Approves the agency, registers the URL slug, and launches the welcome email task.
- `GET /api/v1/admin/audit-logs`: Retrieves database ledger events.

---

## 4. Database Custom Claims Hook Check
To verify that the custom JWT claim generator maps columns correctly, navigate to your online Supabase SQL Editor and query:

```sql
-- Test hook execution manually with a mock session payload
SELECT public.custom_access_token_hook(
  jsonb_build_object(
    'user_id', 'a8c0356e-57b1-4a41-b0db-ea3ee64c3911', -- replace with a user_id from platform_admins or agency_staff
    'claims', jsonb_build_object('email', 'admin@parikshasetu.in')
  )
);
```

Check the returned JSON to verify that:
- `role` matches the registered user role.
- `agency_id` matches the user's registered organization.
- `exam_scope` and `paper_batch_ids` are initialized as empty arrays.

---

## 5. Background Task Queue (Celery)
To verify that background workers pick up events asynchronously:
1. Start the Celery worker locally:
   ```bash
   celery -A apps.api.workers.celery_app.celery_app worker --loglevel=info
   ```
2. In a separate terminal, trigger an agency approval action.
3. Inspect the Celery worker terminal. You should see the task executed:
   `[Celery] Sending welcome email to <Agency Head>...`
