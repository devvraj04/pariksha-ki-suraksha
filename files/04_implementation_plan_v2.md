# LeakGuard AI — Master Implementation Plan (v2)

*See Something. Secure Something. — Complete build specification for the engineering/coding agent.*

---

## 0. How to Use This Document

This is the **single authoritative build specification** for LeakGuard AI, end-to-end. It is derived from and must remain fully consistent with the three companion source documents:

- `Unified_System_Blueprint.md` — original idea and narrative blueprint
- `01_system_design.md` — system architecture, stakeholder map, tech stack, security layers, non-functional requirements
- `02_database_design.md` — full 32-table PostgreSQL (Supabase) schema
- `03_app_flow.md` — 16 end-to-end operational flows (Flow 0 through Flow 15)

Every phase below:
- States its **objective** explicitly
- Maps to one or more **Flows** from `03_app_flow.md`
- Names every **table touched** from `02_database_design.md`
- Lists every **backend API endpoint** with method, path, auth, and purpose
- Lists every **Celery / background job**
- Describes every **frontend route** with folder path and detailed page design
- States **inter-phase dependencies** — what must exist before this phase can be built
- States **downstream connections** — what later phases depend on outputs from this phase
- Ends with an **acceptance checklist**

**Do not rename tables, columns, or status enums** — build against the schema exactly as specified in `02_database_design.md`. Where this plan introduces implementation detail not explicit in the other documents (specific task names, folder paths, aggregation rules), it does so only to make an already-specified requirement buildable, never to add new product scope.

---

## 0.1 Conventions

- **Frontend routes** written as browser URLs, e.g. `[agency-slug].leakguard.in/dashboard`. Next.js App Router folder shown alongside. `leakguard.in` is a placeholder — replace with `[platform-domain]` once the name is decided.
- **Auth roles**: `PLATFORM_ADMIN`, `AGENCY_HEAD`, `MANAGER`, `OPERATOR`, `TRANSIT_MANAGER`, `CENTER_OFFICER`, `GRADING_TEACHER`, `MODERATOR`, `CHIEF_MODERATOR`, `STUDENT`, `PUBLIC` (unauthenticated). These map directly to `agency_staff.role`, the `students` table, and the JWT `role` claim defined in `01_system_design.md §4.2`.
- **API base path**: all backend endpoints versioned under `/api/v1/`.
- **Backend stack**: FastAPI (Python), Supabase PostgreSQL + Storage, Celery + Redis for async/scheduled jobs, Supabase Auth for identity.
- **Frontend stack**: Next.js 14 App Router, Tailwind CSS, Zustand, React Hook Form + Zod, Supabase Realtime, Socket.io / WebRTC for live feeds.
- **Visibility score threshold**: the `exams.visibility_score_threshold` column (default `8.0`) is per-exam configurable. Aggregation rule for multi-page uploads: the **minimum page-level score** across all pages determines the sheet's overall score. Any single page below threshold triggers a `RESCAN_REQUIRED` status.

---

## 0.2 Repository Structure

```
leakguard/
├── apps/
│   ├── web/                        # Next.js 14 App Router frontend
│   │   ├── app/
│   │   │   ├── (public)/           # leakguard.in root + /student/* routes
│   │   │   ├── agency/[slug]/      # agency-subdomain routes incl. /center/* and /eval/*
│   │   │   └── admin/              # admin.leakguard.in
│   │   ├── middleware.ts            # subdomain parsing + auth/role guard
│   │   ├── components/ui/           # shared design-system components
│   │   ├── lib/                     # supabase client, typed api client, zustand stores
│   │   └── styles/
│   └── api/                         # FastAPI backend
│       ├── main.py
│       ├── routers/
│       │   ├── admin.py             # Phase 1
│       │   ├── agencies.py          # Phase 2
│       │   ├── exams.py             # Phase 3
│       │   ├── students.py          # Phase 4
│       │   ├── allocations.py       # Phase 5
│       │   ├── vault.py             # Phase 6
│       │   ├── printing.py          # Phase 7
│       │   ├── transit.py           # Phase 8
│       │   ├── day_of.py            # Phase 9
│       │   ├── evaluation.py        # Phase 10 & 11
│       │   ├── results.py           # Phase 12
│       │   ├── leaks.py             # Phase 13
│       │   ├── whistleblower.py     # Phase 14
│       │   ├── grievances.py        # Phase 15
│       │   └── public.py            # Phase 1 (public exam listing)
│       ├── services/
│       │   ├── encryption.py        # AES-256-GCM, split-key logic
│       │   ├── watermarking.py      # steganographic tracking matrix
│       │   ├── allocation.py        # center allocation algorithm
│       │   ├── biometrics.py        # face hash generation + matching
│       │   ├── notifications.py     # email + SMS OTP
│       │   ├── admit_card.py        # JWT signing + PDF generation
│       │   ├── result_pdf.py        # digitally signed result PDFs
│       │   └── ai_agents/
│       │       ├── brochure_agent.py      # LLM brochure generation
│       │       ├── visibility_agent.py    # YOLOv8 + OpenCV answer sheet scoring
│       │       ├── leak_agent.py          # Agent 7: watermark reverse-engineering
│       │       ├── risk_score_agent.py    # Agent 8: whistleblower risk scoring
│       │       └── surveillance_agent.py  # YOLOv8 exam hall + print room detection
│       ├── workers/
│       │   ├── celery_app.py
│       │   ├── tasks_exam.py
│       │   ├── tasks_vault.py
│       │   ├── tasks_printing.py
│       │   ├── tasks_transit.py
│       │   ├── tasks_evaluation.py
│       │   ├── tasks_results.py
│       │   └── tasks_ai.py
│       ├── models/                   # Pydantic request/response schemas
│       ├── deps.py                   # auth/role dependencies, audit logging dependency
│       └── core/
│           ├── config.py
│           ├── security.py
│           └── supabase_client.py
├── infra/
│   ├── supabase/
│   │   ├── migrations/              # one SQL file per table group
│   │   └── policies/                # RLS policies, one file per table
│   ├── mqtt/                        # Mosquitto broker config for GPS telemetry
│   ├── edge/                        # YOLOv8 lite edge node deployment scripts
│   └── docker-compose.yml           # Redis, Celery worker, Celery Beat, MQTT broker
└── docs/                             # the four source documents
```

---

## 0.3 Environment Variables (Provision Once)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
REDIS_URL
PLATFORM_DOMAIN                        # e.g. leakguard.in (TBD)

# Admit card QR signing — distinct from Supabase Auth JWT signing key
ADMIT_CARD_JWT_PRIVATE_KEY
ADMIT_CARD_JWT_PUBLIC_KEY

# Key vault
HSM_KEY_SHARE_ENDPOINT                 # AWS CloudHSM / Azure HSM endpoint; use Supabase Vault ref in dev
SUPABASE_VAULT_KEY_STORE_ID            # Supabase Vault secret store for Key Share 1

# Payment
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET

# AI / LLM
LLM_API_KEY                            # brochure generation + whistleblower risk scoring

# IoT / Transit
MQTT_BROKER_URL                        # e.g. mqtt://broker.leakguard.in:1883
MQTT_USERNAME
MQTT_PASSWORD

# Live CCTV
WEBRTC_RELAY_URL                       # TURN/relay server for WebRTC CCTV streams

# Communications
SMS_OTP_PROVIDER_KEY                   # e.g. Twilio / MSG91
EMAIL_PROVIDER_KEY                     # e.g. Resend / SendGrid

# Result PDF signing
RESULT_PDF_SIGNING_KEY

# Watermark encoding master key (set in admin config, referenced here)
WATERMARK_MASTER_KEY
```

---

## 0.4 Design System Specification

Before building any component, read `/mnt/skills/public/frontend-design/SKILL.md`. The platform is a high-security, government-grade examination system. Every visual choice must communicate institutional trust and operational precision.

**Palette**

| Token | Hex | Usage |
|---|---|---|
| `--navy-950` | `#0B1120` | Primary backgrounds (agency portal, admin) |
| `--navy-800` | `#162032` | Cards, sidebars |
| `--navy-600` | `#1E3A5F` | Borders, dividers |
| `--slate-100` | `#F0F4F8` | Student portal background (lighter, less institutional) |
| `--white` | `#FFFFFF` | Card surfaces |
| `--amber-500` | `#F59E0B` | Security alerts ONLY — never used decoratively |
| `--red-600` | `#DC2626` | Destructive actions, critical errors |
| `--green-600` | `#16A34A` | Success states, approved statuses |
| `--blue-500` | `#3B82F6` | Primary actions, links |

**Typography**

- Display/headings: `IBM Plex Mono` — monospace conveys precision and immutability; used for IDs, codes, watermark strings, UIDs, status labels throughout
- Body: `Inter` — clean, legible at small sizes for dense data tables
- Data labels: `IBM Plex Mono` at smaller sizes for application numbers, center codes, trunk IDs

**Signature element**: every security-critical event in the UI shows a timestamped "Secure Event Log" strip at the bottom of its card — a miniature immutable ledger entry in monospace, styled like a terminal line. This appears on vault upload confirmations, trunk handoff confirmations, check-in success screens, and evaluation lock-in confirmations.

**Shared component library** (`components/ui/`):

- `Button` — variants: `primary`, `destructive`, `ghost`, `security` (amber-bordered, for irreversible security actions)
- `Input`, `Select`, `TextArea`, `FileUpload` — with Zod validation messaging
- `Card`, `DataTable` (sortable, filterable, paginated)
- `Modal`, `SideDrawer`
- `StatusBadge` — one color mapping per status enum across all schema enums (exam lifecycle, registration, trunk, upload, evaluator assignment, grievance)
- `Stepper` — multi-step form orchestrator that batches API calls per step and handles partial failure
- `LiveDot` — pulsing amber dot for realtime-connected data
- `AlertBanner` — security alert strip (amber background, monospace text, timestamp)
- `SecureEventLog` — the signature terminal-line component described above
- `BiometricCapture` — webcam wrapper for face capture at check-in
- `QRScanner` — QR code scanner component for day-of check-in terminals
- `PDFViewer` — embedded PDF viewer for brochures, admit cards, result cards

---

## 0.5 Global Cross-Cutting Concerns (implement once in Phase 0, used everywhere)

**Audit logging dependency**: a FastAPI dependency `log_audit(event_type, description, metadata, actor_id, agency_id, exam_id, ip_address)` that inserts into `audit_logs`. Called via `Depends()` on every security-critical endpoint. This table is append-only — no UPDATE or DELETE ever.

**Notification service** (`services/notifications.py`):
- `send_email(template_id, to, context)` — wraps email provider
- `send_sms_otp(phone)` — generates a 6-digit TOTP, stores in Redis with 5-min TTL, dispatches via SMS provider
- `verify_sms_otp(phone, otp)` — validates against Redis entry

**Role enforcement**: every protected endpoint uses `Depends(require_role("agency_head", "manager"))`. Role violations return `403 Forbidden` with a structured error body. This is always enforced server-side — client-side nav hiding is cosmetic only.

**RLS policy pattern**: agency-owned tables are always filtered by the `agency_id` JWT claim. Student-owned tables by `auth.uid()` matching `students.user_id`. Evaluator tables additionally filtered by `paper_batch_ids` claim.

---

# PHASE 0 — Foundation & Infrastructure

## Objective
Stand up the entire skeleton — database, auth, API structure, Celery workers, MQTT broker, and the Next.js multi-tenant routing — so that every later phase only adds a router and a page, never re-plumbs foundational infrastructure. No user-facing feature is built here; this phase exists solely so nothing in Phases 1–15 has to solve an infrastructure problem.

## Flows Covered
Flow 0 (Platform Setup — partial: infrastructure only; admin UI is Phase 1)

## Dependencies
None. This is built first.

## Downstream Connections
Every phase depends on this phase. No other phase can begin until Phase 0 is complete and its acceptance checklist passes.

