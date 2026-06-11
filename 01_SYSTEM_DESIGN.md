# LeakGuard AI — System Design Document

> **Version:** 1.0.0 | **Hackathon:** FAR AWAY 2026 | **Theme:** Examinations + Agentic & Autonomous Systems  
> **Stack:** Next.js (Frontend) · FastAPI (Backend) · Supabase (DB + Storage + Realtime) · YOLOv8 · Python Workers

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Tech Stack & Infrastructure](#2-tech-stack--infrastructure)
3. [Module 1 — Vault & Print Interceptor](#3-module-1--vault--print-interceptor)
4. [Module 2 — Geofenced Transit](#4-module-2--geofenced-transit)
5. [Module 3 — Exam Center Operations](#5-module-3--exam-center-operations)
6. [Module 4 — Post-Exam OMR Ledger](#6-module-4--post-exam-omr-ledger)
7. [Module 5 — Forensic Intelligence](#7-module-5--forensic-intelligence)
8. [Cross-Cutting Concerns](#8-cross-cutting-concerns)
9. [Complete API Reference](#9-complete-api-reference)
10. [Frontend Routes Reference](#10-frontend-routes-reference)
11. [Service-to-Service Communication](#11-service-to-service-communication)
12. [Deployment Topology](#12-deployment-topology)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS FRONTEND                            │
│  /admin  /print-room  /transit  /center  /report  /forensics        │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTPS REST
┌──────────────────────────▼──────────────────────────────────────────┐
│                      FASTAPI BACKEND (Python)                        │
│   /api/v1/vault  /api/v1/print  /api/v1/transit  /api/v1/forensic   │
└──────┬──────────────┬──────────────┬──────────────┬─────────────────┘
       │              │              │              │
  ┌────▼────┐   ┌─────▼─────┐  ┌────▼────┐   ┌────▼────────┐
  │Supabase │   │ YOLOv8    │  │Supabase │   │ Python OCR  │
  │Postgres │   │ Workers   │  │Realtime │   │ + OpenCV    │
  │Storage  │   │ (local)   │  │ DB      │   │ Workers     │
  └─────────┘   └───────────┘  └─────────┘   └─────────────┘
```

### End-to-End Data Flow

```
[Paper Created] → [Encrypted in Vault] → [Keys Split via Shamir's SSS]
      ↓
[Print Authorized] → [Middleware intercepts] → [Watermark injected per page]
      ↓                      ↓
[YOLO watches room]   [Batch ID recorded]
      ↓
[Physical box sealed with QR] → [Transit GPS tracking begins]
      ↓
[Delivered to Center] → [QR scanned at checkpoint] → [Admit cards verified]
      ↓
[Exam conducted] → [OMR scanned at edge] → [SHA-256 hash stored]
      ↓
[If leak detected] → [Upload to forensic portal] → [Watermark decoded]
      ↓
[Leak Source Report: Operator + Center + Timestamp]
```

---

## 2. Tech Stack & Infrastructure

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 14 (App Router) | Admin dashboards, print room UI, supervisor app |
| Backend API | FastAPI (Python 3.11) | Business logic, crypto, orchestration |
| Database | Supabase (PostgreSQL) | Primary relational store |
| Realtime | Supabase Realtime | Live transit tracking, print monitoring |
| File Storage | Supabase Storage | Encrypted paper blobs, OMR scans |
| Computer Vision | YOLOv8 (Ultralytics) | Phone/earpiece detection in print room & exam hall |
| OCR / Forensic | EasyOCR + OpenCV | Watermark extraction from leaked photos |
| Watermarking | PyMuPDF (fitz) | Inject Tracking Matrix Codes into PDFs |
| Cryptography | PyCryptodome | AES-256-GCM, Shamir's Secret Sharing |
| Auth | Supabase Auth + JWT | Role-based access (admin, operator, supervisor, driver) |
| Maps | Google Maps JS API | Transit geofencing, route polyline |
| Deployment | Docker Compose | Single-node demo; individual services containerized |

---

## 3. Module 1 — Vault & Print Interceptor

### 3.1 Conceptual Flow

```
Authority A submits key-share ──┐
                                ├──► Key Assembly in RAM ──► AES-256-GCM Decrypt ──► PDF in RAM
Authority B submits key-share ──┘
                                                                         ↓
                                                             Print Authorization Window opens
                                                                         ↓
                                            FastAPI Print Spooler Middleware intercepts print command
                                                                         ↓
                                       PyMuPDF injects Tracking Matrix into every page footer
                                                                         ↓
                                                        YOLOv8 agent monitors webcam in print room
```

### 3.2 Components

#### Component: `VaultService` (Backend)
- Handles paper upload, AES-256-GCM encryption, Shamir key splitting.
- Paper PDF is **never written to disk unencrypted**. Decryption happens in RAM inside a short-lived context manager.
- Key shares are distributed to two separate authority endpoints and stored as `key_shares` rows (never both in same DB record).

#### Component: `PrintSpoolerMiddleware` (Backend)
- A FastAPI background worker acting as a virtual print spooler.
- Intercepts print commands during the authorized time window only.
- Calls `WatermarkService` for every page before forwarding to the printer.
- Emits `print_job_created` event to Supabase Realtime channel `print_room`.

#### Component: `WatermarkService` (Backend)
- Uses PyMuPDF to stamp a micro Tracking Matrix Code (TMC) into the footer of every page.
- TMC payload: `{ printer_id, operator_id, center_id, timestamp_unix, batch_id }` — encoded as a QR / Data Matrix barcode.
- Each page of each copy gets a **unique** TMC (different `copy_index`).

#### Component: `PrintRoomVisionAgent` (Python Worker)
- Standalone process connecting to a local webcam via OpenCV.
- Runs YOLOv8 inference every N frames.
- If `mobile_phone` class detected → calls `POST /api/v1/vision/alert` → print job is paused.
- Runs locally on the print room machine; communicates with the central API over LAN.

#### Component: `VaultViewerCanvas` (Frontend)
- Next.js page `/print-room/view-paper`.
- Renders the decrypted paper in a protected `<canvas>` element (not `<img>` or `<iframe>`).
- JavaScript disables: right-click, `Ctrl+P`, `Ctrl+S`, drag-and-drop.
- `visibilitychange` and `blur` events trigger an immediate session lock.
- Screen sharing detection via `getDisplayMedia` permission listener.

---

## 4. Module 2 — Geofenced Transit

### 4.1 Conceptual Flow

```
Batch dispatched → QR seal affixed to box → Driver opens PWA → GPS tracking begins
       ↓
Backend computes pre-approved route polyline (Google Maps Directions API)
       ↓
Every 30 seconds: driver PWA posts GPS ping to backend
       ↓
GeofenceEngine checks: deviation > 500m OR stationary > 10 min?
       ↓YES                           ↓NO
Flag batch COMPROMISED         Continue tracking
Supabase Realtime push →       Admin map updates live
Admin dashboard alert
```

### 4.2 Components

#### Component: `TransitService` (Backend)
- Manages batch lifecycle: `dispatched → in_transit → checkpoint_scanned → delivered`.
- Stores GPS pings in `transit_pings` table.
- Runs `GeofenceEngine` on every ping.

#### Component: `GeofenceEngine` (Backend, utility class)
- Accepts a lat/lng point, a route polyline, and a batch record.
- Uses `haversine` formula to find minimum distance from point to any polyline segment.
- Compares against 500m threshold.
- Checks time since last movement against 10-minute threshold.
- Returns `{ status: "ok" | "deviation" | "stationary", detail }`.

#### Component: `TransitPWA` (Frontend, `/transit/track/[batch_id]`)
- Next.js page rendered as a PWA.
- Uses `navigator.geolocation.watchPosition` for continuous GPS.
- Displays current route, checkpoints, and live status badge.
- Dead-simple UI: large status indicator, map, scan button.

#### Component: `AdminLiveMap` (Frontend, `/admin/transit`)
- Subscribes to Supabase Realtime channel `transit_updates`.
- Renders all active batches on a Google Maps instance as animated markers.
- Color-coded: green (on route), yellow (stationary warning), red (compromised).

---

## 5. Module 3 — Exam Center Operations

### 5.1 Conceptual Flow

```
Student record in DB → Server generates cryptographic QR (JWT signed with RS256 private key)
       ↓
QR printed on admit card
       ↓
Supervisor scans QR → Backend verifies JWT signature + student identity hash
       ↓
Paper box received at center → Batch ID scanned, count verified vs candidate count
       ↓
YOLOv8 edge agent watches exam hall → Mobile/earpiece detected → Alert fired
```

### 5.2 Components

#### Component: `AdmitCardService` (Backend)
- Generates JWT-based QR codes. Payload: `{ student_id, exam_id, center_id, name_hash, photo_hash, iat, exp }`.
- Signed with server's RS256 private key (stored in env, never in DB).
- `POST /api/v1/admit-cards/generate` — bulk generation for an exam.
- `POST /api/v1/admit-cards/verify` — validates QR content and signature at entry.

#### Component: `ExamHallVisionAgent` (Python Worker)
- Similar to `PrintRoomVisionAgent` but deployed at exam center.
- Detects: smartphones, wireless earpieces (custom YOLO class if training permits, else flag headphones).
- Sends alerts to `POST /api/v1/vision/alert` with `location_type: "exam_hall"`.

#### Component: `SupervisorApp` (Frontend, `/center/supervisor`)
- Mobile-optimized Next.js page.
- QR scanner using device camera (`jsQR` or `zxing-js`).
- Shows student photo + identity confirmation on scan.
- Alert panel showing live vision agent alerts.

---

## 6. Module 4 — Post-Exam OMR Ledger

### 6.1 Conceptual Flow

```
Exam ends → Supervisor scans OMR sheets on mobile/tablet camera
       ↓
Image uploaded to backend → SHA-256 hash computed server-side
       ↓
Hash + image stored: Supabase Storage (image) + omr_hashes table (hash)
       ↓
If paper arrives at grading facility: re-hash and compare
       ↓
Hash mismatch → ALERT: physical tampering detected
```

### 6.2 Components

#### Component: `OMRService` (Backend)
- `POST /api/v1/omr/upload` — accepts multipart image upload, computes SHA-256, stores to Supabase Storage, records hash in DB.
- `POST /api/v1/omr/verify` — accepts a re-uploaded image, recomputes hash, compares to stored hash. Returns `{ match: bool, stored_at, stored_by }`.
- Bulk endpoint supports batch uploads (exam center uploads all sheets at once).

#### Component: `OMRUploadUI` (Frontend, `/center/omr-upload`)
- Camera capture or file upload interface.
- Shows real-time upload progress.
- Confirms hash registration with a checkmark and timestamp.

---

## 7. Module 5 — Forensic Intelligence

### 7.1 Conceptual Flow

```
Anonymous user uploads suspected leak photo to portal
       ↓
ForensicWorker receives image → OpenCV pipeline:
  1. Deskew (Hough line transform)
  2. Contrast enhancement (CLAHE)
  3. Binarization (adaptive threshold)
  4. QR/Data Matrix decoder (pyzbar / pylibdmtx)
       ↓
TMC decoded: { printer_id, operator_id, center_id, timestamp_unix, batch_id }
       ↓
Query DB: match against print_jobs and audit_logs
       ↓
Generate "Leak Source Probability Report":
  - Primary suspect (operator + printer + timestamp)
  - Custody chain reconstruction
  - Confidence score
```

### 7.2 Components

#### Component: `ForensicWorker` (Python Worker / FastAPI background task)
- Triggered by `POST /api/v1/forensic/upload`.
- Returns a `job_id` immediately (async processing).
- Worker pipeline: deskew → enhance → decode TMC → DB query → report generation.
- Report stored in `forensic_reports` table.

#### Component: `ForensicPortal` (Frontend, `/report`)
- Anonymous upload page with tagline "See Something. Secure Something."
- No login required. File upload + optional description.
- Shows job status via polling `GET /api/v1/forensic/status/[job_id]`.
- On completion, renders the Leak Source Report with confidence score and custody chain.

#### Component: `LeakAttributionEngine` (Backend, utility class)
- Given a decoded TMC, queries `print_jobs`, `operators`, `audit_logs`, `transit_pings`.
- Computes `probability_score` based on: decoded identity match (1.0), custody deviations in transit (−0.1 per clean checkpoint), time-of-access anomalies.
- Returns structured report with `primary_suspect`, `custody_chain[]`, `confidence_score`.

---

## 8. Cross-Cutting Concerns

### 8.1 Authentication & Role-Based Access

| Role | Access |
|---|---|
| `super_admin` | Full system access, key assembly authorization |
| `authority_a` / `authority_b` | Submit Shamir key shares only |
| `print_operator` | Print room dashboard only |
| `driver` | Transit PWA only |
| `supervisor` | Center verification + OMR upload |
| `public` | Forensic upload portal (unauthenticated) |

All authenticated routes require a Supabase JWT in the `Authorization: Bearer <token>` header. Role is stored in `user_profiles.role` and embedded in the JWT via Supabase custom claims.

### 8.2 Audit Logging

Every sensitive action writes to the `audit_logs` table:
- Who (user_id), what (action_type), when (timestamp), context (JSON metadata).
- Audit log rows are **append-only** — no update/delete permissions granted at DB level via Supabase RLS.

### 8.3 Realtime Events

Supabase Realtime channels:

| Channel | Published By | Subscribed By |
|---|---|---|
| `print_room` | PrintSpoolerMiddleware | Admin dashboard |
| `transit_updates` | TransitService | Admin live map |
| `vision_alerts` | VisionAgents | Admin dashboard, Supervisor app |
| `forensic_jobs` | ForensicWorker | Forensic portal (status polling fallback) |

### 8.4 Error Handling Convention

All FastAPI responses follow:
```json
{
  "success": true | false,
  "data": { ... } | null,
  "error": null | { "code": "ERR_CODE", "message": "..." }
}
```

### 8.5 Environment Variables (`.env`)

```
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=

# Cryptography
VAULT_MASTER_SALT=          # used for key derivation, never the key itself
JWT_RS256_PRIVATE_KEY=      # PEM format, for admit card signing
JWT_RS256_PUBLIC_KEY=

# Google Maps
GOOGLE_MAPS_API_KEY=

# YOLOv8
YOLO_MODEL_PATH=./models/yolov8n.pt
YOLO_CONFIDENCE_THRESHOLD=0.65

# Print Room
PRINT_ROOM_WEBCAM_INDEX=0
AUTHORIZED_PRINTER_IDS=printer_001,printer_002
```

---

## 9. Complete API Reference

> Base URL: `http://localhost:8000/api/v1`  
> All authenticated routes require: `Authorization: Bearer <supabase_jwt>`

---

### Module 1: Vault & Print

#### `POST /vault/papers`
Upload and encrypt a question paper.

**Auth:** `super_admin`  
**Body:** `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `file` | File | Raw PDF of the question paper |
| `exam_id` | string (UUID) | Associated exam |
| `title` | string | Human-readable label |

**Response 201:**
```json
{
  "success": true,
  "data": {
    "paper_id": "uuid",
    "exam_id": "uuid",
    "key_share_a_id": "uuid",
    "key_share_b_id": "uuid",
    "status": "encrypted"
  }
}
```

**Notes:** The paper is encrypted with AES-256-GCM. The 256-bit key is split into two shares via Shamir's (2-of-2). Each share ID is returned; the actual share values are delivered to Authority A and B separately via `GET /vault/key-shares/[share_id]` (separate auth tokens per authority).

---

#### `GET /vault/key-shares/{share_id}`
Retrieve a Shamir key share. Single-use endpoint — share is invalidated after retrieval.

**Auth:** `authority_a` or `authority_b` (enforced by RLS on `key_shares` table)  
**Response 200:**
```json
{
  "success": true,
  "data": {
    "share_id": "uuid",
    "share_value": "hex-encoded-share",
    "paper_id": "uuid"
  }
}
```

---

#### `POST /vault/papers/{paper_id}/authorize-print`
Assemble key shares in RAM, decrypt paper, open a print authorization window.

**Auth:** Both `authority_a` and `authority_b` must submit their shares (two separate requests, or one joint request body).  
**Body:**
```json
{
  "share_a": "hex-encoded-share-value",
  "share_b": "hex-encoded-share-value",
  "authorized_copies": 120,
  "authorized_centers": ["center_uuid_1", "center_uuid_2"],
  "print_window_minutes": 30
}
```
**Response 200:**
```json
{
  "success": true,
  "data": {
    "print_session_id": "uuid",
    "expires_at": "ISO8601",
    "authorized_copies": 120
  }
}
```

---

#### `GET /vault/papers/{paper_id}/view`
Stream decrypted paper to protected canvas. Generates and returns a single-use, short-lived view token. This token is recorded in the `vault_view_tokens` table and invalidated immediately upon first use (or after 60 seconds) to prevent replay attacks.

**Auth:** `print_operator` (only during active print session)  
**Response 200:**
```json
{
  "success": true,
  "data": {
    "view_token": "single-use-token-uuid",
    "expires_in_seconds": 60
  }
}
```

---

#### `POST /print/jobs`
Initiate a print job through the middleware.

**Auth:** `print_operator`  
**Body:**
```json
{
  "paper_id": "uuid",
  "print_session_id": "uuid",
  "printer_id": "string",
  "copies": 30,
  "center_id": "uuid"
}
```
**Response 201:**
```json
{
  "success": true,
  "data": {
    "job_id": "uuid",
    "status": "queued",
    "watermark_batch_id": "uuid"
  }
}
```

---

#### `GET /print/jobs/{job_id}`
Get status of a print job.

**Auth:** `print_operator` | `super_admin`  
**Response 200:**
```json
{
  "success": true,
  "data": {
    "job_id": "uuid",
    "status": "queued | printing | completed | aborted",
    "pages_printed": 12,
    "aborted_reason": null
  }
}
```

---

#### `POST /print/jobs/{job_id}/abort`
Emergency abort. Kills active print job.

**Auth:** `super_admin`  
**Response 200:** `{ "success": true, "data": { "aborted_at": "ISO8601" } }`

---

#### `POST /vision/alert`
Receives alert from a YOLOv8 Vision Agent (internal, from local worker).

**Auth:** Internal API key (not user JWT)  
**Body:**
```json
{
  "agent_id": "string",
  "location_type": "print_room | exam_hall",
  "location_id": "uuid",
  "detected_class": "mobile_phone | earpiece | headphones",
  "confidence": 0.87,
  "frame_base64": "optional-jpeg-base64",
  "timestamp": "ISO8601"
}
```
**Response 201:** Alert stored, Realtime push fired on `vision_alerts` channel.

---

### Module 2: Transit

#### `POST /transit/batches`
Register a physical box for transit.

**Auth:** `super_admin`  
**Body:**
```json
{
  "print_job_id": "uuid",
  "center_id": "uuid",
  "assigned_driver_id": "uuid",
  "route_origin": { "lat": 19.076, "lng": 72.877 },
  "route_destination": { "lat": 19.21, "lng": 72.98 },
  "dispatch_time": "ISO8601"
}
```
**Response 201:**
```json
{
  "success": true,
  "data": {
    "batch_id": "uuid",
    "qr_seal_payload": "base64-qr-data",
    "route_polyline": "encoded-polyline-string",
    "checkpoints": [ { "lat": ..., "lng": ..., "label": "Checkpoint 1" } ]
  }
}
```

---

#### `POST /transit/batches/{batch_id}/pings`
Driver PWA posts real-time GPS location.

**Auth:** `driver`  
**Body:**
```json
{
  "lat": 19.13,
  "lng": 72.91,
  "accuracy_meters": 12,
  "timestamp": "ISO8601"
}
```
**Response 200:**
```json
{
  "success": true,
  "data": {
    "geofence_status": "ok | deviation | stationary",
    "deviation_meters": 0,
    "stationary_minutes": 0
  }
}
```
**Side effect:** If `deviation | stationary`, batch status updated to `COMPROMISED`, Realtime event published.

---

#### `POST /transit/batches/{batch_id}/checkpoints`
Driver scans QR seal at a checkpoint.

**Auth:** `driver`  
**Body:**
```json
{
  "checkpoint_index": 1,
  "scanned_qr_payload": "string",
  "lat": 19.18,
  "lng": 72.94
}
```
**Response 200:** `{ "success": true, "data": { "checkpoint_verified": true } }`

---

#### `GET /transit/batches/{batch_id}`
Get full batch status and ping history.

**Auth:** `super_admin` | `driver` (own batch only)  
**Response 200:**
```json
{
  "success": true,
  "data": {
    "batch_id": "uuid",
    "status": "dispatched | in_transit | compromised | delivered",
    "last_ping": { "lat": ..., "lng": ..., "at": "ISO8601" },
    "ping_count": 47,
    "checkpoints_cleared": 2
  }
}
```

---

#### `GET /transit/batches`
List all active batches (admin overview).

**Auth:** `super_admin`  
**Query params:** `?exam_id=uuid&status=in_transit`  
**Response 200:** Array of batch summaries.

---

### Module 3: Exam Center

#### `POST /admit-cards/generate`
Bulk-generate cryptographic QR admit cards for an exam.

**Auth:** `super_admin`  
**Body:**
```json
{
  "exam_id": "uuid",
  "center_id": "uuid"
}
```
**Response 202:** Async job queued. Returns `{ "job_id": "uuid" }`.

---

#### `POST /admit-cards/verify`
Verify a scanned admit card QR at exam center entry.

**Auth:** `supervisor`  
**Body:**
```json
{
  "qr_payload": "jwt-string",
  "center_id": "uuid",
  "verified_by": "uuid"
}
```
**Response 200:**
```json
{
  "success": true,
  "data": {
    "student_id": "uuid",
    "student_name": "string",
    "is_valid": true,
    "already_scanned": false,
    "photo_url": "supabase-storage-url"
  }
}
```

---

#### `POST /centers/{center_id}/receive-batch`
Supervisor confirms physical batch received at center.

**Auth:** `supervisor`  
**Body:**
```json
{
  "batch_id": "uuid",
  "qr_seal_payload": "string",
  "paper_count_received": 120
}
```
**Response 200:** `{ "success": true, "data": { "count_mismatch": false } }`

---

### Module 4: OMR Ledger

#### `POST /omr/upload`
Upload a scanned OMR sheet image; compute and store hash.

**Auth:** `supervisor`  
**Body:** `multipart/form-data`

| Field | Type |
|---|---|
| `file` | Image (JPEG/PNG) |
| `student_id` | UUID |
| `exam_id` | UUID |
| `center_id` | UUID |

**Response 201:**
```json
{
  "success": true,
  "data": {
    "omr_record_id": "uuid",
    "sha256_hash": "hex-string",
    "storage_path": "omr-scans/exam_id/student_id.jpg"
  }
}
```

---

#### `POST /omr/verify`
Re-hash an OMR image and compare against stored hash.

**Auth:** `super_admin`  
**Body:** `multipart/form-data` (same fields as upload)  
**Response 200:**
```json
{
  "success": true,
  "data": {
    "match": true,
    "stored_hash": "hex",
    "computed_hash": "hex",
    "original_uploaded_at": "ISO8601",
    "original_uploaded_by": "uuid"
  }
}
```

---

#### `POST /omr/bulk-upload`
Batch upload multiple OMR sheets.

**Auth:** `supervisor`  
**Body:** `multipart/form-data` with multiple files + a JSON manifest.  
**Response 202:** `{ "job_id": "uuid", "total_files": 40 }`

---

### Module 5: Forensic Intelligence

#### `POST /forensic/upload`
Anonymous public upload of a suspected leak photo.

**Auth:** None (public endpoint). Rate-limited: 5 uploads/IP/hour.  
**Body:** `multipart/form-data`

| Field | Type |
|---|---|
| `file` | Image (JPEG/PNG) |
| `description` | string (optional) |

**Response 202:**
```json
{
  "success": true,
  "data": {
    "job_id": "uuid",
    "status": "processing",
    "estimated_seconds": 15
  }
}
```

---

#### `GET /forensic/status/{job_id}`
Poll forensic analysis job status.

**Auth:** None  
**Response 200:**
```json
{
  "success": true,
  "data": {
    "job_id": "uuid",
    "status": "processing | completed | failed | no_watermark_found",
    "report": null
  }
}
```
When `status === "completed"`:
```json
{
  "report": {
    "tmc_decoded": {
      "printer_id": "string",
      "operator_id": "uuid",
      "center_id": "uuid",
      "batch_id": "uuid",
      "timestamp_unix": 1735000000
    },
    "primary_suspect": {
      "operator_name": "string",
      "printer_label": "string",
      "center_name": "string",
      "leaked_at": "ISO8601"
    },
    "custody_chain": [...],
    "confidence_score": 0.97
  }
}
```

---

#### `GET /forensic/reports` *(Admin only)*
List all forensic reports.

**Auth:** `super_admin`  
**Response 200:** Array of report summaries.

---

### System / Utility Endpoints

#### `GET /health`
Health check. No auth.

#### `GET /audit-logs`
**Auth:** `super_admin`  
**Query:** `?user_id=&action_type=&from=ISO8601&to=ISO8601`

#### `GET /exams`
List all exams. **Auth:** `super_admin`

#### `POST /exams`
Create an exam. **Auth:** `super_admin`

#### `GET /centers`
List all exam centers. **Auth:** `super_admin`

#### `POST /centers`
Create an exam center. **Auth:** `super_admin`

---

## 10. Frontend Routes Reference

> All routes under the Next.js App Router (`/app` directory)

| Route | Page Component | Auth Required | Description |
|---|---|---|---|
| `/` | `LandingPage` | No | System overview + admin login CTA |
| `/auth/login` | `LoginPage` | No | Supabase Auth login |
| `/admin` | `AdminDashboard` | `super_admin` | Overview: print status, transit map, recent alerts |
| `/admin/exams` | `ExamsListPage` | `super_admin` | Create & manage exams |
| `/admin/exams/[exam_id]` | `ExamDetailPage` | `super_admin` | Paper upload, authorize print, admit card generation |
| `/admin/transit` | `AdminTransitMap` | `super_admin` | Live Google Map of all active batches |
| `/admin/forensic` | `AdminForensicReports` | `super_admin` | List of all forensic reports |
| `/admin/audit` | `AuditLogPage` | `super_admin` | Searchable audit log viewer |
| `/print-room` | `PrintRoomDashboard` | `print_operator` | Active print session, job queue, vision alerts |
| `/print-room/view-paper` | `SecureViewerPage` | `print_operator` | Protected canvas viewer for decrypted paper |
| `/transit/track/[batch_id]` | `TransitPWA` | `driver` | GPS tracking interface for drivers |
| `/center/supervisor` | `SupervisorDashboard` | `supervisor` | QR admit card scanner + batch reception |
| `/center/omr-upload` | `OMRUploadPage` | `supervisor` | Scan & upload OMR sheets |
| `/report` | `ForensicPortal` | No (anonymous) | "See Something. Secure Something." leak upload |
| `/report/status/[job_id]` | `ForensicStatusPage` | No | Job status + rendered report |

---

## 11. Service-to-Service Communication

### Internal Python Workers → FastAPI Backend

Workers (YOLOv8 agents, ForensicWorker) are co-deployed services that communicate with the FastAPI backend over localhost using an **Internal API Key** (not user JWTs). This key is set in env as `INTERNAL_WORKER_API_KEY` and validated via a FastAPI dependency on designated internal routes.

### FastAPI Backend → Supabase

The backend uses `supabase-py` (service role key) for DB and Storage operations. Realtime events are published via Supabase's Postgres `NOTIFY` or the Supabase JS client on the frontend subscribes to DB-level changes.

### Frontend → Supabase Realtime (Direct Subscription)

The Next.js frontend subscribes to Supabase Realtime channels directly using the `@supabase/supabase-js` client with the **anon key** + user JWT. RLS ensures users only see data relevant to their role.

---

## 12. Deployment Topology

### Local / Hackathon Demo Setup

```
docker-compose.yml
├── fastapi-backend          (port 8000)
├── nextjs-frontend          (port 3000)
├── yolo-print-room-agent    (local process, connects to webcam index 0)
├── yolo-exam-hall-agent     (local process, connects to webcam index 1)
└── forensic-worker          (background process, listens for jobs via DB polling)
```

All services share a `.env` file. Supabase is used as a managed external service (no local Postgres needed for demo).

### Repository Structure (Monorepo Recommended for 5-Person Team)

```
leakguard-ai/
├── apps/
│   ├── frontend/          (Next.js — Person 1 + 2)
│   └── backend/           (FastAPI — Person 3 + 4)
├── workers/
│   ├── vision_agent/      (YOLOv8 — Person 4)
│   └── forensic_worker/   (OpenCV + EasyOCR — Person 5)
├── shared/
│   └── types/             (Shared TypeScript types for API contracts)
├── supabase/
│   └── migrations/        (SQL migration files — owned by Person 3)
├── docker-compose.yml
└── .env.example
```

> **Team Split Recommendation:**  
> Person 1: Frontend (Admin Dashboard, Vault UI, Print Room UI)  
> Person 2: Frontend (Transit PWA, Supervisor App, Forensic Portal)  
> Person 3: Backend (Vault, Print, DB Schema, Auth)  
> Person 4: Backend (Transit, Centers, OMR) + Vision Agent setup  
> Person 5: ForensicWorker (OpenCV pipeline, watermark decode, report engine)