## Tables Touched
All 32 tables (schema creation only). Special attention: `platform_admins` (not in `02_database_design.md`'s 32-table index but referenced by `agencies.approved_by` — must be created here as table 0 before the migration chain runs).

---

### Step 0.1 — Supabase Schema & Migrations

Create `infra/supabase/migrations/` with SQL files executed in strict dependency order:

```
000_platform_admins.sql
001_agencies.sql
002_agency_staff.sql
003_exams.sql
004_exam_centers.sql
005_exam_rooms.sql
006_students.sql
007_exam_registrations.sql
008_center_allocations.sql
009_admit_cards.sql
010_question_papers.sql
011_paper_vault_access_logs.sql
012_print_jobs.sql
013_print_watermark_registry.sql
014_print_room_surveillance_alerts.sql
015_transit_trunks.sql
016_transit_events.sql
017_transit_geofence_violations.sql
018_checkin_events.sql
019_room_allocations.sql
020_surveillance_alerts.sql
021_cbt_exam_sessions.sql
022_answer_sheet_uploads.sql
023_answer_sheet_visibility_scores.sql
024_evaluator_assignments.sql
025_evaluation_marks.sql
026_evaluation_discrepancies.sql
027_exam_results.sql
028_leak_reports.sql
029_whistleblower_reports.sql
030_student_grievances.sql
031_grievance_cctv_attachments.sql
032_audit_logs.sql
```

Build exactly the 32 tables from `02_database_design.md` plus `platform_admins`. Enable Row-Level Security on every table. Enable RLS policies per `infra/supabase/policies/[table_name].sql`.

`exam_rooms.current_occupancy` is initialized to `0` at creation and incremented atomically during check-in (Phase 9). It is never decremented (a check-in is final). Write a Postgres function `increment_room_occupancy(room_id UUID)` that increments and validates capacity in a single transaction.

### Step 0.2 — Supabase Storage Buckets

| Bucket | Access | Used In |
|---|---|---|
| `syllabus-pdfs` | agency staff (scoped) | Phase 3 |
| `brochures` | public read | Phase 3 |
| `admit-cards` | student (own) + agency staff | Phase 5 |
| `question-papers-vault` | service-role only | Phase 6, 7 |
| `answer-sheet-uploads` | service-role only | Phase 10 |
| `cctv-clips` | agency staff (scoped) | Phase 9, 15 |
| `evidence-uploads` | anonymous write (whistleblower) + authenticated | Phase 14, 15 |
| `result-pdfs` | student (own) + agency staff | Phase 12 |
| `session-recordings` | service-role only | Phase 6 |
| `webcam-snapshots` | service-role only | Phase 6, 9 |

### Step 0.3 — Supabase Auth + Custom JWT Claims

Wire a `custom_access_token_hook` Postgres function into Supabase Auth Hook. For every issued JWT, the hook injects:

```json
{
  "agency_id": "uuid | null",
  "role": "agency_head | manager | operator | ... | student",
  "exam_scope": ["uuid", ...],
  "paper_batch_ids": ["uuid", ...]
}
```

The hook looks up `agency_staff` or `students` by `user_id = auth.uid()`. Students get `role: "student"`, `agency_id: null`. Platform admins get `role: "platform_admin"` from the `platform_admins` table.

### Step 0.4 — FastAPI Skeleton

`apps/api/main.py`:
- Registers all routers (added incrementally per phase)
- CORS configuration scoped to `*.leakguard.in` + `leakguard.in`
- Global exception handler (structured error body: `{error, code, detail}`)
- `/health` → `200 OK` (used in deployment readiness checks)

`apps/api/deps.py`:
- `get_current_user()` — decodes Supabase JWT, returns `CurrentUser(id, role, agency_id, exam_scope, paper_batch_ids)`
- `require_role(*roles)` — raises `403` if caller's role not in the allowed list
- `log_audit(...)` — the global audit dependency
- `get_agency_scoped_db()` — returns a Supabase client that forwards the caller's JWT so RLS applies
- `get_service_db()` — returns the service-role client (bypasses RLS; used only for vault, watermarking, admit card, and result operations that legitimately need to cross RLS boundaries)

`apps/api/core/supabase_client.py`: exposes both clients above.

### Step 0.5 — Celery + Redis + MQTT

`apps/api/workers/celery_app.py`:
- Broker: Redis
- Result backend: Redis
- Celery Beat for all scheduled tasks (see individual phases for task names and schedules)

`infra/docker-compose.yml`:
```yaml
services:
  redis: ...
  celery_worker: ...
  celery_beat: ...
  mqtt_broker:        # Mosquitto; listens on 1883 (MQTT) and 8883 (MQTT over TLS)
    image: eclipse-mosquitto
    volumes:
      - ./mqtt/mosquitto.conf:/mosquitto/config/mosquitto.conf
```

MQTT topic structure for trunk telemetry: `trunks/{trunk_id}/telemetry` (published by GPS device, subscribed by a Celery task `consume_trunk_telemetry` that writes to `transit_events`).

### Step 0.6 — Next.js Skeleton & Multi-Tenant Routing

`middleware.ts` reads the `Host` header on every request:
- `admin.leakguard.in` → rewrite to `/admin/*`
- `leakguard.in` → public/student route tree under `app/(public)/`
- `{slug}.leakguard.in` → rewrite to `/agency/[slug]/*`, inject `slug` into request headers

`lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (RSC) wrap `@supabase/ssr`.
`lib/api.ts`: typed fetch wrapper that attaches the Supabase session JWT as Bearer token to every FastAPI call. Exposes per-domain typed clients: `agencyApi`, `studentApi`, `adminApi`, `publicApi`.

Zustand stores:
- `useAuthStore` — `{user, role, agencyId, agencySlug}`
- `useExamStore` — `{activeExam, activeExamId}` (set when user navigates into an exam workspace)
- `useAlertStore` — real-time security alerts (fed by Supabase Realtime subscriptions)

### Step 0.7 — Edge AI Setup

`infra/edge/`:
- Dockerfile for edge node: Ubuntu base, YOLOv8 lite (`yolov8n.pt`), FastAPI wrapper exposing `/detect` endpoint
- Deployment script for exam center local servers
- Sync-on-reconnect logic: edge nodes buffer detection events locally when offline and flush to `surveillance_alerts` / `print_room_surveillance_alerts` when connectivity resumes
- Three detection models deployed to edge: `phone_detector`, `behavior_detector`, `exam_hall_monitor`

### Acceptance Checklist — Phase 0
- [ ] All 32 tables + `platform_admins` exist with RLS enabled; an "agency A cannot read agency B's rows" test passes
- [ ] A test JWT issued to a dummy `agency_staff` row carries `agency_id`, `role`, `exam_scope` claims
- [ ] FastAPI boots; `/health` returns `200`; Celery worker connects to Redis; Celery Beat starts
- [ ] MQTT broker accepts connections; a test publish to `trunks/test/telemetry` is consumed by a test subscriber
- [ ] Visiting `acme.localhost:3000` and `localhost:3000` resolve to different route trees
- [ ] The design system debug route at `/design-system` renders all components
- [ ] `exam_rooms.current_occupancy` is enforced: `increment_room_occupancy` rejects when `current_occupancy = seating_capacity`

---

# PHASE 1 — Platform Public Layer & Admin Console

## Objective
Build the public-facing landing page (exam discovery for all visitors), the anonymous whistleblower entry point footer link, and the platform admin console that approves agencies. No agency can go live until a platform admin approves it — making this phase a blocker for Phase 2.

## Flows Covered
Flow 0 (Platform Setup — admin UI and global config)

## Dependencies
Phase 0 (schema, auth, API skeleton must exist).

## Downstream Connections
- Phase 2 depends on the admin approval endpoint built here (`PATCH /admin/agencies/{id}/approve`)
- Phase 3 depends on the public exam listing endpoint built here (`GET /public/exams`) — students browse exams from here
- Phase 14 (Whistleblower Portal) links from the footer built here

## Tables Touched
`agencies` (read for listing, write for approval), `exams` (read, status-filtered), `platform_admins`, `audit_logs`

---

### Backend Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/public/exams` | PUBLIC | List exams where `status IN (PUBLISHED, REGISTRATION_OPEN, REGISTRATION_CLOSED)`, joined with `agencies.name` and `agencies.slug`. Paginated (20/page). Filterable by `mode`, `state`, `upcoming` (exam_date > today). Never returns DRAFT exams. |
| GET | `/api/v1/public/exams/{exam_id}` | PUBLIC | Full exam detail: all fields + `brochure_pdf_path` signed URL + center list (names, cities only — not GPS coordinates). Used on the public exam detail page. |
| GET | `/api/v1/admin/agencies` | PLATFORM_ADMIN | List agencies. Query params: `status` (default `PENDING`), `search`, `page`. Returns agency details + submitted PAN/GST documents. |
| PATCH | `/api/v1/admin/agencies/{id}/approve` | PLATFORM_ADMIN | Sets `agencies.status → ACTIVE`, finalizes `slug` (slugify org name, check uniqueness), provisions subdomain (DNS record via hosting API or manual step with instructions), fires `send_agency_welcome_email` task. Writes `AGENCY_APPROVED` to `audit_logs`. |
| PATCH | `/api/v1/admin/agencies/{id}/reject` | PLATFORM_ADMIN | Sets `status → DEREGISTERED` (or back to PENDING with rejection note). Fires rejection email. |
| PATCH | `/api/v1/admin/agencies/{id}/suspend` | PLATFORM_ADMIN | Sets `status → SUSPENDED`. All agency staff JWTs become invalid at next refresh (enforced by RLS checking `agencies.status = ACTIVE`). |
| GET | `/api/v1/admin/config` | PLATFORM_ADMIN | Returns global defaults object: `{default_visibility_threshold, default_geofence_radius_meters, watermark_master_key_ref, hsm_integration_mode}` |
| PUT | `/api/v1/admin/config` | PLATFORM_ADMIN | Updates global defaults. Writes `PLATFORM_CONFIG_UPDATED` to `audit_logs`. |
| GET | `/api/v1/admin/audit-logs` | PLATFORM_ADMIN | Paginated, filterable by `agency_id`, `event_type`, `actor_id`, date range. |
| GET | `/api/v1/admin/stats` | PLATFORM_ADMIN | Dashboard stats: total active agencies, open exams, students registered this month, open grievances. |

### Celery / Background Jobs

| Task | Trigger | Action |
|---|---|---|
| `send_agency_welcome_email` | admin approves agency | Sends onboarding email to Agency Head with login URL, temporary credentials, and getting-started guide |
| `send_agency_rejection_email` | admin rejects agency | Sends rejection notice with reason |

### Frontend Routes

**`leakguard.in/` → `app/(public)/page.tsx`**
Public landing page. Hero: large headline — "India's First End-to-End Exam Security Platform" — with live counters (active agencies, open exams). Below the hero: a search + filter bar (mode: Online/Offline, state dropdown, date range), then a card grid of published exams. Each card: agency logo/initials avatar, exam name, mode badge (`IBM Plex Mono`), date, fee, "View Details" CTA. Footer: links to `/agency/register`, `/student/login`, `/report` (whistleblower — grayed out until Phase 14 is built; shows "Coming Soon" in dev). No login required to browse.

**`leakguard.in/exams/[examId]` → `app/(public)/exams/[examId]/page.tsx`**
Public exam detail page. Left column (2/3 width): embedded `PDFViewer` component showing the AI-generated brochure. Right column (1/3): sticky key-facts card — exam date, time, duration, mode badge, fee, total seats, registration deadline, list of center cities. Bottom of right column: CTA button — "Register" (if `REGISTRATION_OPEN`) or "Registration Closed" (if `REGISTRATION_CLOSED`) or "View Results" (if `RESULT_DECLARED`). If student is not logged in, CTA routes to `/student/login?redirect=...`.

**`admin.leakguard.in/login` → `app/admin/login/page.tsx`**
Minimal login form. Email + password. On success, verifies `role = platform_admin` claim; rejects all others. No signup — admin accounts are provisioned manually.

**`admin.leakguard.in/` → `app/admin/dashboard/page.tsx`**
Admin dashboard. Four stat cards at top (agencies pending, agencies active, exams ongoing, open grievances). Below: two panels — "Pending Approvals" (condensed table of PENDING agencies) and "Recent Audit Events" (last 20 audit log entries with event type badge, actor, timestamp).

**`admin.leakguard.in/agencies` → `app/admin/agencies/page.tsx`**
Table of all agencies. Tabs: Pending / Active / Suspended / All. Columns: org name, official email, PAN, city, state, submitted date, status badge. Row click opens a `SideDrawer` with: full details, uploaded document preview (PAN scan), and "Approve" / "Reject" / "Suspend" action buttons. Approve button uses the `security` variant (amber border) since it triggers an irreversible state change. After action, the row updates in-place via optimistic UI.

**`admin.leakguard.in/audit` → `app/admin/audit/page.tsx`**
Full audit log viewer. `DataTable` with columns: timestamp, agency, exam, actor role, event type (monospace badge), description, IP address. Filters: agency select, event type multi-select, date range picker. Export to CSV button. Read-only.

**`admin.leakguard.in/config` → `app/admin/config/page.tsx`**
Global platform settings form: default visibility score threshold (number input, 0–10), default geofence radius (meters), HSM integration mode (dropdown: Supabase Vault / AWS CloudHSM / Azure HSM), watermark master key reference (text input, stored as env ref not raw value). Save button writes via `PUT /admin/config`.

### Acceptance Checklist — Phase 1
- [ ] Public exam listing never shows a `DRAFT` or `ONGOING` exam
- [ ] Approving an agency results in `status = ACTIVE` and the Agency Head receives a welcome email
- [ ] A suspended agency's staff cannot authenticate (RLS check on `agencies.status`)
- [ ] Every admin action writes a timestamped `audit_logs` row
- [ ] The admin console is inaccessible to any JWT whose `role ≠ platform_admin`

---

# PHASE 2 — Agency Onboarding & Staff Management

## Objective
Enable examination agencies to register on the platform, undergo admin verification, and — once approved — log in, configure their portal, and manage their staff hierarchy. This is the entry point for all agency-side operations.

## Flows Covered
Flow 1 (Agency Registration & Onboarding)

## Dependencies
- Phase 0 (auth, schema, API skeleton)
- Phase 1 (admin approval endpoint must exist; agency cannot become ACTIVE without it)

## Downstream Connections
- Phase 3 (exam creation) requires `agency_staff` records with `AGENCY_HEAD` or `MANAGER` roles to exist
- All agency-side phases (3–13, 15) require an active agency and its staff

## Tables Touched
`agencies`, `agency_staff`, `audit_logs`

---

### Backend Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/agencies/register` | PUBLIC | Creates `agencies` row with `status = PENDING`. Body: `organization_name, official_email, pan_number, address, city, state, pincode, phone`. Writes `AGENCY_REGISTRATION_REQUESTED` to `audit_logs`. Returns `{id, status: "PENDING"}`. |
| GET | `/api/v1/agency/me` | Any agency staff | Returns current agency profile (`agencies` row) + caller's own `agency_staff` row. Used to hydrate the portal shell on every page load. |
| PATCH | `/api/v1/agency/me` | AGENCY_HEAD | Update agency profile fields (address, phone, logo). Cannot change `slug`, `pan_number`, or `status`. |
| GET | `/api/v1/agency/staff` | AGENCY_HEAD, MANAGER | List all `agency_staff` for this `agency_id`. Filterable by `role`, `is_active`. Returns id, full_name, email, phone, role, is_active, invited_at, joined_at. |
| POST | `/api/v1/agency/staff` | AGENCY_HEAD | Create a staff member: `{full_name, email, phone, role}`. Creates Supabase Auth user with a random temp password; creates `agency_staff` row with `invited_at = now()`; fires `send_staff_invite_email`. Writes `STAFF_MEMBER_ADDED` to `audit_logs`. |
| GET | `/api/v1/agency/staff/{id}` | AGENCY_HEAD, MANAGER | Single staff member detail. |
| PATCH | `/api/v1/agency/staff/{id}` | AGENCY_HEAD | Update `role` or `is_active`. Setting `is_active = false` revokes portal access at next JWT refresh. Writes `STAFF_ROLE_UPDATED` or `STAFF_DEACTIVATED` to `audit_logs`. |
| POST | `/api/v1/agency/staff/accept-invite` | Token-based (pre-session) | Called from the invite link. Body: `{invite_token, new_password}`. Validates the token, sets the password, updates `agency_staff.joined_at`. |
| DELETE | `/api/v1/agency/staff/{id}` | AGENCY_HEAD | Soft-delete: sets `is_active = false`. Never hard-deletes (audit trail must remain). |

### Celery / Background Jobs

| Task | Trigger | Action |
|---|---|---|
| `send_staff_invite_email` | `POST /agency/staff` | Emails staff member: welcome, role description, temporary-password link (24-hour expiry), login URL at `[slug].leakguard.in/login` |
| `send_staff_deactivation_email` | `PATCH /agency/staff/{id}` with `is_active = false` | Notifies staff member their access has been revoked |

### Frontend Routes

**`leakguard.in/agency/register` → `app/(public)/agency/register/page.tsx`**
Registration form in a centered card. Fields: Organization Name, Official Email, Phone, PAN/GST/Registration Number, full address (street, city, state, pincode). Single-page, no multi-step (registration is simple). Submit shows an "Application Submitted" confirmation state (green check icon, application reference number, message: "Our team will review your documents within 2 business days. You'll receive an email at [email] once approved."). No dashboard link — the user is in a waiting state.

**`[slug].leakguard.in/login` → `app/agency/[slug]/login/page.tsx`**
Email + password login. Agency name and logo resolved server-side from `slug`. If `agencies.status ≠ ACTIVE`, the page shows "This agency portal is not currently active" and blocks login. Forgot-password flow handled via Supabase Auth's own reset-email mechanism.

**`[slug].leakguard.in/accept-invite` → `app/agency/[slug]/accept-invite/page.tsx`**
"Set Your Password" form. Validates invite token from URL query param. Fields: New Password, Confirm Password (with strength indicator). On success, redirects to `/dashboard`.

**`[slug].leakguard.in/dashboard` → `app/agency/[slug]/dashboard/page.tsx`**
The Agency Portal shell. Layout: fixed left sidebar (80px collapsed, 240px expanded), top bar, main content area.

Sidebar items (conditionally rendered by role using the `role` claim from JWT):

| Nav Item | Visible To |
|---|---|
| Dashboard | All |
| Exams | AGENCY_HEAD, MANAGER |
| Staff | AGENCY_HEAD |
| Question Vault | AGENCY_HEAD, MANAGER, OPERATOR |
| Printing | AGENCY_HEAD, MANAGER, OPERATOR |
| Transit | AGENCY_HEAD, MANAGER, TRANSIT_MANAGER |
| Day-of Exam | AGENCY_HEAD, MANAGER, CENTER_OFFICER |
| Evaluation | AGENCY_HEAD, MANAGER, GRADING_TEACHER, MODERATOR, CHIEF_MODERATOR |
| Grievances | AGENCY_HEAD, MANAGER |
| Command Center | AGENCY_HEAD, MANAGER |

Dashboard body (default tab): 4 stat cards (active exams, total registrations, open grievances, pending evaluations). Below: "Recent Activity" — last 10 `audit_logs` entries for this agency. For AGENCY_HEAD, a notification bell in the top bar shows unread security alerts.

**`[slug].leakguard.in/staff` → `app/agency/[slug]/staff/page.tsx`**
`DataTable` of staff: name, email, role badge, status (Active / Invited / Deactivated), invited date, joined date. "Add Staff Member" button opens a `Modal` with the staff creation form (name, email, phone, role dropdown limited to the enum values in `agency_staff.role`). The `CHIEF_MODERATOR`, `MODERATOR`, `GRADING_TEACHER` roles are only assignable here — they do not appear in exam-specific staff dropdowns anywhere else. Row actions: Edit Role, Deactivate. Deactivate uses the `destructive` Button variant with a confirmation dialog.

### Acceptance Checklist — Phase 2
- [ ] An agency's subdomain and login are inaccessible until `status = ACTIVE` (RLS + middleware check)
- [ ] Staff role permissions are enforced server-side (403 for unauthorized roles) — never only client-side
- [ ] Sidebar nav items render exactly the right set per role with no cross-role leakage
- [ ] Setting `is_active = false` on a staff member invalidates their session at next JWT refresh
- [ ] Every staff management action writes a `STAFF_*` event to `audit_logs`

---

# PHASE 3 — Exam Creation & Lifecycle Management

## Objective
Allow agency staff to create a complete exam record — including all centers and rooms — have the AI automatically generate a formatted information brochure, and then manage the exam through its lifecycle state machine from DRAFT to RESULT_DECLARED. This phase creates the central data record that every downstream phase builds on.

## Flows Covered
Flow 2 (Exam Creation)

## Dependencies
- Phase 2 (agency staff with `AGENCY_HEAD` or `MANAGER` role must exist)
- Phase 0 (Celery + LLM API key for brochure generation)

## Downstream Connections
- Phase 4 (student registration) requires `exams.status = REGISTRATION_OPEN`
- Phase 5 (center allocation) requires `exam_centers` and `exam_rooms` to exist
- Phase 6 (vault) requires `exams` to exist for paper association
- Phase 7 (printing) requires `exam_centers` with room budgets defined
- Phase 9 (day-of) uses `exam_rooms.camera_stream_url` for CCTV routing
- Phase 12 (results) transitions the exam to `RESULT_DECLARED`

## Tables Touched
`exams`, `exam_centers`, `exam_rooms`, `agency_staff`, `audit_logs`

---

### Backend Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/exams` | AGENCY_HEAD, MANAGER | Create exam. Body: `{name, slug, mode, exam_date, start_time, duration_minutes, fee_inr, total_seats, eligibility_criteria (JSONB), syllabus, registration_open_at, registration_close_at, visibility_score_threshold}`. `status` defaults to `DRAFT`. Fires `generate_exam_brochure` task. Writes `EXAM_CREATED`. |
| GET | `/api/v1/exams` | All agency staff | List exams for this `agency_id`. Query params: `status`, `mode`, `page`. Each row includes center count and registration count. |
| GET | `/api/v1/exams/{id}` | All agency staff (evaluators scoped to `exam_scope` claim) | Full exam detail including `exam_centers` and `exam_rooms` arrays. |
| PATCH | `/api/v1/exams/{id}` | AGENCY_HEAD, MANAGER | Edit exam fields. Only allowed while `status = DRAFT` or `PUBLISHED`. Re-fires brochure generation if key fields change. |
| POST | `/api/v1/exams/{id}/centers` | AGENCY_HEAD, MANAGER | Add a center. Body: `{name, address, city, state, pincode, latitude, longitude, geofence_radius_meters, center_code, center_officer_id}`. `center_code` must be unique within the exam. |
| PATCH | `/api/v1/exams/{id}/centers/{center_id}` | AGENCY_HEAD, MANAGER | Edit center details. |
| DELETE | `/api/v1/exams/{id}/centers/{center_id}` | AGENCY_HEAD | Only allowed while exam is `DRAFT`. Cascades to delete associated rooms. |
| POST | `/api/v1/centers/{center_id}/rooms` | AGENCY_HEAD, MANAGER | Add a room. Body: `{room_code, seating_capacity, camera_stream_url}`. Initializes `current_occupancy = 0`. |
| PATCH | `/api/v1/centers/{center_id}/rooms/{room_id}` | AGENCY_HEAD, MANAGER | Edit room. |
| DELETE | `/api/v1/centers/{center_id}/rooms/{room_id}` | AGENCY_HEAD | Only while exam is `DRAFT`. |
| POST | `/api/v1/exams/{id}/publish` | AGENCY_HEAD | `DRAFT → PUBLISHED`. Validation: at least one center with at least one room must exist. Paper need not be vaulted yet. Writes `EXAM_PUBLISHED`. |
| POST | `/api/v1/exams/{id}/open-registration` | AGENCY_HEAD | `PUBLISHED → REGISTRATION_OPEN`. Writes `REGISTRATION_OPENED`. |
| POST | `/api/v1/exams/{id}/close-registration` | AGENCY_HEAD | `REGISTRATION_OPEN → REGISTRATION_CLOSED`. Writes `REGISTRATION_CLOSED`. |
| POST | `/api/v1/exams/{id}/regenerate-brochure` | AGENCY_HEAD, MANAGER | Re-fires the `generate_exam_brochure` Celery task. Returns `202 Accepted` + task ID. |
| GET | `/api/v1/exams/{id}/brochure-status` | AGENCY_HEAD, MANAGER | Polls brochure generation task status (PENDING / SUCCESS / FAILED). |

**Note on lifecycle transitions** `ADMIT_CARDS_ISSUED → ONGOING` and `ONGOING → PAPER_UPLOAD_PENDING`: these are triggered by Celery Beat scheduled tasks (not manual API calls), defined in Phase 5 and Phase 10 respectively.

### Celery / Background Jobs

| Task | Trigger | Schedule / Action |
|---|---|---|
| `generate_exam_brochure` | exam created or regenerate requested | LLM call with exam data (name, date, mode, fee, eligibility, syllabus, centers list, exam pattern) → generate formatted PDF brochure → upload to `brochures` bucket → update `exams.brochure_pdf_path`. On failure, set a `brochure_generation_failed` flag and notify the Manager. |
| `transition_exam_to_ongoing` | Celery Beat, fires at `exams.exam_date + start_time` | Sets `exams.status → ONGOING` for all exams scheduled at that time. Writes `EXAM_STARTED` to `audit_logs`. |
| `transition_exam_to_upload_pending` | Celery Beat, fires at `exam_date + start_time + duration_minutes` | Sets `exams.status → PAPER_UPLOAD_PENDING`. Notifies Center Officers to begin scanning. |

### Frontend Routes

**`[slug].leakguard.in/exams` → `app/agency/[slug]/exams/page.tsx`**
`DataTable` of exams. Columns: name, mode badge, date, duration, `status` badge (color-coded per lifecycle state), seats filled / total, actions. Status badges: DRAFT (gray), PUBLISHED (blue), REGISTRATION_OPEN (green with LiveDot), REGISTRATION_CLOSED (yellow), ADMIT_CARDS_ISSUED (teal), ONGOING (amber with LiveDot), PAPER_UPLOAD_PENDING (orange), EVALUATION_IN_PROGRESS (purple), RESULT_DECLARED (green). "Create Exam" button top-right.

**`[slug].leakguard.in/exams/new` → `app/agency/[slug]/exams/new/page.tsx`**
Multi-step `Stepper` form (5 steps). Each step saves independently to allow partial completion:

- **Step 1 — Basic Info**: Exam Name, Mode (Online/Offline toggle), Date, Start Time, Duration (minutes), Registration Open Date, Registration Close Date, Fee (INR), Total Seats
- **Step 2 — Eligibility**: Dynamic rule builder — Age Range (min/max), Required Qualification (dropdown: 10th/12th/Graduate/Postgraduate/Any), Category filters (General/OBC/SC/ST). The JSONB output from this step feeds `exams.eligibility_criteria`.
- **Step 3 — Syllabus**: Rich text editor OR PDF upload toggle. PDF uploads to `syllabus-pdfs` bucket immediately.
- **Step 4 — Centers & Rooms**: Repeatable center block. Each center has: Name, Address fields, GPS coordinates (manual input or map picker), Center Code, Geofence Radius, Center Officer assignment (dropdown of staff with `role = center_officer`). Within each center: nested repeatable room block (Room Code, Seating Capacity, Camera Stream URL). Running total of seats shown as rooms are added.
- **Step 5 — Review**: Read-only summary of all inputs. "Save as Draft" button. Shows brochure generation status after save.

The `Stepper` component orchestrates: Step 1 fires `POST /exams`, Steps 2–3 fire `PATCH /exams/{id}`, Step 4 fires `POST /exams/{id}/centers` and `POST /centers/{id}/rooms` in sequence. On any step's API call failing, the stepper stays on that step and shows the error — it never silently advances.

**`[slug].leakguard.in/exams/[examId]` → `app/agency/[slug]/exams/[examId]/page.tsx`**
Exam workspace — the hub for all exam-specific operations. Layout: sticky header showing exam name, status badge, and the single valid next-action button for the current lifecycle state (e.g. "Publish Exam" while DRAFT; "Open Registration" while PUBLISHED; disabled with reason while checks don't pass). Below header: horizontal tab bar linking to:

| Tab | Phase Built In |
|---|---|
| Overview | Phase 3 |
| Centers & Rooms | Phase 3 |
| Registrations | Phase 4 |
| Center Allocation | Phase 5 |
| Admit Cards | Phase 5 |
| Question Vault | Phase 6 |
| Printing | Phase 7 |
| Transit | Phase 8 |
| Day-of Exam | Phase 9 |
| Answer Sheets | Phase 10 |
| Evaluation | Phase 11 |
| Results | Phase 12 |

Each tab is built in its respective phase. Tabs not yet applicable to the current exam state are visually dimmed (not hidden — the user needs to know the full lifecycle exists).

**`[slug].leakguard.in/exams/[examId]/brochure` → `app/agency/[slug]/exams/[examId]/brochure/page.tsx`**
Shows brochure generation status (spinner if PENDING, error panel if FAILED, PDF viewer if SUCCESS). "Regenerate" button. "Preview as Student" link that opens the same PDF viewer as the public exam detail page.

**`[slug].leakguard.in/exams/[examId]/centers` → `app/agency/[slug]/exams/[examId]/centers/page.tsx`**
Grid of center cards. Each card: center name, city, code (monospace), total rooms, total seats, assigned Center Officer name. Click opens a `SideDrawer` with room list (table: room code, capacity, current occupancy once exam starts, camera URL). Add/Edit/Remove center buttons — Remove only active while `DRAFT`.

### Acceptance Checklist — Phase 3
- [ ] Exam cannot move from `DRAFT → PUBLISHED` without at least one center with at least one room
- [ ] `transition_exam_to_ongoing` Celery task fires at exactly `exam_date + start_time` and transitions the correct exams only
- [ ] `transition_exam_to_upload_pending` fires at `start_time + duration_minutes`
- [ ] Regenerating the brochure replaces the storage object at the same path and updates `brochure_pdf_path`
- [ ] Status badge and next-action button always reflect the current state — never a stale cached state

---

# PHASE 4 — Student Portal: Account, Exam Discovery, Registration & Payment

## Objective
Give student candidates a portal to create their account (including biometric photo and identity proof), browse all published exams across all agencies, register for a specific exam with ranked center preferences, and pay the exam fee. This phase creates the `students` and `exam_registrations` records that every downstream student-facing phase depends on.

## Flows Covered
Flow 3 (Student Registration & Payment)

## Dependencies
- Phase 0 (auth, biometric hash Celery job)
- Phase 3 (exams must be `REGISTRATION_OPEN`)
- Phase 1 (public exam listing used as entry point)

## Downstream Connections
- Phase 5 (center allocation + admit cards) reads `exam_registrations` and `center_preference_1/2/3`
- Phase 9 (day-of check-in) validates against `students.biometric_hash`
- Phase 12 (results) reads `students.phone` for OTP verification
- Phase 15 (grievances) links to `students.id`

## Tables Touched
`students`, `exam_registrations`, `exams`, `exam_centers`, `audit_logs`

---

### Backend Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/students/register` | PUBLIC | Creates Supabase Auth user + `students` row. Body: `{full_name, email, phone, date_of_birth, gender, address, city, state, pincode, id_proof_type, id_proof_number}`. Multipart: `photo` (image file) + `id_proof_scan` (image/PDF). Fires `generate_biometric_hash` and `upload_id_proof` tasks. Returns `{student_id, status: "ACCOUNT_CREATED"}`. |
| GET | `/api/v1/students/me` | STUDENT | Own profile. Includes `biometric_hash` presence flag (boolean) but never the hash value itself. |
| PATCH | `/api/v1/students/me` | STUDENT | Update non-identity fields (address, phone). Photo and ID proof updates go through a separate verification flow. |
| GET | `/api/v1/exams/{examId}/registration-form` | STUDENT | Returns: eligibility document requirements for this exam, list of `exam_centers` (id, name, city — no GPS) for preference ranking, whether the student is already registered. |
| POST | `/api/v1/exams/{examId}/registrations` | STUDENT | Creates `exam_registrations` with `status = PENDING_PAYMENT`. Body: `{center_preference_1, center_preference_2, center_preference_3}` (all center IDs). Validates: exam is `REGISTRATION_OPEN`, `total_seats` not yet reached, student not already registered for this exam. Returns `{registration_id, application_number_preview}`. |
| POST | `/api/v1/registrations/{id}/payment/initiate` | STUDENT | Validates ownership. Creates a Razorpay order (amount = `exams.fee_inr * 100` paise). Returns Razorpay checkout payload to the frontend. |
| POST | `/api/v1/payments/webhook` | PUBLIC, Razorpay signature verified | On `payment.captured` event: sets `payment_status = SUCCESS`, `status = REGISTERED`, generates `application_number` (format: `LG-{YEAR}-{5-digit-sequential}`), sets `registered_at = now()`, fires `send_registration_confirmation`. On `payment.failed`: sets `payment_status = FAILED`, status remains `PENDING_PAYMENT` (retryable). Writes `STUDENT_REGISTERED` or `PAYMENT_FAILED` to `audit_logs`. |
| GET | `/api/v1/students/me/registrations` | STUDENT | All of the student's registrations across all agencies and exams. Returns registration status, exam name, agency name, and links to admit card + result (when available). |
| GET | `/api/v1/registrations/{id}` | STUDENT (own) | Single registration detail. |

### Celery / Background Jobs

| Task | Trigger | Action |
|---|---|---|
| `generate_biometric_hash` | student photo uploaded | Face-embedding model (e.g., FaceNet / InsightFace) processes the uploaded photo → generates a cryptographic hash of the face embedding → stores in `students.biometric_hash`. On failure, marks the student account as `BIOMETRIC_PENDING` and prompts re-upload. |
| `upload_id_proof` | registration | Uploads ID proof scan to `evidence-uploads` bucket (service-role, not publicly accessible), stores path in `students.id_proof_path`. Encrypts the `id_proof_number` field at rest. |
| `send_registration_confirmation` | payment webhook success | Emails the student: Application Number, exam name, date, center preferences submitted, next steps (admit card will be available after [date]). |
| `check_registration_seat_limit` | Celery Beat, periodic | Checks if `exam_registrations` count equals `exams.total_seats`; if so, automatically fires `close-registration` transition. |

### Frontend Routes

**`leakguard.in/student/register` → `app/(public)/student/register/page.tsx`**
Student registration in two sections. Section 1 — Personal Details: Full Name, Email, Phone, Date of Birth, Gender, Address/City/State/Pincode. Section 2 — Identity: ID Proof Type dropdown (Aadhaar / PAN / Passport), ID Proof Number (masked input), ID Proof scan upload, and — most importantly — a **Photo Capture** widget. The widget offers two modes: "Take Photo" (webcam with a live face-detection overlay that shows a green outline when a face is centered, and a "Capture" button) or "Upload Photo" (file picker). Clear disclosure text below the photo widget: "This photo will be used for biometric identity verification on exam day. Ensure your face is clearly visible, well-lit, and centered." Submit button disabled until biometric hash generation completes (shows a "Verifying your photo..." spinner). On success, redirects to `/student/dashboard`.

**`leakguard.in/student/login` → `app/(public)/student/login/page.tsx`**
Standard email + password login. "Forgot Password" link. After login, redirects to `/student/dashboard` or back to the `redirect` query param.

**`leakguard.in/student/dashboard` → `app/(public)/student/dashboard/page.tsx`**
Student's home. Top: greeting with name. Below: "My Exams" card list. Each card: exam name, agency name, status pill (Pending Payment / Registered / Admit Card Ready / Appeared / Result Declared), and action buttons that change with status (Pay Now / Download Admit Card / View Result). Empty state: "No exams yet. Browse exams to get started →" with a link to the public listing. A persistent "Biometric Status" banner appears if `biometric_hash` is null — warning the student their account is not yet ready for exam day.

**`leakguard.in/student/exams/[examId]` → `app/(public)/student/exams/[examId]/page.tsx`**
Same as the public exam detail page (`app/(public)/exams/[examId]/page.tsx`) but with the "Register" button activating the registration flow when the student is logged in.

**`leakguard.in/student/exams/[examId]/register` → `app/(public)/student/exams/[examId]/register/page.tsx`**
Two-section registration form:
- Section 1 — Your Details: read-only profile summary (name, DOB, photo thumbnail) with an "Edit Profile" link. Eligibility document uploads if required by the exam.
- Section 2 — Center Preferences: a drag-to-reorder list of exam centers. Student ranks their top 3 (or as many as the exam has). Each center shows: name, city, total seats, seats remaining. A tooltip clarifies: "We'll try to allocate your top preference. Preferences help us; allocation is not guaranteed."

Submit button validates center preferences are selected and eligibility docs are uploaded. On submit: fires `POST /exams/{examId}/registrations` then redirects to the payment page.

**`leakguard.in/student/exams/[examId]/payment` → `app/(public)/student/exams/[examId]/payment/page.tsx`**
Razorpay checkout embed with the exam fee. Shows: exam name, fee amount, application number preview. On Razorpay success callback: displays "Payment successful!" with the confirmed Application Number in a large monospace block, and a button to go to the dashboard. On failure: "Payment failed. You can retry from your dashboard." — never strands the user.

### Acceptance Checklist — Phase 4
- [ ] Registration is blocked the moment `exams.status` leaves `REGISTRATION_OPEN`
- [ ] A failed payment leaves the registration in `PENDING_PAYMENT` — retryable from the dashboard
- [ ] `total_seats` limit is enforced at the API level with a DB constraint or atomic check, not just application-level
- [ ] A student cannot register twice for the same exam (unique constraint on `student_id + exam_id` in `exam_registrations`)
- [ ] `biometric_hash` must be non-null before admit card generation is permitted in Phase 5 (API pre-check)
- [ ] `id_proof_number` is encrypted at rest in the database

---

# PHASE 5 — Center Allocation & Admit Card Generation

## Objective
After registration closes, run the priority-weighted random center allocation algorithm to assign every registered student an exam center, then generate cryptographically signed admit cards with a JWT-embedded biometric QR code. This phase produces the physical artifact (admit card PDF) and the cryptographic artifact (signed QR JWT) that the entire day-of security system depends on.

## Flows Covered
Flow 4 (Center Allocation & Admit Card Generation)

## Dependencies
- Phase 4 (`exam_registrations` with `status = REGISTERED` must exist)
- Phase 3 (`exam_centers` and `exam_rooms` must exist with capacities defined)
- Phase 0 (`ADMIT_CARD_JWT_PRIVATE_KEY` env var must be set)

## Downstream Connections
- Phase 9 (day-of check-in) scans and validates the JWT embedded in the QR code
- Phase 9 (biometric match) uses `admit_cards.qr_biometric_hash` for face matching
- Phase 15 (student grievances) links `student_id` → `room_allocations` → CCTV room

## Tables Touched
`exam_registrations`, `center_allocations`, `exam_centers`, `exam_rooms`, `admit_cards`, `students`, `audit_logs`

---

### Backend Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/exams/{id}/close-registration` | AGENCY_HEAD | `REGISTRATION_OPEN → REGISTRATION_CLOSED`. Writes `REGISTRATION_CLOSED` to `audit_logs`. |
| POST | `/api/v1/exams/{id}/allocate-centers` | AGENCY_HEAD, MANAGER | Fires `allocate_centers` Celery task. Returns `{job_id, status: "QUEUED"}`. |
| GET | `/api/v1/exams/{id}/allocation-status` | AGENCY_HEAD, MANAGER | Polls task status. Returns `{status, allocated_count, fallback_count, unallocated_count}` when done. |
| GET | `/api/v1/exams/{id}/allocations` | AGENCY_HEAD, MANAGER | Paginated table of `center_allocations` joined with student name, allocated center, preference rank matched. Exportable to CSV. |
| POST | `/api/v1/exams/{id}/generate-admit-cards` | AGENCY_HEAD | Fires `generate_admit_cards` task after verifying all registrations have a `center_allocations` record. Returns `{job_id}`. |
| GET | `/api/v1/exams/{id}/admit-cards-status` | AGENCY_HEAD, MANAGER | Polls generation progress: `{generated_count, total_count, status}`. |
| GET | `/api/v1/registrations/{id}/admit-card` | STUDENT (own) / AGENCY_HEAD, MANAGER | Returns signed URL for the `admit_cards.pdf_path`. Never returns raw JWT or key material. Validates that `admit_cards.is_valid = true`. |

### Celery / Background Jobs

| Task | Trigger | Action |
|---|---|---|
| `allocate_centers` | `POST /exams/{id}/allocate-centers` | For each `REGISTERED` student in the exam, in randomized order (to prevent alphabetical bias): (1) Try `center_preference_1` — check if `exam_centers` has remaining capacity (sum of `exam_rooms.seating_capacity` minus existing `center_allocations` count for that center). If capacity available, allocate with `preference_rank_matched = 1`. (2) Try preference 2, then 3. (3) If all three preferences are full, find the nearest center with remaining capacity using Haversine distance between `students.city` (geocoded) and `exam_centers.latitude/longitude`. Allocate with `preference_rank_matched = 0` (fallback). Insert `center_allocations` record for each student. On completion, notify Manager. |
| `generate_admit_cards` | `POST /exams/{id}/generate-admit-cards` | For each allocated student: (1) Build JWT payload: `{student_id, exam_id, center_id, biometric_hash, iat, exp: exam_date+2_days}`. Sign with `ADMIT_CARD_JWT_PRIVATE_KEY` (RS256 — asymmetric so center terminals can verify with the public key without ever holding the private key). (2) Render QR code image from the JWT string. (3) Generate admit card PDF: student name and photo, Application Number (monospace), Exam Name and Agency, Date + Time + Duration, Allocated Center (name, address, reporting time = start_time - 1 hour), QR code, instructions. Upload to `admit-cards` bucket at path `{exam_id}/{student_id}/admit_card.pdf`. (4) Insert `admit_cards` record. (5) On completion: set `exams.status → ADMIT_CARDS_ISSUED`, email all students. |
| `send_admit_card_ready_email` | On `generate_admit_cards` completion | Emails each student: "Your admit card for [Exam Name] is ready. Download it from your portal." + link to student dashboard. |

### Frontend Routes

**`[slug].leakguard.in/exams/[examId]/allocation` → Exam workspace "Center Allocation" tab**
Three-state UI driven by exam lifecycle:
1. **Pre-close state** (exam still `REGISTRATION_OPEN`): Shows current registration count vs total seats, live-updating via Supabase Realtime. "Close Registration" button (security variant — amber border, requires confirmation).
2. **Closed, not yet allocated** (exam `REGISTRATION_CLOSED`): Summary of registrations. "Run Center Allocation" button. On click, shows a progress bar that polls `allocation-status`. Completion shows summary stats (preference 1 matched: X%, fallback: Y%) and a preview of the allocation table.
3. **Allocated** (allocations exist): Full allocation table — student name, Application Number, preference matched (shown as "1st choice ✓" / "2nd choice ✓" / "Fallback"), allocated center name. Exportable. "Generate Admit Cards" button enabled.

**`leakguard.in/student/exams/[examId]/admit-card` → `app/(public)/student/exams/[examId]/admit-card/page.tsx`**
Student-facing admit card page. States:
- **Not yet generated**: "Your admit card is not ready yet. Check back after [date]." with a countdown timer.
- **Ready**: `PDFViewer` showing the admit card PDF. "Download PDF" button. Large text warning: "Print this admit card and carry it on exam day. You will also need a valid photo ID."

### Acceptance Checklist — Phase 5
- [ ] Allocation never assigns a student to a center exceeding its summed room capacity
- [ ] `preference_rank_matched = 0` is correctly set for fallback allocations
- [ ] The admit card JWT is signed with `ADMIT_CARD_JWT_PRIVATE_KEY` (RS256, asymmetric) — not Supabase Auth's signing key
- [ ] The JWT `exp` is set to `exam_date + 2 days` (covers same-day validity through exam end)
- [ ] A student can fetch only their own admit card (ownership check in API)
- [ ] `exams.status` transitions to `ADMIT_CARDS_ISSUED` after all cards are generated

---

# PHASE 6 — Secure Question Paper Vault

## Objective
Provide a session-monitored, surveillance-active upload interface for question papers, encrypt them immediately with split-key AES-256-GCM (key shares distributed between Supabase Vault and an HSM), and schedule the automated in-RAM decryption to occur at the precise exam window. This is Agent 1 of the multi-agent security system. No human ever holds the full decryption key.

## Flows Covered
Flow 5 (Question Paper Vault)

## Dependencies
- Phase 3 (exam must exist and have an `exam_id`)
- Phase 0 (`HSM_KEY_SHARE_ENDPOINT`, `SUPABASE_VAULT_KEY_STORE_ID` env vars set; `question-papers-vault` bucket created as service-role-only)

## Downstream Connections
- Phase 7 (printing) receives the decrypted paper from `schedule_paper_decryption_for_print`
- Phase 8 (CBT) receives the decrypted paper from `schedule_paper_decryption_for_cbt`
- Phase 13 (leak investigation) reads `paper_vault_access_logs` as part of Agent 7's cross-reference

## Tables Touched
`question_papers`, `paper_vault_access_logs`, `agency_staff`, `audit_logs`

---

### Backend Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/exams/{id}/papers/upload-session/start` | AGENCY_HEAD (or designated PAPER_SETTER sub-role — model as AGENCY_HEAD for now) | Issues a short-lived session token (15-min expiry, stored in Redis). Activates server-side monitoring flags. Writes `VAULT_UPLOAD_SESSION_STARTED` to `paper_vault_access_logs` (access_type: `UPLOAD`) and `audit_logs`. Returns `{session_token}`. |
| POST | `/api/v1/exams/{id}/papers` | Requires valid `session_token` header | Multipart upload: PDF file. Server-side: (1) validates session token is active and belongs to this user. (2) Generates a random AES-256-GCM key. (3) Encrypts the PDF in-process. (4) Splits the key into Share 1 (stored in Supabase Vault) and Share 2 (stored in HSM via `HSM_KEY_SHARE_ENDPOINT`). (5) Stores ciphertext to `question-papers-vault` bucket. (6) Inserts `question_papers` row with `status = VAULTED`. (7) Fires `schedule_paper_decryption`. (8) Captures and saves a webcam snapshot to `webcam-snapshots` bucket. Writes `PAPER_UPLOADED_AND_VAULTED` to `audit_logs`. Key material is never written to the database. |
| POST | `/api/v1/papers/upload-session/{token}/end` | Valid session token | Ends the monitoring session. Saves screen recording path to `question_papers.upload_session_recording_path`. Invalidates the session token in Redis. |
| GET | `/api/v1/exams/{id}/papers` | AGENCY_HEAD, MANAGER | Returns paper status only (`VAULTED / DECRYPTED_FOR_PRINT / DECRYPTED_FOR_CBT / ARCHIVED`). Never returns any ciphertext, key share, or path to the vault bucket. |
| GET | `/api/v1/exams/{id}/papers/vault-access-log` | AGENCY_HEAD | Returns the `paper_vault_access_logs` for this paper. Used for internal audit. |

### Celery / Background Jobs

| Task | Trigger | Action |
|---|---|---|
| `yolo_phone_detection_session` | Upload session started | Subscribes to a WebSocket stream of webcam frames from the client. Runs YOLOv8 `phone_detector` model on each frame. On phone detection: (1) Creates a `paper_vault_access_logs` entry with `access_type = ADMIN_REVIEW` and a note flagging phone detection. (2) Sends an immediate alert notification to the AGENCY_HEAD. (3) Saves the detection snapshot to `webcam-snapshots`. |
| `schedule_paper_decryption` | Paper vaulted, exam date/time known | Schedules two Celery Beat one-off tasks: (1) `decrypt_paper_for_print` at `exam_date - [configured_lead_time, default 2 days]` (offline exams only). (2) `decrypt_paper_for_cbt` at `exam_start_time - 5 minutes` (online exams only). |
| `decrypt_paper_for_print` | Scheduled by `schedule_paper_decryption` | (1) Fetches Key Share 1 from Supabase Vault. (2) Fetches Key Share 2 from HSM. (3) Combines shares in server RAM only — never written to disk. (4) Decrypts paper. (5) Hands decrypted content to the Print Module (Phase 7). (6) Immediately zeros the key variable from RAM. (7) Updates `question_papers.status → DECRYPTED_FOR_PRINT`. (8) Writes `PAPER_DECRYPTED_FOR_PRINT` to `paper_vault_access_logs` and `audit_logs`. |
| `decrypt_paper_for_cbt` | Scheduled at `exam_start_time - 5 min` | Same key assembly, decryption, and zeroing as above. Pushes the decrypted paper to the exam center's local server via TLS 1.3. Paper remains encrypted on the local server until a student authenticates and starts their session. Updates `status → DECRYPTED_FOR_CBT`. |

### Frontend Routes

**`[slug].leakguard.in/exams/[examId]/vault` → Exam workspace "Question Vault" tab**

The vault UI has three states:

1. **Pre-upload (no paper vaulted yet)**: A disclosure screen. Header: "Secure Upload Session." Below it, a list of what will happen during the session (using `SecureEventLog` styling):
   - `[WEBCAM]` Your camera will be active and monitored for unauthorized recording devices
   - `[CLIPBOARD]` Clipboard will be disabled for the duration of the session
   - `[SCREEN]` Session will be recorded as an audit trail
   
   A required checkbox: "I understand this session is monitored and recorded." Submit only enables after checkbox. "Start Secure Session" button (security variant).

2. **Active session**: Full-screen locked UI. Top bar shows: session timer (counting up), a red "SESSION ACTIVE" badge with LiveDot, a miniature webcam preview tile (1/4 size, top-right corner), and a visible clipboard-blocked icon. Main area: file drop zone for PDF upload. Progress bar on upload. After upload completes, shows `SecureEventLog` strip: `[{timestamp}] Paper uploaded and encrypted. Status: VAULTED. Key shares distributed.` "End Session" button.

3. **Paper vaulted**: Status display only. Shows `question_papers.status` in a large monospace badge (e.g. `VAULTED`). Scheduled decryption times displayed (print: `{date}`, CBT: `{time}`). Access log link. "Replace Paper" button (only available before `DECRYPTED_FOR_PRINT` — triggers a new upload session and archives the previous paper version).

### Acceptance Checklist — Phase 6
- [ ] No API response ever contains a full decryption key or both shares together
- [ ] Key material is never written to any database table or storage — only the split references
- [ ] Every vault access (upload, view, any decrypt) writes a `paper_vault_access_logs` row with `accessor_id`, `access_type`, `ip_address`, and `webcam_snapshot_path`
- [ ] The upload is rejected server-side if no active session token was established first
- [ ] YOLOv8 phone detection fires an alert to AGENCY_HEAD on detection
- [ ] `decrypt_paper_for_print` and `decrypt_paper_for_cbt` tasks zero the key variable after use (assert in tests)

---

# PHASE 7 — Intelligent Printing Module (Offline Exams Only)

## Objective
Control every aspect of the question paper printing process for offline exams: enforce print authorization (operator identity, copy count budget, time window), embed a steganographic tracking matrix code in every printed page linking that page to a specific center, printer, operator, and exact timestamp, and run YOLOv8 surveillance in the print room during the print window. This is Agents 2, 3, and 4 of the security system.

## Flows Covered
Flow 6 (Offline Exam — Printing & Transit, Steps 6.1–6.3)

## Dependencies
- Phase 6 (paper must be in `DECRYPTED_FOR_PRINT` state before printing begins)
- Phase 3 (`exam_centers`, `exam_rooms` with seating capacities must exist — defines copy budget)
- Phase 2 (operator accounts must exist)
- Phase 0 (`WATERMARK_MASTER_KEY` env var set; watermarking service built)

## Downstream Connections
- Phase 8 (transit) uses `print_jobs.id` to create `transit_trunks`
- Phase 13 (leak investigation) uses `print_watermark_registry` as Agent 7's primary data source

## Tables Touched
`print_jobs`, `print_watermark_registry`, `print_room_surveillance_alerts`, `question_papers`, `exam_centers`, `exam_rooms`, `agency_staff`, `audit_logs`

---

### Backend Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/exams/{id}/print-jobs` | AGENCY_HEAD, MANAGER, OPERATOR | List all print jobs for this exam. Filterable by `center_id`, `status`. |
| POST | `/api/v1/exams/{id}/print-jobs` | OPERATOR | Initiate a print job. Body: `{center_id, copies_requested, printer_id}`. Server validates: (1) Operator is authorized for this exam. (2) Current time is within the configured print window. (3) `copies_requested ≤ sum of exam_rooms.seating_capacity for this center` (the copy budget). On all checks passing: creates `print_jobs` with `status = APPROVED`, fires `execute_print_job` task. On copy overrun: status `BLOCKED_OVER_BUDGET`, alert to Manager. On time anomaly: status `BLOCKED_ANOMALOUS_TIME`, terminal-lock flag set, alert to Manager. Writes `PRINT_JOB_INITIATED` to `audit_logs`. |
| GET | `/api/v1/print-jobs/{id}` | AGENCY_HEAD, MANAGER, OPERATOR (own jobs) | Status of a specific print job including all `print_room_surveillance_alerts`. |
| PATCH | `/api/v1/print-jobs/{id}/review-alert/{alert_id}` | MANAGER | Review a surveillance alert. Body: `{review_outcome: "DISMISSED" | "ESCALATED" | "ACTION_TAKEN"}`. |
| POST | `/api/v1/print-jobs/{id}/surveillance/start` | OPERATOR | Signals that print room cameras are live. Fires `run_print_room_surveillance` task. |
| POST | `/api/v1/print-jobs/{id}/surveillance/stop` | OPERATOR | Stops surveillance task. |

### Celery / Background Jobs

| Task | Trigger | Action |
|---|---|---|
| `execute_print_job` | Print job approved | (1) Updates `print_jobs.status → PRINTING`, sets `print_started_at`. (2) Invokes the print middleware: sends the decrypted paper to the printer identified by `printer_id`. (3) For each page × each copy, generates a Tracking Matrix Code via `services/watermarking.py`: encodes `center_code | printer_id | operator_id | timestamp | page_number | copy_number` using steganographic embedding (low-visibility pattern overlaid on the page). (4) Inserts one `print_watermark_registry` row per page per copy with all embedded values. (5) Updates `print_jobs.status → COMPLETED`, sets `print_completed_at`. Writes `PRINT_JOB_COMPLETED` to `audit_logs`. |
| `run_print_room_surveillance` | Surveillance started | Subscribes to the print room camera feed (RTSP/WebRTC). Runs YOLOv8 `phone_detector` and `behavior_detector` models continuously. On detection of: `MOBILE_PHONE_DETECTED`, `UNAUTHORIZED_PERSON`, `EXTRA_PAGES_TAKEN`, `ANOMALOUS_BEHAVIOR`: (1) Inserts `print_room_surveillance_alerts` with `alert_type`, `confidence_score`, `snapshot_path`. (2) Pushes real-time alert to Agency Command Center dashboard via Supabase Realtime. (3) Sends alert email to Manager. |

### Frontend Routes

**`[slug].leakguard.in/exams/[examId]/printing` → Exam workspace "Printing" tab**
Only visible for `mode = OFFLINE` exams.

Left panel — Print Job Initiation (OPERATOR view):
- Center selector (dropdown of this exam's centers)
- Printer ID input (pre-filled if the terminal has been registered)
- Copies to Print input (shows the center's seat budget as a ceiling — input turns red if exceeded)
- Print Time Window indicator (green "Within window" / amber "Outside allowed hours")
- "Start Print Job" button (disabled if outside window or over budget)

Right panel — Print Job History:
- `DataTable` of all print jobs for this exam: job ID (monospace), center, operator name, copies requested, copies budget, status badge, initiated time
- Row click expands to show all `print_room_surveillance_alerts` for that job (alert type badge, confidence score, thumbnail snapshot, review status)

Command Center alert feed (top-right, visible to MANAGER and AGENCY_HEAD): live Supabase Realtime stream of `print_room_surveillance_alerts`. Each alert appears as an `AlertBanner` with amber background, alert type, confidence score, and camera ID.

### Acceptance Checklist — Phase 7
- [ ] `copies_requested > copies_budget` blocks the print job at the API level — never just a client-side warning
- [ ] A print job initiated outside the configured time window is blocked and the operator's terminal is flagged
- [ ] `print_watermark_registry` has exactly `copies_requested × pages_in_paper` rows after a completed job
- [ ] YOLOv8 detection alerts appear on the Agency Command Center dashboard within 5 seconds of detection
- [ ] No API response ever returns the decrypted paper content directly — only the print middleware receives it

---

# PHASE 8 — Chain-of-Custody Transit Module (Offline Exams Only)

## Objective
Track printed exam papers from the print facility to each exam center using IoT-enabled GPS trunks. Enforce geofenced transit routes, detect deviations, and require a three-factor handoff (GPS location + OTP + biometric) at the destination before the trunk unlocks. This is Agents 5 and 6 of the security system.

## Flows Covered
Flow 6 (Offline Exam — Printing & Transit, Steps 6.4–6.6)

## Dependencies
- Phase 7 (a completed `print_jobs` record must exist for the trunk to be created)
- Phase 2 (TRANSIT_MANAGER and CENTER_OFFICER accounts must exist)
- Phase 0 (MQTT broker running; `SMS_OTP_PROVIDER_KEY` set)

## Downstream Connections
- Phase 9 (day-of check-in) requires the trunk to have been successfully unlocked (`transit_trunks.status = UNLOCKED`) before the exam can proceed at that center
- Phase 13 (leak investigation) reads `transit_events` and `transit_geofence_violations` as part of Agent 7's cross-reference

## Tables Touched
`transit_trunks`, `transit_events`, `transit_geofence_violations`, `print_jobs`, `exam_centers`, `agency_staff`, `audit_logs`

---

### Backend Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/print-jobs/{id}/trunks` | AGENCY_HEAD, MANAGER | Create a trunk for a completed print job. Body: `{trunk_code, center_id, assigned_transit_manager_id, device_imei}`. Sets `status = SEALED`, `sealed_at = now()`. Writes `TRUNK_SEALED` to `audit_logs`. |
| GET | `/api/v1/exams/{id}/trunks` | AGENCY_HEAD, MANAGER, TRANSIT_MANAGER | List all trunks for this exam. Returns: trunk code, center destination, status, assigned transit manager, last known GPS, current status. |
| GET | `/api/v1/trunks/{id}` | AGENCY_HEAD, MANAGER, TRANSIT_MANAGER (own) | Full trunk detail including all `transit_events` (GPS history) and any `transit_geofence_violations`. |
| POST | `/api/v1/trunks/{id}/dispatch` | TRANSIT_MANAGER | Marks departure: `transit_trunks.status → IN_TRANSIT`, `dispatched_at = now()`. Writes `TRUNK_DISPATCHED`. GPS tracker begins streaming telemetry via MQTT. |
| POST | `/api/v1/trunks/{id}/unlock/request` | CENTER_OFFICER | Initiates the unlock handshake. Validates: (1) Caller has `role = center_officer`. (2) `transit_trunks.status = IN_TRANSIT`. (3) Request body includes GPS coordinates from Center Officer's device; validates within `exam_centers.geofence_radius_meters` of the center. If GPS valid: sends OTP to Center Officer's registered mobile, stores OTP in Redis with 5-min TTL, sets `trunk.unlock_otp_sent_at`. Returns `{otp_sent: true, expires_in_seconds: 300}`. If GPS invalid: returns `{error: "OUTSIDE_GEOFENCE"}`. |
| POST | `/api/v1/trunks/{id}/unlock/confirm` | CENTER_OFFICER | Completes the unlock. Body: `{otp, biometric_data}`. Server validates: (1) OTP against Redis entry. (2) Biometric scan (face match against Center Officer's `agency_staff` biometric). On all passing: `transit_trunks.status → DELIVERED`, sets `unlocked_at`, `unlocked_by`, `unlock_gps_*`. Writes `TRUNK_UNLOCKED_AT_CENTER` to `audit_logs`. |
| POST | `/api/v1/trunks/{id}/receipt-confirm` | CENTER_OFFICER | Center Officer confirms correct paper set received. Body: `{papers_correct: true | false}`. If `false`: triggers `COMPROMISED` flag and immediate alert. |
| POST | `/api/v1/mqtt/telemetry` | Internal (MQTT consumer pushes here) | Receives GPS telemetry from MQTT consumer task. Inserts `transit_events`. Runs geofence check (Haversine). If deviation > threshold: creates `transit_geofence_violations`, sets `trunk.status → COMPROMISED`, sends immediate alert. |
| GET | `/api/v1/trunks/{id}/violations` | AGENCY_HEAD, MANAGER | List geofence violations for this trunk. |
| PATCH | `/api/v1/trunks/{id}/violations/{vid}/resolve` | MANAGER | Add `resolution` text and `resolved_at` to a violation. |

### Celery / Background Jobs

| Task | Trigger | Action |
|---|---|---|
| `consume_trunk_telemetry` | Continuous MQTT subscriber (runs as a long-lived Celery task) | Subscribes to `trunks/+/telemetry` MQTT topic. For each message: parses `{trunk_id, latitude, longitude, speed_kmh, timestamp}`, posts to `/api/v1/mqtt/telemetry`, which writes to `transit_events` and runs geofence validation. |
| `send_geofence_violation_alert` | `transit_geofence_violations` row created | Sends immediate push notification + email to TRANSIT_MANAGER and AGENCY_HEAD with: trunk code, current GPS, deviation distance, map link. |
| `otp_cleanup` | Celery Beat, every 1 min | Removes expired OTP entries from Redis (`unlock_otp:*` keys). |

### Frontend Routes

**`[slug].leakguard.in/exams/[examId]/transit` → Exam workspace "Transit" tab**
Only visible for `mode = OFFLINE` exams.

Two panels:

**Left — Trunk List**: Table of trunks: trunk code (monospace), destination center, transit manager name, status badge (SEALED / IN_TRANSIT with LiveDot / DELIVERED / COMPROMISED in red / UNLOCKED), dispatched time, last GPS ping time. "Create Trunk" button (MANAGER+ only).

**Right — Live Map**: An interactive map (Leaflet.js or Mapbox) showing:
- Destination center markers (blue pin with center name)
- Each active trunk's last known GPS position (truck icon)
- The approved route as a polyline (if configured)
- Geofence violation markers (red X)

Clicking a trunk opens a `SideDrawer` with: full GPS history (line chart of speed over time), all telemetry events (scrollable table: timestamp, lat/lon, on_route boolean), and violation records.

**`[agency-slug].leakguard.in/center/[examId]/trunk-unlock` → `app/agency/[slug]/center/[examId]/trunk-unlock/page.tsx`**
Center Officer day-of trunk unlock page (accessible from the CENTER_OFFICER's portal). Three-step UI:

1. **GPS Verification**: "Share your location" browser geolocation request. Shows current coordinates vs required center coordinates. Green check if within geofence, red warning if outside. "Request OTP" button enabled only when within geofence.
2. **OTP Verification**: 6-digit OTP input (sent to Center Officer's mobile). 5-minute countdown timer. "Resend OTP" after 60 seconds.
3. **Biometric Verification**: `BiometricCapture` component — live camera, "Capture" button. Shows match result. On success: "Trunk Unlocked" confirmation with `SecureEventLog` strip: `[{timestamp}] Trunk {code} unlocked at {center_name}. GPS: {lat}, {lon}. Officer: {name}.`

### Acceptance Checklist — Phase 8
- [ ] Trunk unlock requires all three factors (GPS + OTP + biometric) — any single failure blocks the entire unlock
- [ ] GPS deviation beyond `geofence_radius_meters` triggers `COMPROMISED` status and instant alert to AGENCY_HEAD within 30 seconds of detection
- [ ] MQTT consumer reconnects automatically after broker disconnect
- [ ] OTP expires after 5 minutes (Redis TTL enforced)
- [ ] A `receipt-confirm` with `papers_correct: false` triggers `COMPROMISED` flag and is recorded in `audit_logs`
- [ ] The unlock flow works offline (local GPS, SMS OTP) even if the center's internet is intermittent

---

# PHASE 9 — Day-of-Exam Operations

## Objective
Handle all day-of examination operations: student arrival check-in (QR validation + live biometric face match), randomized real-time room allocation, live room occupancy dashboard, CBT online exam session management with sandbox defense, and continuous AI surveillance of exam halls with live streaming to the Agency Command Center. This phase binds every student to a specific room — a binding used by Phase 15 for automatic CCTV attachment.

## Flows Covered
Flow 7 (Online CBT Pre-Exam Decryption — system side), Flow 8 (Day-of-Exam Operations)

## Dependencies
- Phase 5 (`admit_cards` with valid JWTs must exist)
- Phase 3 (`exam_rooms` with capacities and `camera_stream_url` must exist)
- Phase 6 (CBT: paper must be in `DECRYPTED_FOR_CBT` state)
- Phase 8 (Offline: trunk must be `UNLOCKED` at the center)
- Phase 0 (`ADMIT_CARD_JWT_PUBLIC_KEY` for QR validation; `WEBRTC_RELAY_URL` for CCTV; edge AI nodes deployed)

## Downstream Connections
- Phase 10 (answer sheet upload) requires `checkin_events` to exist for each student (confirms they appeared)
- Phase 15 (grievances) uses `room_allocations` to auto-pull CCTV footage for the correct room and time window

## Tables Touched
`checkin_events`, `room_allocations`, `exam_rooms`, `surveillance_alerts`, `cbt_exam_sessions`, `exam_registrations`, `admit_cards`, `students`, `audit_logs`

---

### Backend Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/exams/{id}/checkin` | CENTER_OFFICER | Student check-in. Body: `{qr_payload_jwt}` (scanned from QR). Server: (1) Verifies JWT signature using `ADMIT_CARD_JWT_PUBLIC_KEY`. (2) Validates `exam_id` and `center_id` match the officer's center. (3) Returns `{student_id, biometric_hash, name, photo_url}` to the terminal for face matching (biometric match is run client-side on the center terminal using the embedded hash). |
| POST | `/api/v1/exams/{id}/checkin/confirm` | CENTER_OFFICER | Confirm biometric result. Body: `{student_id, biometric_match_result, biometric_match_score, biometric_photo_path, failed_attempts}`. If `MATCHED`: (1) Creates `checkin_events` record. (2) Updates `exam_registrations.status → CHECKED_IN`. (3) Immediately runs room allocation logic (Postgres function `increment_room_occupancy`). (4) Returns `{room_id, room_code, seat_number}`. If `FAILED` and `failed_attempts >= 3`: locks the terminal for this student ID, fires alert to MANAGER. |
| GET | `/api/v1/exams/{id}/centers/{center_id}/rooms/live` | CENTER_OFFICER, AGENCY_HEAD, MANAGER | Live room occupancy. Returns all rooms for this center: `{room_id, room_code, seating_capacity, current_occupancy, available_seats}`. Connected to Supabase Realtime for push updates. |
| GET | `/api/v1/exams/{id}/centers/{center_id}/checkin-progress` | CENTER_OFFICER, MANAGER, AGENCY_HEAD | Check-in progress: `{checked_in, total_registered, absent_so_far}`. |
| POST | `/api/v1/exams/{id}/cbt/sessions` | CENTER_OFFICER (or student self-authenticate at CBT terminal) | Start a CBT session. Body: `{student_id}`. Validates: student is `CHECKED_IN` at this center, exam is `ONGOING`. Creates `cbt_exam_sessions` with `status = ACTIVE`, `started_at = now()`, `session_token` (short-lived UUID). Returns `{session_token, encrypted_paper_url}` — the paper is decrypted per-student in RAM, not served as a raw file. |
| PATCH | `/api/v1/cbt/sessions/{id}/tab-switch` | CBT terminal (session token auth) | Increments `tab_switch_count`. If count ≥ 3: sets `status → FLAGGED`, sends alert to CENTER_OFFICER. |
| PATCH | `/api/v1/cbt/sessions/{id}/suspicious-typing` | CBT terminal (session token auth) | Increments `suspicious_typing_flags`. If flags ≥ threshold: alert to CENTER_OFFICER. |
| POST | `/api/v1/cbt/sessions/{id}/submit` | CBT terminal (session token auth) | Student submission. Encrypts responses with AES-256-GCM, stores to `answer-sheet-uploads` bucket. Sets `status → SUBMITTED`, `submitted_at`. |
| POST | `/api/v1/exams/{id}/surveillance/alert` | Edge AI node (internal API key auth) | Surveillance alert from edge node. Body: `{center_id, room_id, camera_id, alert_type, confidence_score, snapshot_path}`. Inserts `surveillance_alerts`. Pushes to Agency Command Center via Supabase Realtime. |
| GET | `/api/v1/exams/{id}/surveillance/alerts` | AGENCY_HEAD, MANAGER | List all `surveillance_alerts` for this exam. Filterable by `center_id`, `room_id`, `alert_type`, date range. |
| PATCH | `/api/v1/surveillance/alerts/{id}/review` | MANAGER | Review a surveillance alert. Body: `{review_outcome}`. |

### Celery / Background Jobs

| Task | Trigger | Action |
|---|---|---|
| `mark_absent_students` | Celery Beat, fires at `exam_start_time + 30 min` | For all `REGISTERED` students at this exam who have no `checkin_events` record, sets `exam_registrations.status → ABSENT`. |
| `cbt_session_timeout` | Celery Beat, fires at `exam_start_time + duration_minutes + 5 min` | Force-submits any `cbt_exam_sessions` still in `ACTIVE` status: sets `status → TIMED_OUT`, saves whatever responses exist. |

### Frontend Routes

**`[slug].leakguard.in/center/[examId]/checkin` → `app/agency/[slug]/center/[examId]/checkin/page.tsx`**
The center-day terminal UI — designed for use on a dedicated kiosk or tablet.

Layout: full-screen dark background (navy-950), large scan target area in the center.

Step 1 — QR Scan: `QRScanner` component with a live camera preview and a green scanning overlay frame. Instruction: "Hold candidate's admit card QR code in front of the camera." On successful scan: shows student name and photo (from the decoded JWT payload).

Step 2 — Biometric Match: `BiometricCapture` component opens. Instructions: "Ask candidate to look directly at the camera." Match runs against the `biometric_hash` from the QR payload. Shows a real-time confidence meter. On `MATCHED` (score ≥ threshold): large green "✓ IDENTITY VERIFIED" with student name. On `FAILED`: amber warning, retry option. After 3 failures: red "⚠ ACCESS DENIED — Alert sent to exam manager."

Step 3 — Room Assignment: On successful check-in: shows `SecureEventLog` strip with room assignment: `[{timestamp}] {Student Name} — Checked In. Room: {room_code}. Seat: {seat_number}.` Physical slip is printed (if printer attached to terminal) or shown on screen for the invigilator to note manually.

**`[slug].leakguard.in/center/[examId]/rooms` → `app/agency/[slug]/center/[examId]/rooms/page.tsx`**
Live room capacity dashboard. Grid of room tiles (one per room). Each tile: Room Code (large, monospace), Capacity/Occupied/Available as a progress bar, colored green → amber → red as the room fills. Tiles update in real-time via Supabase Realtime subscription on `exam_rooms`. Full rooms turn the tile border red and block further allocation (system-enforced).

**`[slug].leakguard.in/command-center` → `app/agency/[slug]/command-center/page.tsx`**
The Agency Command Center — live monitoring hub for AGENCY_HEAD and MANAGER. Designed as a full-screen ops dashboard.

Left panel (1/3): Alert feed — scrollable `AlertBanner` list of all `surveillance_alerts` in the last 2 hours, live-updating via Supabase Realtime. Each entry: center name, room code, alert type (monospace badge), confidence %, timestamp. Unreviewed alerts shown in amber, reviewed in muted.

Center panel (2/3): CCTV grid — a 2×N grid of camera thumbnails (one per active center/room with `camera_stream_url`). Each thumbnail: room name label, live video via WebRTC. Click on any thumbnail opens it fullscreen. "All Centers" → "Center Name" → "Room Name" breadcrumb selector for filtering the grid.

Right panel: Status bar for the day — check-in progress per center (progress bars), trunk status (for offline exams), CBT sessions active count. Scroll down for the offline trunk map (same as Phase 8's transit map, embedded here).

**`[slug].leakguard.in/center/[examId]/cbt` → `app/agency/[slug]/center/[examId]/cbt/page.tsx`**
CBT exam interface (student-facing within the center's locked-down exam client). Shows: exam name, time remaining (countdown). Question navigation sidebar. Question content area. Answer selection. Tab switching, clipboard, and right-click disabled via JavaScript + browser fullscreen API. On 3rd tab switch: warning modal "You will be flagged if you switch tabs again."

### Acceptance Checklist — Phase 9
- [ ] Check-in validation uses `ADMIT_CARD_JWT_PUBLIC_KEY` (asymmetric) — never the private key on the terminal
- [ ] Room allocation is atomic: `increment_room_occupancy` validates capacity in a single DB transaction with no race condition
- [ ] A full room (`current_occupancy = seating_capacity`) is never allocated to another student
- [ ] Failed biometric (3 attempts) locks the check-in for that student ID and alerts MANAGER
- [ ] CBT session token is single-use: cannot start two sessions for the same `registration_id`
- [ ] `surveillance_alerts` appear on the Command Center in under 5 seconds of detection
- [ ] `mark_absent_students` task runs after the grace period and updates status correctly

---

# PHASE 10 — Post-Exam: Answer Sheet Upload & AI Visibility Scoring

## Objective
After the exam concludes, enable Center Officers to scan and upload every student's answer sheet through a secure, encrypted channel. An AI agent (YOLOv8 + OpenCV) immediately scores every page for legibility on a 0–10 scale. Sheets below the configurable threshold trigger a rescan request before the physical papers are sealed. This phase creates the `answer_sheet_uploads` records that the entire evaluation phase processes.

## Flows Covered
Flow 9 (Post-Exam — Answer Sheet Upload), Flow 10 (Answer Key Upload & Evaluation Setup — Steps 10.1 upload key only)

## Dependencies
- Phase 9 (`checkin_events` must exist — confirms student appeared and is eligible for evaluation)
- Phase 3 (`exams.visibility_score_threshold` defines the pass threshold)
- Phase 0 (YOLOv8 visibility scoring model deployed; `answer-sheet-uploads` bucket created as service-role-only)

## Downstream Connections
- Phase 11 (evaluation) only processes sheets with `upload_status = APPROVED`
- Phase 13 (leak investigation) does not directly use these — but the `center_uid + student_uid` tagging here is the basis for answer sheet anonymization

## Tables Touched
`answer_sheet_uploads`, `answer_sheet_visibility_scores`, `exam_registrations`, `checkin_events`, `exams`, `audit_logs`

---

### Backend Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/exams/{id}/answer-sheets` | AGENCY_HEAD, MANAGER, CENTER_OFFICER | List all `answer_sheet_uploads` for this exam. Filterable by `center_id`, `upload_status`. Shows count per status: UPLOADED, SCORING, APPROVED, RESCAN_REQUIRED, SEALED. |
| POST | `/api/v1/exams/{id}/answer-sheets/upload` | CENTER_OFFICER | Upload a student's answer sheet. Multipart: `{student_id, center_id}` + PDF file. Validates: student has a `checkin_events` record (appeared). Encrypts PDF with AES-256-GCM in transit → stores to `answer-sheet-uploads` bucket at path `{exam_id}/{center_id}/{student_id}/answer_sheet.pdf`. Creates `answer_sheet_uploads` record (`status = UPLOADED`). Fires `score_answer_sheet` task. Writes `ANSWER_SHEET_UPLOADED` to `audit_logs`. |
| GET | `/api/v1/answer-sheets/{id}` | AGENCY_HEAD, MANAGER, CENTER_OFFICER (own center) | Upload status + visibility scores per page. |
| POST | `/api/v1/answer-sheets/{id}/rescan` | CENTER_OFFICER | Re-upload a sheet that failed visibility check. Replaces the previous file at the same storage path. Fires `score_answer_sheet` again. |
| POST | `/api/v1/answer-sheets/{id}/seal` | CENTER_OFFICER | Marks physical papers as sealed. Sets `upload_status → SEALED`. Only allowed if all pages have score ≥ threshold. Writes `ANSWER_SHEET_SEALED` to `audit_logs`. |
| POST | `/api/v1/exams/{id}/answer-sheets/seal-all` | CENTER_OFFICER | Bulk seals all APPROVED sheets for this center. Validates no `RESCAN_REQUIRED` sheets remain. |
| POST | `/api/v1/exams/{id}/answer-key/upload` | AGENCY_HEAD, MANAGER | Upload the official answer key. Encrypts with AES-256-GCM, stores to `question-papers-vault` bucket (restricted). Creates a `question_papers` record variant with `status = VAULTED` (reuse the table with `paper_type = ANSWER_KEY` — add this column if not present, or create a separate `answer_keys` table if preferred). Writes `ANSWER_KEY_UPLOADED` to `audit_logs`. |

### Celery / Background Jobs

| Task | Trigger | Action |
|---|---|---|
| `score_answer_sheet` | PDF uploaded | (1) Loads the decrypted PDF pages. (2) For each page, runs YOLOv8 + OpenCV pipeline: checks ink clarity, page orientation, fold/damage artifacts, answer legibility → assigns `visibility_score` (0.00–10.00) per page. (3) Inserts one `answer_sheet_visibility_scores` row per page with `page_number`, `score`, `issues_detected` (JSONB: e.g. `{blur: true, fold: true}`). (4) Checks all page scores: if minimum page score ≥ `exams.visibility_score_threshold` → sets `upload_status = APPROVED`. Else → sets `upload_status = RESCAN_REQUIRED`. (5) If RESCAN_REQUIRED: sends alert to CENTER_OFFICER with specific failing page numbers and detected issues. (6) Updates `answer_sheet_uploads.upload_status`. |
| `transition_exam_to_evaluation` | Celery Beat, polls every 15 min after `PAPER_UPLOAD_PENDING` | Checks if all `answer_sheet_uploads` for the exam have `upload_status = SEALED`. If yes: transitions `exams.status → EVALUATION_IN_PROGRESS`. Notifies AGENCY_HEAD. |

### Frontend Routes

**`[slug].leakguard.in/center/[examId]/answer-sheets` → `app/agency/[slug]/center/[examId]/answer-sheets/page.tsx`**
The upload interface for Center Officers post-exam.

Top: Progress summary — `{approved_count} / {total_registered}` with a color-coded progress bar. Below: a table of students at this center (from `checkin_events`). Columns: Application Number (monospace), student name, upload status badge, score (shown once scored), actions.

Upload status badges:
- NOT UPLOADED (gray) — action: Upload
- SCORING (amber spinner)
- APPROVED (green ✓)
- RESCAN REQUIRED (red) — action: Rescan, shows which pages failed
- SEALED (muted, final)

Clicking "Upload" opens a simple file picker for that student's scanned PDF. After upload, status moves to SCORING (live update). After scoring, updates to APPROVED or RESCAN REQUIRED.

"Seal All" button (enabled only when zero RESCAN_REQUIRED remain): confirmation dialog — "You are about to physically seal all answer sheets. This action cannot be undone." Uses `security` Button variant.

**`[slug].leakguard.in/exams/[examId]/answer-sheets` → Exam workspace "Answer Sheets" tab**
AGENCY_HEAD / MANAGER view. Aggregate across all centers: progress table (center name, uploaded count, approved count, rescan count, sealed count). Overall exam readiness gauge. "View by Center" drills into center-level detail.

### Acceptance Checklist — Phase 10
- [ ] Upload is rejected if the student has no `checkin_events` record (absent students have no answer sheet)
- [ ] Visibility score uses the **minimum page score** rule — any single page below threshold blocks approval
- [ ] `RESCAN_REQUIRED` alert includes the specific failing page numbers and issue types
- [ ] A sheet cannot be sealed while any of its pages score below threshold (API enforced)
- [ ] The answer key is stored in the same `question-papers-vault` bucket (service-role only) and never accessible to evaluators

---

# PHASE 11 — Multi-Tier Anonymized Evaluation

## Objective
Run a three-tier anonymized evaluation pipeline: answer sheets are stripped of student identity, assigned in batches to Grading Teachers (Tier 1), cross-checked by Moderators (Tier 2), with discrepancies escalated to the Chief Moderator (Tier 3). Access is permanently revoked from each evaluator once they formally confirm completion. Marks are stored against the encrypted student-center-evaluator triple. This phase is the core of result integrity.

## Flows Covered
Flow 10 (Answer Key Upload & Evaluation Setup — Steps 10.2–10.3), Flow 11 (Multi-Tier Evaluation)

## Dependencies
- Phase 10 (all `answer_sheet_uploads` must have `upload_status = APPROVED` or `SEALED`)
- Phase 2 (GRADING_TEACHER, MODERATOR, CHIEF_MODERATOR accounts must exist)
- Phase 3 (`exams.status = EVALUATION_IN_PROGRESS`)

## Downstream Connections
- Phase 12 (results) reads `evaluation_marks` at the highest tier per student, and `evaluation_discrepancies` must all be RESOLVED before publication

## Tables Touched
`evaluator_assignments`, `evaluation_marks`, `evaluation_discrepancies`, `answer_sheet_uploads`, `agency_staff`, `audit_logs`

---

### Backend Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/exams/{id}/evaluation/anonymize` | AGENCY_HEAD | Runs the anonymization pass. For each `answer_sheet_uploads` record: generates an `anonymized_batch_code` (e.g., SHA-256 hash of `center_uid + student_uid + exam_id + secret_salt`). Strips student name/photo from the view layer (stored separately in an encrypted lookup table accessible only to CHIEF_MODERATOR). Returns summary: `{total_sheets, batches_ready}`. Writes `EVALUATION_ANONYMIZED`. |
| POST | `/api/v1/exams/{id}/evaluation/assignments` | AGENCY_HEAD, MANAGER | Assign a batch to an evaluator. Body: `{evaluator_id, role, upload_ids[]}`. Validates role is one of `grading_teacher`, `moderator`, `chief_moderator`. Creates `evaluator_assignments` record. Fires `send_evaluator_assignment_email`. Updates the evaluator's JWT `paper_batch_ids` claim at next refresh. |
| GET | `/api/v1/evaluation/assignments/me` | GRADING_TEACHER, MODERATOR, CHIEF_MODERATOR | List all assignments for the caller. Returns `{batch_code, upload_ids, status, completed_at}`. |
| GET | `/api/v1/evaluation/assignments/{id}/papers` | GRADING_TEACHER, MODERATOR, CHIEF_MODERATOR (own assignment only — enforced by RLS on `paper_batch_ids` claim) | Returns the list of anonymized answer sheets in this batch. Each paper identified by `anonymized_batch_code` only — no student name or ID. Returns signed URLs to the answer sheet PDFs (from service-role client). |
| POST | `/api/v1/evaluation/marks` | GRADING_TEACHER, MODERATOR, CHIEF_MODERATOR | Submit marks for a paper. Body: `{assignment_id, upload_id, marks_awarded, max_marks, subject_breakdown (JSONB), remarks}`. Creates `evaluation_marks` record with `evaluation_tier` derived from the evaluator's role. Writes `MARKS_SUBMITTED`. |
| POST | `/api/v1/evaluation/assignments/{id}/complete` | GRADING_TEACHER, MODERATOR, CHIEF_MODERATOR | Formal completion. Sets `evaluator_assignments.status → COMPLETED`, `completed_at = now()`. Immediately sets `access_revoked_at = now()` — the API will return 403 on any subsequent paper access for this assignment. Triggers auto-comparison (Tier 1 vs Tier 2) if MODERATOR is completing. Fires `send_evaluation_completion_notification`. Writes `EVALUATION_ACCESS_REVOKED`. |
| GET | `/api/v1/exams/{id}/evaluation/discrepancies` | CHIEF_MODERATOR | List all `evaluation_discrepancies` with `status = OPEN`. Each row shows: anonymized batch code, Tier 1 marks, Tier 2 marks, difference. |
| POST | `/api/v1/evaluation/discrepancies/{id}/resolve` | CHIEF_MODERATOR | Issue final ruling. Body: `{final_marks, remarks}`. Creates `evaluation_marks` record (tier = 3). Updates `evaluation_discrepancies.status → RESOLVED`, `resolved_by`, `final_marks_id`. |
| POST | `/api/v1/exams/{id}/evaluation/approve` | CHIEF_MODERATOR | Chief Moderator formally approves the evaluation batch for result publication. Validates all discrepancies are RESOLVED. Sets an `evaluation_approved_at` timestamp (store on `exams` table — add this column). Writes `EVALUATION_APPROVED`. |

### Celery / Background Jobs

| Task | Trigger | Action |
|---|---|---|
| `send_evaluator_assignment_email` | Assignment created | Emails evaluator: "You have been assigned X papers for evaluation. Log in to access them. Your access will be permanently revoked once you confirm completion." + login link to `[slug].leakguard.in/eval/`. |
| `run_tier_comparison` | MODERATOR calls `/complete` | For every paper in the MODERATOR's batch, compares Tier 1 marks vs Tier 2 marks. If `|Tier1 - Tier2| > configured_discrepancy_threshold` (e.g., 10%): creates `evaluation_discrepancies` record with `status = OPEN`. Notifies CHIEF_MODERATOR if any discrepancies created. |
| `send_evaluation_completion_notification` | Evaluator completes | Emails AGENCY_HEAD: "[Evaluator Name] has completed evaluation of Batch [code]. Access has been revoked." |

### Frontend Routes

**`[slug].leakguard.in/eval/` → `app/agency/[slug]/eval/page.tsx`**
Evaluator portal — accessible only to GRADING_TEACHER, MODERATOR, CHIEF_MODERATOR.

For GRADING_TEACHER and MODERATOR: list of their `evaluator_assignments`. Each shows: batch code (monospace), papers count, status badge (PENDING / IN_PROGRESS / COMPLETED / LOCKED), assigned date. "Start Evaluation" button navigates to the evaluation workspace.

For CHIEF_MODERATOR: same list plus a "Discrepancies" section showing count of open discrepancies with a link to the discrepancy resolver.

**`[slug].leakguard.in/eval/[assignmentId]` → `app/agency/[slug]/eval/[assignmentId]/page.tsx`**
Evaluation workspace. Split-pane layout:

Left pane (60%): Anonymized answer sheet PDF viewer (`PDFViewer`). Navigation between pages. Paper identified at the top only by its `anonymized_batch_code` (monospace, not the student's name). Answer key visible below the student's response for each question (toggle-able).

Right pane (40%): Marks input form. Per question/section: marks awarded input + max marks display + remarks field. Running total shown. "Save Draft" button (saves to local state, no API call — avoids noise). "Submit Marks" button → creates `evaluation_marks` record.

Paper navigation sidebar (left edge): mini list of all papers in the batch, showing: batch code fragment, marks entered (if any), completion status. Click to jump to any paper.

Footer: once all papers have marks entered — "Submit & Lock Batch" button (security variant, requires typed confirmation: "I confirm evaluation is complete"). On confirm: calls `/assignments/{id}/complete`. Post-lock: workspace becomes fully read-only. Shows `SecureEventLog`: `[{timestamp}] Batch {code} locked. Access permanently revoked.`

**`[slug].leakguard.in/eval/discrepancies` → `app/agency/[slug]/eval/discrepancies/page.tsx`**
CHIEF_MODERATOR only. Table of open discrepancies: batch code (monospace), Tier 1 marks, Tier 2 marks, difference. Click a row opens a `SideDrawer` with: the anonymized answer sheet, Tier 1 evaluator's marks + remarks, Tier 2 evaluator's marks + remarks. Chief Moderator enters final marks and submits. Resolved rows move to a "Resolved" table below.

**`[slug].leakguard.in/exams/[examId]/evaluation` → Exam workspace "Evaluation" tab**
AGENCY_HEAD / MANAGER view. Evaluation progress: (1) Anonymization status (Run/Complete button). (2) Assignment table — evaluator name, role, batch, status, papers count. (3) Discrepancy summary. (4) "Approve for Publication" button (enabled only when CHIEF_MODERATOR has called `/evaluation/approve`).

### Acceptance Checklist — Phase 11
- [ ] An evaluator can only see papers in their own assigned batch — RLS enforced by `paper_batch_ids` JWT claim
- [ ] Access revocation is immediate on `/complete` — subsequent paper access returns 403
- [ ] `run_tier_comparison` catches all discrepancies above the configured threshold with no false negatives
- [ ] CHIEF_MODERATOR cannot approve until all discrepancies have `status = RESOLVED`
- [ ] Anonymized batch codes never contain the student name or application number (only the hash)
- [ ] Physical answer sheet viewing is served via signed URLs (time-limited, never raw bucket paths)

---

# PHASE 12 — Result Publication & Student Result Access

## Objective
After all evaluation is complete and approved by the Chief Moderator, compile final marks from the highest available evaluation tier per student, calculate percentages and ranks, generate digitally signed result PDFs, and publish results. Students access their result through a three-factor verification (Application Number + Mobile OTP + CAPTCHA).

## Flows Covered
Flow 12 (Result Publication)

## Dependencies
- Phase 11 (all evaluator assignments `COMPLETED`, all discrepancies `RESOLVED`, Chief Moderator has approved)
- Phase 4 (`students.phone` for OTP verification)
- Phase 5 (`exam_registrations.application_number` as the student UID for result lookup)

## Downstream Connections
- Phase 15 (student grievances) includes a "Unfair Evaluation" category that references the result

## Tables Touched
`exam_results`, `evaluation_marks`, `evaluation_discrepancies`, `exam_registrations`, `students`, `exams`, `audit_logs`

---

### Backend Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/exams/{id}/publication-readiness` | AGENCY_HEAD | Pre-publication checks. Returns: `{all_sheets_sealed, all_assignments_completed, all_discrepancies_resolved, chief_moderator_approved, ready_to_publish: boolean}` with specific blocking reasons if not ready. |
| POST | `/api/v1/exams/{id}/results/compile` | AGENCY_HEAD | Fires `compile_results` Celery task. Returns `{job_id}`. Disabled unless `publication_readiness.ready_to_publish = true`. |
| GET | `/api/v1/exams/{id}/results/preview` | AGENCY_HEAD | Preview of compiled results (before publication): mark distribution histogram, pass/fail counts, rank list. |
| POST | `/api/v1/exams/{id}/results/publish` | AGENCY_HEAD | Sets `exams.status → RESULT_DECLARED`. Fires `notify_students_result_declared`. Writes `RESULTS_PUBLISHED`. |
| POST | `/api/v1/results/verify` | PUBLIC | Multi-factor result lookup. Body: `{application_number, otp, captcha_token}`. Step 1 (separate endpoint): `POST /results/request-otp` with `{application_number}` → sends OTP to `students.phone`. This endpoint validates OTP + CAPTCHA, returns result data if valid. Never returns result without all three factors. Rate-limited: 5 attempts per application_number per hour. |
| POST | `/api/v1/results/request-otp` | PUBLIC | Body: `{application_number}`. Looks up `exam_registrations.application_number` → `students.phone`. Sends OTP. Rate-limited. Returns `{phone_last4}` (masked) so student knows which number to check. |
| GET | `/api/v1/students/me/results` | STUDENT | Authenticated result view (for logged-in students on the student portal — simpler flow without OTP since they're already authenticated). |

### Celery / Background Jobs

| Task | Trigger | Action |
|---|---|---|
| `compile_results` | `POST /results/compile` | For each student in the exam: (1) Find the highest-tier `evaluation_marks` record for this `student_id + exam_id`. (2) Use Tier 3 if exists (discrepancy resolved), else Tier 2 if exists, else Tier 1. (3) Calculate `percentage = (marks_awarded / max_marks) * 100`. (4) Insert `exam_results` record. (5) After all students processed: calculate `rank` by sorting by `final_marks` descending. Update `rank` and `category_rank` on each `exam_results` row. (6) Generate signed result PDF per student: marks summary, subject breakdown, rank, pass/fail stamp, digital signature using `RESULT_PDF_SIGNING_KEY`. Upload to `result-pdfs` bucket. Update `exam_results.result_pdf_path`. |
| `notify_students_result_declared` | `POST /results/publish` | Batch email to all appeared students: "Your result for [Exam Name] has been declared. Visit [URL] to view your result." |

### Frontend Routes

**`[slug].leakguard.in/exams/[examId]/results` → Exam workspace "Results" tab**
AGENCY_HEAD view.

Pre-compilation: Publication readiness checklist. Each item shown as ✓ (green) or ✗ (red) with a description. "Compile Results" button (disabled until all items ✓).

Post-compilation (preview): Mark distribution histogram (recharts bar chart: score buckets on X axis, student count on Y axis). Pass rate percentage. Top 10 rankers table (anonymized during preview — shown as "Rank 1: Score X"). "Publish Results" button (security variant, confirmation required: "Results will be publicly visible to all appeared students. This cannot be undone.").

Post-publication: Download full result CSV button. Notification sent status.

**`leakguard.in/results` → `app/(public)/results/page.tsx`**
Public result lookup page (no login required). Clean, minimal layout.

Step 1: Application Number input. "Send OTP" button.
Step 2 (after OTP sent): 6-digit OTP input with a 5-minute timer. CAPTCHA (Google reCAPTCHA v3 or hCaptcha). "View Result" button.

On success: Result card:
- Student name, photo, Application Number (monospace)
- Exam name and agency
- Final marks / Max marks / Percentage
- Subject-wise breakdown table
- Rank (if applicable)
- Pass / Fail badge (large, color-coded)
- "Download Result PDF" button
- "File a Grievance" link → routes to student login then Phase 15

Error states:
- Wrong OTP: "Incorrect OTP. X attempts remaining."
- Rate limited: "Too many attempts. Try again after {time}."
- Results not yet declared: "Results for this exam have not been published yet."

**`leakguard.in/student/exams/[examId]/result` → `app/(public)/student/exams/[examId]/result/page.tsx`**
Authenticated result view for logged-in students (no OTP needed). Same result card as above, with pre-filled data. "File a Grievance" button links directly to Phase 15's grievance form.

### Acceptance Checklist — Phase 12
- [ ] Result publication is blocked unless `publication_readiness.ready_to_publish = true` (all checks pass)
- [ ] Rank calculation uses `final_marks` in a deterministic order (tie-breaking rule: higher percentage in a specific subject — define this)
- [ ] OTP-based result lookup rate-limited to 5 attempts per application number per hour (Redis counter)
- [ ] Result PDF is digitally signed with `RESULT_PDF_SIGNING_KEY` and signature is verifiable
- [ ] Students cannot see results before `exams.status = RESULT_DECLARED`

---

# PHASE 13 — Leak Investigation Engine (Agent 7)

## Objective
When a suspected leaked exam paper photo surfaces (from any source — social media, whistleblower, internal report), Agent 7 reverse-engineers the steganographic Tracking Matrix Code embedded in the photo, cross-references vault access logs, print room surveillance, transit logs, and center-day-of logs, and generates a Leak Source Probability Report that numerically attributes the leak to specific individuals. This is the post-hoc accountability layer.

## Flows Covered
Flow 13 (Leak Investigation)

## Dependencies
- Phase 7 (`print_watermark_registry` must have been populated during printing — watermarks must exist)
- Phase 6 (`paper_vault_access_logs` must exist)
- Phase 8 (`transit_events`, `transit_geofence_violations` must exist)
- Phase 9 (`checkin_events` + `surveillance_alerts` must exist)

## Downstream Connections
- Used by platform admin and agency heads; does not feed into any other system phase
- Results may be shared with law enforcement; output format must be export-friendly

## Tables Touched
`leak_reports`, `print_watermark_registry`, `paper_vault_access_logs`, `transit_events`, `transit_geofence_violations`, `print_room_surveillance_alerts`, `audit_logs`

---

### Backend Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/leaks/report` | AGENCY_HEAD, MANAGER, or PUBLIC (with CAPTCHA) | Submit a suspected leak. Multipart: `{exam_id (optional), source_type, description}` + image file. Creates `leak_reports` record with `investigation_status = RECEIVED`. Fires `run_leak_investigation` task. Returns `{report_id}`. Writes `LEAK_REPORTED`. |
| GET | `/api/v1/leaks/reports` | AGENCY_HEAD, PLATFORM_ADMIN | List all `leak_reports`. Filterable by `exam_id`, `investigation_status`. |
| GET | `/api/v1/leaks/reports/{id}` | AGENCY_HEAD, PLATFORM_ADMIN | Full report detail including: watermark extraction result, probability report (JSONB), evidence chain. |
| GET | `/api/v1/leaks/reports/{id}/evidence` | AGENCY_HEAD, PLATFORM_ADMIN | Downloads a compiled PDF evidence package: probability report + CCTV timestamps + access log excerpts + transit log excerpts. Suitable for sharing with law enforcement. |

### Celery / Background Jobs

| Task | Trigger | Action |
|---|---|---|
| `run_leak_investigation` | Leak report submitted | (1) Load the uploaded image. (2) Run steganographic extraction via `services/watermarking.py` → decode the Tracking Matrix Code → extract: `center_code`, `printer_id`, `operator_id (UUID)`, `timestamp`, `page_number`. (3) Update `leak_reports` with extracted values. (4) Cross-reference: (a) `paper_vault_access_logs` — who accessed the paper digitally, when, from what IP. (b) `print_room_surveillance_alerts` during the print session identified by the timestamp. (c) `transit_events` and `transit_geofence_violations` for the trunk carrying that center's batch. (d) `checkin_events` and `surveillance_alerts` from the exam center on exam day. (5) Build a Leak Source Probability Report (JSONB). Example structure: `{"suspects": [{"name": "Operator X", "id": "uuid", "role": "operator", "probability": 0.89, "evidence": [...]}, {"name": "Transit Manager Y", "id": "uuid", "probability": 0.11, "evidence": [...]}]}`. (6) Update `leak_reports.probability_report`, `investigation_status → REPORT_GENERATED`. (7) Notify AGENCY_HEAD and PLATFORM_ADMIN. Writes `LEAK_INVESTIGATION_COMPLETE` to `audit_logs`. |

### Frontend Routes

**`[slug].leakguard.in/leaks` → `app/agency/[slug]/leaks/page.tsx`**
AGENCY_HEAD / MANAGER view.

"Report Suspected Leak" button opens a `Modal`:
- Exam selector dropdown
- Source type (Internal / Whistleblower / Public Media)
- Description textarea
- Image upload (the leaked paper photo)
- Submit button

Table of all `leak_reports`: report ID (monospace), exam name, source type, submitted date, status badge (RECEIVED / PROCESSING / REPORT_GENERATED / CLOSED). Row click opens full report.

**`[slug].leakguard.in/leaks/[reportId]` → `app/agency/[slug]/leaks/[reportId]/page.tsx`**
Investigation report page. Three-column layout:

Left: The uploaded suspected leak image with the extracted watermark data overlaid (center code, printer ID, operator ID, timestamp — all in monospace, highlighted on the image with bounding boxes if extractable visually).

Center: Probability Report visualization. A horizontal bar chart (recharts): each bar is a suspect, bar length = probability %. Below: for each suspect, an expandable evidence accordion (vault access log entries, CCTV alert timestamps, transit log excerpts). All formatted in the `SecureEventLog` style.

Right: Metadata panel — report ID, submitted date, exam name, extraction confidence score. "Download Evidence Package" button (PDF export). "Close Report" button.

### Acceptance Checklist — Phase 13
- [ ] Agent 7 correctly extracts the watermark from a test image generated by Phase 7's watermarking service
- [ ] Cross-reference covers all four data sources: vault logs, print surveillance, transit logs, day-of logs
- [ ] Probability report JSONB is valid and probabilities sum to 1.0 (100%)
- [ ] Evidence package PDF is downloadable and self-contained (no links to internal systems)
- [ ] Leak report submission is available to PUBLIC (with CAPTCHA) — not just agency staff

---

# PHASE 14 — Anonymous Whistleblower Portal

## Objective
Provide a fully anonymous public reporting channel where any citizen, press member, invigilator, or printing staff member can report exam misconduct, leaks, bribery, or impersonation without any login requirement. An AI agent scores each report for risk severity and routes high-risk reports immediately to the platform audit team. The portal must guarantee that no identifying information is stored alongside the report.

## Flows Covered
Flow 14 (Whistleblower & Anonymous Reporting)

## Dependencies
- Phase 0 (LLM API key for risk scoring; `evidence-uploads` bucket for anonymous file uploads)
- Phase 1 (the footer link on the landing page links here)

## Downstream Connections
- High-risk reports (score ≥ 70) are escalated to PLATFORM_ADMIN (built in Phase 1's admin console)
- Reports can reference an `exam_id` linking to Phase 3's exam data

## Tables Touched
`whistleblower_reports`, `audit_logs`

---

### Backend Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/whistleblower/reports` | PUBLIC (CAPTCHA required) | Submit anonymous report. Multipart: `{category, description, exam_id (optional), location_text (optional)}` + `evidence_files[]` (photos/videos, max 5 files, 50MB total). Validates CAPTCHA server-side. Stores evidence files to `evidence-uploads` bucket under a random UUID path (not linked to any account). Creates `whistleblower_reports` record. **No IP address, device fingerprint, or identity is stored.** Fires `score_whistleblower_report`. Returns `{tracking_code}` — a random alphanumeric code the reporter can use to check status without a login. Writes `WHISTLEBLOWER_REPORT_SUBMITTED` to `audit_logs` (with `actor_id = NULL`). |
| GET | `/api/v1/whistleblower/reports/status/{tracking_code}` | PUBLIC | Returns only the routing status (`RECEIVED / AI_SCORED / ROUTED_TO_AUDIT / CLOSED`) — no other data. Allows anonymous reporters to track their report's progress. |
| GET | `/api/v1/admin/whistleblower-reports` | PLATFORM_ADMIN | Paginated list of all reports. Sortable by `ai_risk_score` descending. Filterable by `category`, `routing_status`, `exam_id`. |
| GET | `/api/v1/admin/whistleblower-reports/{id}` | PLATFORM_ADMIN | Full report detail including AI risk score and routing. |
| PATCH | `/api/v1/admin/whistleblower-reports/{id}/close` | PLATFORM_ADMIN | Sets `routing_status → CLOSED` with a resolution note. |

### Celery / Background Jobs

| Task | Trigger | Action |
|---|---|---|
| `score_whistleblower_report` | Report submitted | LLM-based scoring via `services/ai_agents/risk_score_agent.py`. Inputs: category, description text, evidence file count, whether exam_id was provided. Scoring dimensions: specificity of claim (vague/specific), evidence quality (no evidence / text only / photo/video), category severity (leak > bribery > impersonation > misconduct > other), geographic specificity (location provided?). Outputs: `ai_risk_score` (0–100). Updates `whistleblower_reports.ai_risk_score`, `routing_status → AI_SCORED`. If `ai_risk_score ≥ 70`: immediately sets `routing_status → ROUTED_TO_AUDIT`, sends alert email to PLATFORM_ADMIN. Writes `WHISTLEBLOWER_REPORT_SCORED` to `audit_logs`. |

### Frontend Routes

**`leakguard.in/report` → `app/(public)/report/page.tsx`**
The anonymous reporting page. No login prompt anywhere on this page.

Header: "Report Exam Misconduct — Anonymously." Subheading: "Your identity is not recorded. You will receive a tracking code to check your report's status."

Form:
- Category (radio buttons with icons): Paper Leak / Bribery or Corruption / Impersonation / Invigilator Misconduct / Other
- Exam (optional dropdown: "Which exam does this relate to?" — pulls from public exam list)
- Description (textarea, 100–2000 character limit with counter)
- Location (optional text field: "Where did this happen? City, exam center, or other location")
- Evidence (drag-and-drop file upload for up to 5 photos or videos — shows thumbnails after selection, with a "Remove" button per file)
- CAPTCHA widget

Submit button: "Submit Report."

On submit success: full-page confirmation screen (no navigation to anywhere):
- Large shield icon (green)
- "Report Received"
- Tracking code in a monospace box: `[LG-RPT-{8-char-code}]` with a "Copy" button
- Instructions: "Save this code. You can check the status of your report at leakguard.in/report/status — no login required."
- A very clear statement: "Your identity, IP address, and device information have not been recorded."

**`leakguard.in/report/status` → `app/(public)/report/status/page.tsx`**
Anonymous status checker. Single input: tracking code. On submit: shows routing status badge only (`RECEIVED / AI_SCORED / ROUTED_TO_AUDIT / CLOSED`). No other data shown.

**`admin.leakguard.in/whistleblower` → `app/admin/whistleblower/page.tsx`**
PLATFORM_ADMIN view. `DataTable` of all reports. Columns: tracking code (monospace), category badge, risk score (shown as a color-coded number: green < 40, amber 40–69, red ≥ 70), exam name (if linked), submitted date, routing status. Sorted by risk score descending by default. Row click opens a `SideDrawer` with full description, evidence file previews, risk score breakdown, and Close action.

### Acceptance Checklist — Phase 14
- [ ] No IP address, session ID, or identity data is stored in `whistleblower_reports` or anywhere else for anonymous submissions
- [ ] CAPTCHA validation is server-side (never trust client-side CAPTCHA result)
- [ ] Evidence files are stored under a random UUID path with no user account linkage
- [ ] Reports with `ai_risk_score ≥ 70` trigger an immediate email alert to PLATFORM_ADMIN (Celery task, not synchronous)
- [ ] Status lookup with a tracking code returns only `routing_status` — never the description or evidence

---

# PHASE 15 — Student Grievance System & Auto-CCTV Attachment

## Objective
Allow authenticated students to file formal, high-priority grievances about any aspect of their exam experience (answer key errors, center misconduct, peer cheating, technical issues, misprinted paper, unfair evaluation). Because the filing student's identity is cryptographically bound to a specific room via the `room_allocations` table (created during check-in), the system automatically pulls and attaches the relevant CCTV footage segment for that room and time window to every grievance ticket — transforming a normally weeks-long investigation into an immediately actionable, pre-evidenced ticket.

## Flows Covered
Flow 15 (Student Grievance Filing)

## Dependencies
- Phase 9 (`room_allocations` must exist — the room binding is the foundation of auto-CCTV)
- Phase 12 (result is visible, which triggers grievances about unfair evaluation)
- Phase 3 (`exam_rooms.camera_stream_url` must be configured for CCTV to be pullable)

## Downstream Connections
- Resolved grievances may inform result corrections (AGENCY_HEAD manually coordinates with Phase 12 if needed)
- High-risk grievances may trigger a Phase 13 leak investigation if the grievance references paper misconduct

## Tables Touched
`student_grievances`, `grievance_cctv_attachments`, `room_allocations`, `exam_rooms`, `students`, `exam_registrations`, `audit_logs`

---

### Backend Endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/exams/{examId}/grievances` | STUDENT | File a grievance. Body: `{category, description}`. Multipart: `evidence_files[]` (optional, student-uploaded). Server: (1) Validates student has an `exam_registrations` record for this exam with `status = APPEARED`. (2) Creates `student_grievances` record with `priority = HIGH`. (3) Looks up `room_allocations` for `{student_id, exam_id}` → finds `room_id`. (4) Looks up `exam_rooms.camera_stream_url` for that room. (5) Determines CCTV time window: `exam_start_time → exam_start_time + duration_minutes`. (6) Fires `pull_cctv_for_grievance` task. (7) Assigns to Chief Exam Manager (`agency_staff` with `role = manager` and `exam_scope` including this exam). (8) Notifies the Manager. Writes `GRIEVANCE_FILED` to `audit_logs`. |
| GET | `/api/v1/students/me/grievances` | STUDENT | List all grievances filed by this student across all exams. |
| GET | `/api/v1/students/me/grievances/{id}` | STUDENT (own) | Single grievance detail including status and resolution notes (but not the CCTV footage — footage is for agency use). |
| GET | `/api/v1/exams/{examId}/grievances` | AGENCY_HEAD, MANAGER | List all grievances for this exam. Filterable by `category`, `status`. Sorted by `submitted_at` descending. |
| GET | `/api/v1/exams/{examId}/grievances/{id}` | AGENCY_HEAD, MANAGER | Full grievance detail: description, student application number, category, evidence files (signed URLs), CCTV attachment status and footage signed URL, current status. |
| PATCH | `/api/v1/grievances/{id}/assign` | AGENCY_HEAD | Reassign to a different Manager. |
| PATCH | `/api/v1/grievances/{id}/resolve` | AGENCY_HEAD, MANAGER | Resolve the grievance. Body: `{resolution_notes, outcome: "RESOLVED" | "REJECTED"}`. Updates `student_grievances.status`, `resolved_at`. Notifies the student. Writes `GRIEVANCE_RESOLVED`. |

### Celery / Background Jobs

| Task | Trigger | Action |
|---|---|---|
| `pull_cctv_for_grievance` | Grievance created | (1) Look up `room_allocations` for `{student_id, exam_id}` → get `room_id`. (2) Look up `exam_rooms.camera_stream_url` and `camera_id`. (3) Determine clip time: `exam_start_time` to `exam_start_time + duration_minutes`. (4) Request the CCTV clip from the recording server (integrate with the WebRTC relay / VMS API). (5) Save the clip to `cctv-clips` bucket at path `{exam_id}/{room_id}/{grievance_id}/footage.mp4`. (6) Create `grievance_cctv_attachments` record with `room_id`, `camera_id`, `footage_start`, `footage_end`, `footage_path`. (7) Update `student_grievances.auto_cctv_attached → true`. (8) Push a real-time notification to the assigned Manager: "CCTV auto-attached to grievance #{id}." |
| `send_grievance_filed_notification` | Grievance created | Notifies the assigned Manager via email and in-portal notification: "High priority grievance filed — [Category] — [Application Number] — CCTV auto-attachment in progress." |
| `send_grievance_resolution_notification` | Grievance resolved | Emails the student: grievance ID, outcome (Resolved/Rejected), resolution notes, and next steps if rejected. |

### Frontend Routes

**`leakguard.in/student/exams/[examId]/grievance` → `app/(public)/student/exams/[examId]/grievance/page.tsx`**
Student grievance filing page. Accessible from the result page ("File a Grievance" link) or from the student dashboard.

Category selection at top (radio button cards with icons and descriptions):
- Answer Key Dispute — "You believe the official answer key contains an error"
- Question Paper Error — "A question was misprinted, ambiguous, or out of syllabus"
- Center Misconduct — "An invigilator behaved improperly"
- Peer Cheating — "Another candidate was cheating and it was not addressed"
- CBT Technical Issue — "Your online exam had a technical problem"
- Misprinted Paper — "Your physical paper had printing errors"
- Unfair Evaluation — "You believe your answer sheet was evaluated incorrectly"
- Other

Description textarea (200–3000 character limit). File upload (up to 5 files). "Submit Grievance" button.

A notice below the form: "Because your identity is verified and linked to your exam seat, the system will automatically attach the CCTV recording from your examination hall as evidence with your grievance." This transparency notice is important — the student should know this is happening.

On submit: "Grievance filed. Your ticket ID is [GRV-{monospace-id}]. A manager has been notified and will review it within 2 business days."

**`leakguard.in/student/grievances` → `app/(public)/student/grievances/page.tsx`**
Student's grievance dashboard. List of all filed grievances: ticket ID (monospace), exam name, category, status (OPEN / UNDER_REVIEW / RESOLVED / REJECTED), submitted date. Row click shows resolution notes when resolved.

**`[slug].leakguard.in/exams/[examId]/grievances` → Exam workspace "Grievances" tab**
AGENCY_HEAD / MANAGER view.

Kanban-style board or table view toggle. Table view columns: ticket ID (monospace), application number, category badge, submitted time, CCTV attached indicator (✓ or spinner), status badge, assigned manager. Clicking a row opens a `SideDrawer` with:
- Category and description
- Student Application Number (linked to registration detail)
- Student-uploaded evidence files (thumbnail grid)
- CCTV Attachment section: if attached, an embedded video player showing the footage clip. If still processing, a spinner.
- Action bar: "Mark Under Review" / "Resolve" / "Reject" with a resolution notes textarea

The CCTV auto-attachment is the signature feature of this page — the Manager should arrive at a grievance and immediately have visual evidence waiting for them, without any manual investigation step.

### Acceptance Checklist — Phase 15
- [ ] Grievances can only be filed by students who have `status = APPEARED` for the exam — absent students cannot file
- [ ] `pull_cctv_for_grievance` correctly identifies the room from `room_allocations` and clips exactly the exam window
- [ ] `auto_cctv_attached` remains `false` until the clip is actually saved and the `grievance_cctv_attachments` record created
- [ ] Student can see only their own grievances — RLS enforced
- [ ] Manager receives notification within 60 seconds of grievance submission
- [ ] A grievance with `category = PAPER_LEAK` or similar can be forwarded to Phase 13 by the Manager (link to leak report creation)

---

# Summary: Phase-to-Flow Mapping

| Phase | Flow(s) | Primary Tables | Status |
|---|---|---|---|
| 0 | Flow 0 (infra) | All 32 (schema only) | Foundation |
| 1 | Flow 0 (admin UI) | agencies, exams, audit_logs | Public layer |
| 2 | Flow 1 | agencies, agency_staff | Agency onboarding |
| 3 | Flow 2 | exams, exam_centers, exam_rooms | Exam creation |
| 4 | Flow 3 | students, exam_registrations | Student registration |
| 5 | Flow 4 | center_allocations, admit_cards | Allocation + cards |
| 6 | Flow 5 | question_papers, paper_vault_access_logs | Secure vault |
| 7 | Flow 6 (print) | print_jobs, print_watermark_registry, print_room_surveillance_alerts | Printing + watermarking |
| 8 | Flow 6 (transit) | transit_trunks, transit_events, transit_geofence_violations | Chain of custody |
| 9 | Flow 7 + 8 | checkin_events, room_allocations, surveillance_alerts, cbt_exam_sessions | Day-of exam |
| 10 | Flow 9 + 10 (partial) | answer_sheet_uploads, answer_sheet_visibility_scores | Upload + scoring |
| 11 | Flow 10 + 11 | evaluator_assignments, evaluation_marks, evaluation_discrepancies | Evaluation |
| 12 | Flow 12 | exam_results | Results |
| 13 | Flow 13 | leak_reports | Agent 7 |
| 14 | Flow 14 | whistleblower_reports | Anonymous reporting |
| 15 | Flow 15 | student_grievances, grievance_cctv_attachments | Grievances |

---

# Summary: All 32 Tables — Phase Coverage

| Table | Phase Built | Phase First Used |
|---|---|---|
| agencies | Phase 0 (schema), Phase 2 (data) | Phase 1 (admin reads it) |
| agency_staff | Phase 0 (schema), Phase 2 (data) | Phase 2 |
| exams | Phase 0 (schema), Phase 3 (data) | Phase 3 |
| exam_centers | Phase 0 (schema), Phase 3 (data) | Phase 3 |
| exam_rooms | Phase 0 (schema), Phase 3 (data) | Phase 3 |
| students | Phase 0 (schema), Phase 4 (data) | Phase 4 |
| exam_registrations | Phase 0 (schema), Phase 4 (data) | Phase 4 |
| center_allocations | Phase 0 (schema), Phase 5 (data) | Phase 5 |
| admit_cards | Phase 0 (schema), Phase 5 (data) | Phase 5 |
| question_papers | Phase 0 (schema), Phase 6 (data) | Phase 6 |
| paper_vault_access_logs | Phase 0 (schema), Phase 6 (data) | Phase 6 |
| print_jobs | Phase 0 (schema), Phase 7 (data) | Phase 7 |
| print_watermark_registry | Phase 0 (schema), Phase 7 (data) | Phase 7 |
| print_room_surveillance_alerts | Phase 0 (schema), Phase 7 (data) | Phase 7 |
| transit_trunks | Phase 0 (schema), Phase 8 (data) | Phase 8 |
| transit_events | Phase 0 (schema), Phase 8 (data) | Phase 8 |
| transit_geofence_violations | Phase 0 (schema), Phase 8 (data) | Phase 8 |
| checkin_events | Phase 0 (schema), Phase 9 (data) | Phase 9 |
| room_allocations | Phase 0 (schema), Phase 9 (data) | Phase 9 |
| surveillance_alerts | Phase 0 (schema), Phase 9 (data) | Phase 9 |
| cbt_exam_sessions | Phase 0 (schema), Phase 9 (data) | Phase 9 |
| answer_sheet_uploads | Phase 0 (schema), Phase 10 (data) | Phase 10 |
| answer_sheet_visibility_scores | Phase 0 (schema), Phase 10 (data) | Phase 10 |
| evaluator_assignments | Phase 0 (schema), Phase 11 (data) | Phase 11 |
| evaluation_marks | Phase 0 (schema), Phase 11 (data) | Phase 11 |
| evaluation_discrepancies | Phase 0 (schema), Phase 11 (data) | Phase 11 |
| exam_results | Phase 0 (schema), Phase 12 (data) | Phase 12 |
| leak_reports | Phase 0 (schema), Phase 13 (data) | Phase 13 |
| whistleblower_reports | Phase 0 (schema), Phase 14 (data) | Phase 14 |
| student_grievances | Phase 0 (schema), Phase 15 (data) | Phase 15 |
| grievance_cctv_attachments | Phase 0 (schema), Phase 15 (data) | Phase 15 |
| audit_logs | Phase 0 (schema), every phase (data) | Phase 1 |
| platform_admins | Phase 0 (schema + data) | Phase 1 |

---

# Security Architecture Cross-Reference

| Security Layer | Mechanism | Phase Implemented |
|---|---|---|
| Data at rest | AES-256-GCM on all papers, answer sheets, keys | Phase 6, 7, 10 |
| Data in transit | TLS 1.3 on all API calls; MQTT over TLS for IoT | Phase 0 (infra config) |
| Authentication | Supabase Auth JWT; role-scoped tokens; short-lived with refresh | Phase 0, 2 |
| Paper vault | Split-key architecture; key only in RAM at exam window; never persisted whole | Phase 6 |
| Print control | Copy-count validation, time-window enforcement, operator auth | Phase 7 |
| Page-level tracing | Steganographic watermark: center + printer + operator + timestamp per page | Phase 7 |
| Print room | YOLOv8 continuous surveillance; real-time agency alerts | Phase 7 |
| Transit | GPS geofencing; tri-factor trunk unlock (GPS + OTP + biometric) | Phase 8 |
| Student identity | Cryptographic RS256 QR admit card; live face match at check-in | Phase 5, 9 |
| Seating | Randomized at check-in moment (never pre-announced) | Phase 9 |
| Exam hall | YOLOv8 edge inference; live WebRTC stream to Command Center | Phase 9 |
| CBT | Just-in-time per-student decryption; clipboard/tab-switch/keystroke defense | Phase 9 |
| Answer sheets | Visibility AI scoring before evaluation access; physical sealing post-upload | Phase 10 |
| Evaluation integrity | Anonymized papers; row-level DB security; 3-tier checking; access lock-in | Phase 11 |
| Result access | Three-factor verification (Application Number + OTP + CAPTCHA) | Phase 12 |
| Leak attribution | Agent 7 watermark reverse-engineering + cross-log correlation | Phase 13 |
| Grievance evidence | Auto-CCTV via cryptographic room binding from check-in | Phase 15 |
| Audit trail | Immutable append-only `audit_logs`; all security events; no UPDATE/DELETE | Phase 0 (table), every phase |

---

# Non-Functional Requirements Reference

| Requirement | Target | Implementation Note |
|---|---|---|
| Availability | 99.9% uptime during exam windows | Multi-AZ deployment on AWS/GCP; Celery workers in autoscaling groups |
| Concurrent users | 100,000+ students during peak registration | Supabase connection pooling (PgBouncer); Redis for session caching; CDN for static assets |
| API latency | < 200ms for non-AI endpoints | Redis caching for repeated reads; indexed queries on all FK columns |
| AI agent SLA | Visibility scoring < 30 seconds per paper | Celery priority queues; GPU-backed workers for YOLOv8 tasks |
| Data retention | 7 years (regulatory compliance) | Supabase Storage lifecycle policies; `audit_logs` no-delete enforced |
| Audit logs | Immutable append-only | No UPDATE/DELETE RLS policy on `audit_logs`; periodic export to cold storage |
| DPDPA compliance | Student biometric data encrypted separately; right to erasure post-retention | `students.biometric_hash` in separate encrypted column; erasure job on retention expiry |
| Edge AI | Works offline; syncs on reconnect | Local buffering on edge node; flush endpoint in Phase 9 |
