# LeakGuard AI — Database Design Document

> **Version:** 1.0.0 | **Database:** PostgreSQL via Supabase  
> **Naming Convention:** `snake_case` for all table names, column names, and index names.  
> All tables include `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` and `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` unless explicitly noted otherwise.  
> All foreign keys use the pattern `referenced_table_name_id` (e.g., `exam_id` references `exams.id`).

---

## Table of Contents

1. [Naming Conventions](#1-naming-conventions)
2. [Entity-Relationship Overview](#2-entity-relationship-overview)
3. [Core / Reference Tables](#3-core--reference-tables)
4. [Module 1 — Vault & Print Tables](#4-module-1--vault--print-tables)
5. [Module 2 — Transit Tables](#5-module-2--transit-tables)
6. [Module 3 — Exam Center Tables](#6-module-3--exam-center-tables)
7. [Module 4 — OMR Ledger Tables](#7-module-4--omr-ledger-tables)
8. [Module 5 — Forensic Tables](#8-module-5--forensic-tables)
9. [Audit & System Tables](#9-audit--system-tables)
10. [Indexes](#10-indexes)
11. [Row-Level Security (RLS) Summary](#11-row-level-security-rls-summary)
12. [Enums](#12-enums)

---

## 1. Naming Conventions

| Pattern | Example | Rule |
|---|---|---|
| Table names | `print_jobs`, `transit_batches` | Plural, snake_case |
| Primary key | `id` | Always UUID, always named `id` |
| Foreign keys | `exam_id`, `operator_id` | `{referenced_singular_table}_id` |
| Timestamps | `created_at`, `updated_at`, `dispatched_at` | Always `_at` suffix, always `TIMESTAMPTZ` |
| Status columns | `status` | Always a custom `ENUM` type (defined in §12) |
| Boolean columns | `is_valid`, `is_flagged` | Always `is_` prefix |
| JSON/JSONB columns | `metadata`, `report_payload` | Descriptive name, always `JSONB` |
| Soft-delete | `deleted_at` | NULL means active; set to timestamp to soft-delete |

**Standard column order in every table:**
1. `id UUID PRIMARY KEY`
2. Foreign key columns (e.g., `exam_id`, `user_id`)
3. Business columns (specific to the table)
4. `status` (if applicable)
5. `metadata JSONB` (if applicable)
6. `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
7. `updated_at TIMESTAMPTZ` (if row is mutable)

---

## 2. Entity-Relationship Overview

```
users ──────────────────────── user_profiles (1:1)
  │
  └─── (operator) ──────────── print_jobs (1:many)
  └─── (driver) ─────────────── transit_batches (1:many)
  └─── (supervisor) ─────────── omr_records (1:many)
  └─── (supervisor) ─────────── admit_card_scans (1:many)

exams ──────────────────────── papers (1:many) ──► key_shares (1:2)
  │                              │             ──► vault_view_tokens (1:many)
  │                              │
  └──── exam_centers (many:many via exam_center_assignments)
  └──── students (many:many via exam_enrollments)
                                 │
                              print_jobs (1:many)
                                 │
                              transit_batches (1:1 per job per center)
                                 │
                              [physical delivery]
                                 │
                              omr_records (1:many per exam/center)

students ───────────────────── admit_cards (1:1 per exam)
  └──────────────────────────── admit_card_scans (1:many)
  └──────────────────────────── omr_records (1:1 per exam)

forensic_uploads ───────────── forensic_reports (1:1)
```

---

## 3. Core / Reference Tables

### `users`
Managed by Supabase Auth. Do not create manually.  
Referenced by `user_profiles.id`.

---

### `user_profiles`

Extends Supabase Auth `auth.users` with application-level data.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK, FK → `auth.users.id` ON DELETE CASCADE | Same UUID as auth user |
| `full_name` | TEXT | NOT NULL | Display name |
| `role` | `user_role_enum` | NOT NULL | One of: `super_admin`, `authority_a`, `authority_b`, `print_operator`, `driver`, `supervisor` |
| `assigned_location_id` | UUID | FK → `exam_centers.id`, NULLABLE | For drivers/supervisors scoped to a center |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE | Soft disable without deleting auth user |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | | |

---

### `exams`

Represents a single examination event.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `title` | TEXT | NOT NULL | e.g., "JEE Mains 2026 — Paper 1" |
| `subject` | TEXT | NOT NULL | e.g., "Mathematics" |
| `scheduled_at` | TIMESTAMPTZ | NOT NULL | Official exam start time |
| `duration_minutes` | INTEGER | NOT NULL | Exam duration |
| `status` | `exam_status_enum` | NOT NULL DEFAULT 'draft' | `draft`, `active`, `completed`, `cancelled` |
| `created_by` | UUID | FK → `user_profiles.id` | Admin who created the exam |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | | |

---

### `exam_centers`

Physical exam venues.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `name` | TEXT | NOT NULL | e.g., "SPIT Mumbai — Hall B" |
| `address` | TEXT | NOT NULL | Full postal address |
| `city` | TEXT | NOT NULL | |
| `lat` | DOUBLE PRECISION | NOT NULL | GPS latitude |
| `lng` | DOUBLE PRECISION | NOT NULL | GPS longitude |
| `capacity` | INTEGER | NOT NULL | Max student capacity |
| `contact_supervisor_id` | UUID | FK → `user_profiles.id`, NULLABLE | Default supervisor |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

---

### `exam_center_assignments`

Many-to-many join: which centers host which exams.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `exam_id` | UUID | FK → `exams.id` ON DELETE CASCADE | |
| `center_id` | UUID | FK → `exam_centers.id` ON DELETE CASCADE | |
| `candidate_count` | INTEGER | NOT NULL DEFAULT 0 | Expected number of students at this center |
| `assigned_supervisor_id` | UUID | FK → `user_profiles.id`, NULLABLE | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Unique constraint:** `(exam_id, center_id)`

---

### `students`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `roll_number` | TEXT | NOT NULL UNIQUE | Official roll number |
| `full_name` | TEXT | NOT NULL | |
| `date_of_birth` | DATE | NOT NULL | |
| `photo_storage_path` | TEXT | NULLABLE | Supabase Storage path to student photo |
| `name_hash` | TEXT | NOT NULL | SHA-256 of `full_name + roll_number` — for admit card verification |
| `photo_hash` | TEXT | NULLABLE | SHA-256 of photo file — for identity verification |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

---

### `exam_enrollments`

Many-to-many join: which students are enrolled in which exam at which center.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `student_id` | UUID | FK → `students.id` | |
| `exam_id` | UUID | FK → `exams.id` | |
| `center_id` | UUID | FK → `exam_centers.id` | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Unique constraint:** `(student_id, exam_id)`

---

## 4. Module 1 — Vault & Print Tables

### `papers`

The encrypted question paper asset.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `exam_id` | UUID | FK → `exams.id` ON DELETE RESTRICT | |
| `title` | TEXT | NOT NULL | e.g., "Mathematics — Set A" |
| `encrypted_blob_path` | TEXT | NOT NULL | Supabase Storage path to AES-256-GCM encrypted PDF |
| `iv_hex` | TEXT | NOT NULL | AES-GCM initialization vector (hex-encoded, 96-bit) |
| `auth_tag_hex` | TEXT | NOT NULL | AES-GCM authentication tag (hex-encoded) |
| `file_size_bytes` | BIGINT | NOT NULL | Original PDF size |
| `page_count` | INTEGER | NULLABLE | Populated after successful test-decrypt |
| `status` | `paper_status_enum` | NOT NULL DEFAULT 'encrypted' | `encrypted`, `print_authorized`, `printed`, `archived` |
| `uploaded_by` | UUID | FK → `user_profiles.id` | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | | |

---

### `key_shares`

Stores Shamir's Secret Sharing key shares for each paper. **Two rows per paper** (one for Authority A, one for Authority B).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `paper_id` | UUID | FK → `papers.id` ON DELETE CASCADE | |
| `authority_role` | TEXT | NOT NULL | `'authority_a'` or `'authority_b'` |
| `share_value_encrypted` | TEXT | NOT NULL | The Shamir share, itself encrypted with authority's password-derived key |
| `is_retrieved` | BOOLEAN | NOT NULL DEFAULT FALSE | Set to TRUE after first retrieval (single-use) |
| `retrieved_at` | TIMESTAMPTZ | NULLABLE | |
| `retrieved_by` | UUID | FK → `user_profiles.id`, NULLABLE | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Unique constraint:** `(paper_id, authority_role)`  
**Note:** `share_value_encrypted` is encrypted at rest using a key derived from the authority's password via PBKDF2 — the raw Shamir share is NEVER stored in plaintext.

---

### `print_sessions`

Represents an authorized print window for a paper.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `paper_id` | UUID | FK → `papers.id` | |
| `authorized_by_a` | UUID | FK → `user_profiles.id` | Authority A who submitted share |
| `authorized_by_b` | UUID | FK → `user_profiles.id` | Authority B who submitted share |
| `authorized_copies` | INTEGER | NOT NULL | Maximum copies approved |
| `authorized_centers` | UUID[] | NOT NULL | Array of center IDs approved for this batch |
| `expires_at` | TIMESTAMPTZ | NOT NULL | End of print window |
| `is_active` | BOOLEAN | NOT NULL DEFAULT TRUE | FALSE if expired or manually cancelled |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

---

### `print_jobs`

One print job = one physical print run at one printer.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `paper_id` | UUID | FK → `papers.id` | |
| `print_session_id` | UUID | FK → `print_sessions.id` | |
| `center_id` | UUID | FK → `exam_centers.id` | Destination center |
| `printer_id` | TEXT | NOT NULL | Hardware printer identifier |
| `operator_id` | UUID | FK → `user_profiles.id` | Print room operator |
| `copies_requested` | INTEGER | NOT NULL | |
| `copies_printed` | INTEGER | NOT NULL DEFAULT 0 | Incremented as pages print |
| `watermark_batch_id` | UUID | NOT NULL DEFAULT gen_random_uuid() | Groups all watermarked pages for this job |
| `status` | `print_job_status_enum` | NOT NULL DEFAULT 'queued' | `queued`, `printing`, `completed`, `aborted` |
| `aborted_reason` | TEXT | NULLABLE | Reason if aborted |
| `started_at` | TIMESTAMPTZ | NULLABLE | |
| `completed_at` | TIMESTAMPTZ | NULLABLE | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

---

### `watermark_registry`

One row per watermarked page copy. Enables forensic attribution to exact copy and page.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `print_job_id` | UUID | FK → `print_jobs.id` | |
| `watermark_batch_id` | UUID | NOT NULL | Groups pages of one job |
| `copy_index` | INTEGER | NOT NULL | Which copy (1, 2, 3...) |
| `page_index` | INTEGER | NOT NULL | Which page within the copy |
| `tmc_payload` | JSONB | NOT NULL | `{ printer_id, operator_id, center_id, batch_id, timestamp_unix, copy_index, page_index }` |
| `tmc_code_hex` | TEXT | NOT NULL | Hex representation of encoded Data Matrix / QR payload |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Unique constraint:** `(print_job_id, copy_index, page_index)`

---

### `vision_alerts`

Stores alerts from YOLOv8 vision agents.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `agent_id` | TEXT | NOT NULL | Identifier of the vision agent process |
| `location_type` | TEXT | NOT NULL | `'print_room'` or `'exam_hall'` |
| `location_id` | UUID | NOT NULL | FK → `exam_centers.id` or a print room record |
| `detected_class` | TEXT | NOT NULL | `'mobile_phone'`, `'earpiece'`, `'headphones'` |
| `confidence` | DOUBLE PRECISION | NOT NULL | YOLOv8 confidence score 0.0–1.0 |
| `linked_job_id` | UUID | NULLABLE | FK → `print_jobs.id` if applicable |
| `frame_storage_path` | TEXT | NULLABLE | Supabase Storage path to flagged frame snapshot |
| `is_reviewed` | BOOLEAN | NOT NULL DEFAULT FALSE | Admin acknowledgement flag |
| `triggered_abort` | BOOLEAN | NOT NULL DEFAULT FALSE | Whether this alert triggered a print job abort |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

---

### `vault_view_tokens`

Single-use tokens for viewing decrypted papers, securing against replay attacks.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `paper_id` | UUID | FK → `papers.id` ON DELETE CASCADE | |
| `token` | TEXT | NOT NULL UNIQUE | Single-use view token |
| `is_used` | BOOLEAN | NOT NULL DEFAULT FALSE | Marked TRUE on use |
| `expires_at` | TIMESTAMPTZ | NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds') | Token TTL |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

---

## 5. Module 2 — Transit Tables

### `transit_batches`

One physical sealed box in transit.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `print_job_id` | UUID | FK → `print_jobs.id` UNIQUE | One batch per print job |
| `center_id` | UUID | FK → `exam_centers.id` | Destination |
| `assigned_driver_id` | UUID | FK → `user_profiles.id` | |
| `qr_seal_payload` | TEXT | NOT NULL | Encoded QR seal content for box |
| `route_polyline` | TEXT | NOT NULL | Google Maps encoded polyline |
| `route_origin_lat` | DOUBLE PRECISION | NOT NULL | |
| `route_origin_lng` | DOUBLE PRECISION | NOT NULL | |
| `route_destination_lat` | DOUBLE PRECISION | NOT NULL | |
| `route_destination_lng` | DOUBLE PRECISION | NOT NULL | |
| `status` | `transit_status_enum` | NOT NULL DEFAULT 'dispatched' | `dispatched`, `in_transit`, `compromised`, `delivered` |
| `compromised_reason` | TEXT | NULLABLE | `'deviation'` or `'stationary'` |
| `dispatched_at` | TIMESTAMPTZ | NOT NULL | |
| `delivered_at` | TIMESTAMPTZ | NULLABLE | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | | |

---

### `transit_checkpoints`

Pre-defined GPS checkpoints for a route. Populated when batch is dispatched.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `batch_id` | UUID | FK → `transit_batches.id` ON DELETE CASCADE | |
| `checkpoint_index` | INTEGER | NOT NULL | Ordered position (0, 1, 2...) |
| `label` | TEXT | NOT NULL | e.g., "Highway Toll Gate 1" |
| `lat` | DOUBLE PRECISION | NOT NULL | |
| `lng` | DOUBLE PRECISION | NOT NULL | |
| `scanned_at` | TIMESTAMPTZ | NULLABLE | NULL = not yet reached |
| `scanned_by` | UUID | FK → `user_profiles.id`, NULLABLE | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Unique constraint:** `(batch_id, checkpoint_index)`

---

### `transit_pings`

High-frequency GPS ping log from driver's PWA.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `batch_id` | UUID | FK → `transit_batches.id` | |
| `lat` | DOUBLE PRECISION | NOT NULL | |
| `lng` | DOUBLE PRECISION | NOT NULL | |
| `accuracy_meters` | DOUBLE PRECISION | NULLABLE | GPS accuracy |
| `deviation_meters` | DOUBLE PRECISION | NULLABLE | Computed deviation from route polyline |
| `geofence_status` | TEXT | NOT NULL | `'ok'`, `'deviation'`, `'stationary'` |
| `pinged_at` | TIMESTAMPTZ | NOT NULL | Device timestamp of GPS reading |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Note:** This table will grow large. Partition by `created_at` month in production. For hackathon, a simple index on `batch_id` is sufficient.

---

## 6. Module 3 — Exam Center Tables

### `admit_cards`

One admit card per student per exam. Contains the JWT payload data used to generate the QR.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `student_id` | UUID | FK → `students.id` | |
| `exam_id` | UUID | FK → `exams.id` | |
| `center_id` | UUID | FK → `exam_centers.id` | |
| `jwt_payload_hash` | TEXT | NOT NULL | SHA-256 of the JWT string — for lookup without storing JWT |
| `issued_at` | TIMESTAMPTZ | NOT NULL | |
| `expires_at` | TIMESTAMPTZ | NOT NULL | |
| `is_revoked` | BOOLEAN | NOT NULL DEFAULT FALSE | Manual revocation flag |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Unique constraint:** `(student_id, exam_id)`

---

### `admit_card_scans`

Every scan of an admit card QR at exam center entry.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `admit_card_id` | UUID | FK → `admit_cards.id` | |
| `center_id` | UUID | FK → `exam_centers.id` | Where the scan occurred |
| `scanned_by` | UUID | FK → `user_profiles.id` | Supervisor who scanned |
| `is_valid` | BOOLEAN | NOT NULL | JWT signature valid? |
| `failure_reason` | TEXT | NULLABLE | e.g., `'expired'`, `'invalid_signature'`, `'wrong_center'` |
| `scanned_at` | TIMESTAMPTZ | NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

---

### `batch_receptions`

Confirms physical delivery of a paper box at an exam center.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `batch_id` | UUID | FK → `transit_batches.id` UNIQUE | One reception per batch |
| `center_id` | UUID | FK → `exam_centers.id` | |
| `received_by` | UUID | FK → `user_profiles.id` | Supervisor |
| `paper_count_expected` | INTEGER | NOT NULL | From print job |
| `paper_count_received` | INTEGER | NOT NULL | Physical count at center |
| `count_mismatch` | BOOLEAN | NOT NULL GENERATED ALWAYS AS (paper_count_expected != paper_count_received) STORED | |
| `qr_seal_verified` | BOOLEAN | NOT NULL DEFAULT FALSE | Was the QR seal intact? |
| `received_at` | TIMESTAMPTZ | NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

---

## 7. Module 4 — OMR Ledger Tables

### `omr_records`

Immutable hash ledger for each scanned OMR sheet.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `student_id` | UUID | FK → `students.id` | |
| `exam_id` | UUID | FK → `exams.id` | |
| `center_id` | UUID | FK → `exam_centers.id` | |
| `sha256_hash` | TEXT | NOT NULL | SHA-256 hex of the original scanned image |
| `storage_path` | TEXT | NOT NULL | Supabase Storage path to the scanned image |
| `file_size_bytes` | BIGINT | NOT NULL | |
| `uploaded_by` | UUID | FK → `user_profiles.id` | Supervisor who uploaded |
| `uploaded_at` | TIMESTAMPTZ | NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**Unique constraint:** `(student_id, exam_id)` — one OMR record per student per exam.  
**RLS Note:** This table has NO update or delete permissions. Append-only.

---

### `omr_verifications`

Logs each re-hash verification event (at grading facility).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `omr_record_id` | UUID | FK → `omr_records.id` | |
| `recomputed_hash` | TEXT | NOT NULL | Hash of re-uploaded image |
| `is_match` | BOOLEAN | NOT NULL | `recomputed_hash == omr_records.sha256_hash` |
| `verified_by` | UUID | FK → `user_profiles.id` | |
| `verified_at` | TIMESTAMPTZ | NOT NULL | |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

---

## 8. Module 5 — Forensic Tables

### `forensic_uploads`

Raw uploads from the anonymous public portal.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `storage_path` | TEXT | NOT NULL | Supabase Storage path to the uploaded image |
| `file_size_bytes` | BIGINT | NOT NULL | |
| `original_filename` | TEXT | NULLABLE | |
| `description` | TEXT | NULLABLE | User-provided context |
| `uploader_ip_hash` | TEXT | NULLABLE | SHA-256 of IP for rate-limiting, not stored raw |
| `status` | `forensic_job_status_enum` | NOT NULL DEFAULT 'processing' | `processing`, `completed`, `failed`, `no_watermark_found` |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |
| `updated_at` | TIMESTAMPTZ | | |

---

### `forensic_reports`

One-to-one output of the forensic analysis pipeline.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `upload_id` | UUID | FK → `forensic_uploads.id` UNIQUE | |
| `tmc_decoded` | JSONB | NULLABLE | `{ printer_id, operator_id, center_id, batch_id, timestamp_unix, copy_index, page_index }` |
| `primary_suspect_operator_id` | UUID | FK → `user_profiles.id`, NULLABLE | Resolved from `tmc_decoded.operator_id` |
| `primary_suspect_printer_id` | TEXT | NULLABLE | Human-readable printer label |
| `primary_suspect_center_id` | UUID | FK → `exam_centers.id`, NULLABLE | |
| `leaked_at` | TIMESTAMPTZ | NULLABLE | Decoded from `tmc_decoded.timestamp_unix` |
| `custody_chain` | JSONB | NULLABLE | Array of custody events reconstructed from transit logs |
| `confidence_score` | DOUBLE PRECISION | NULLABLE | 0.0–1.0 |
| `processing_notes` | TEXT | NULLABLE | Pipeline output notes / debug info |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

---

## 9. Audit & System Tables

### `audit_logs`

Append-only log of all sensitive system actions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PK | |
| `user_id` | UUID | FK → `user_profiles.id`, NULLABLE | NULL for anonymous/system actions |
| `action_type` | TEXT | NOT NULL | Enum-like string: `'paper_uploaded'`, `'key_share_retrieved'`, `'print_authorized'`, `'print_job_created'`, `'print_job_aborted'`, `'batch_dispatched'`, `'batch_compromised'`, `'admit_card_verified'`, `'omr_uploaded'`, `'forensic_upload'`, `'forensic_report_generated'`, `'vision_alert_fired'` |
| `entity_type` | TEXT | NOT NULL | Table name of the primary entity: `'papers'`, `'print_jobs'`, etc. |
| `entity_id` | UUID | NOT NULL | ID of the affected entity row |
| `metadata` | JSONB | NULLABLE | Additional context (e.g., IP address, user agent, old/new values) |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | |

**RLS Note:** NO user role has UPDATE or DELETE on this table. Insert-only via backend service role.

---

## 10. Indexes

```sql
-- user_profiles
CREATE INDEX idx_user_profiles_role ON user_profiles(role);

-- exams
CREATE INDEX idx_exams_status ON exams(status);
CREATE INDEX idx_exams_scheduled_at ON exams(scheduled_at);

-- exam_center_assignments
CREATE INDEX idx_exam_center_assignments_exam_id ON exam_center_assignments(exam_id);
CREATE INDEX idx_exam_center_assignments_center_id ON exam_center_assignments(center_id);

-- papers
CREATE INDEX idx_papers_exam_id ON papers(exam_id);
CREATE INDEX idx_papers_status ON papers(status);

-- key_shares
CREATE INDEX idx_key_shares_paper_id ON key_shares(paper_id);

-- print_sessions
CREATE INDEX idx_print_sessions_paper_id ON print_sessions(paper_id);
CREATE INDEX idx_print_sessions_is_active ON print_sessions(is_active);

-- print_jobs
CREATE INDEX idx_print_jobs_paper_id ON print_jobs(paper_id);
CREATE INDEX idx_print_jobs_operator_id ON print_jobs(operator_id);
CREATE INDEX idx_print_jobs_status ON print_jobs(status);

-- watermark_registry
CREATE INDEX idx_watermark_registry_print_job_id ON watermark_registry(print_job_id);
CREATE INDEX idx_watermark_registry_batch_id ON watermark_registry(watermark_batch_id);
CREATE INDEX idx_watermark_registry_tmc_operator ON watermark_registry((tmc_payload->>'operator_id'));

-- vault_view_tokens
CREATE INDEX idx_vault_view_tokens_lookup ON vault_view_tokens(token, is_used, expires_at);

-- transit_batches
CREATE INDEX idx_transit_batches_status ON transit_batches(status);
CREATE INDEX idx_transit_batches_driver ON transit_batches(assigned_driver_id);
CREATE INDEX idx_transit_batches_center_id ON transit_batches(center_id);

-- transit_pings (most queried by batch_id + time)
CREATE INDEX idx_transit_pings_batch_id ON transit_pings(batch_id);
CREATE INDEX idx_transit_pings_batch_time ON transit_pings(batch_id, pinged_at DESC);

-- admit_cards
CREATE INDEX idx_admit_cards_student_id ON admit_cards(student_id);
CREATE INDEX idx_admit_cards_exam_id ON admit_cards(exam_id);

-- omr_records
CREATE INDEX idx_omr_records_exam_id ON omr_records(exam_id);
CREATE INDEX idx_omr_records_student_id ON omr_records(student_id);

-- forensic_uploads
CREATE INDEX idx_forensic_uploads_status ON forensic_uploads(status);

-- audit_logs
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

---

## 11. Row-Level Security (RLS) Summary

| Table | super_admin | authority_a/b | print_operator | driver | supervisor | public |
|---|---|---|---|---|---|---|
| `user_profiles` | ALL | SELECT own | SELECT own | SELECT own | SELECT own | — |
| `exams` | ALL | SELECT | SELECT | SELECT | SELECT | — |
| `exam_centers` | ALL | — | SELECT | SELECT | SELECT | — |
| `papers` | ALL | — | SELECT (assigned) | — | — | — |
| `key_shares` | SELECT, DELETE | SELECT own | — | — | — | — |
| `print_sessions` | ALL | INSERT | SELECT (active) | — | — | — |
| `vault_view_tokens` | ALL | — | SELECT (active) | — | — | — |
| `print_jobs` | ALL | — | INSERT, SELECT own | — | — | — |
| `watermark_registry` | SELECT | — | — | — | — | — |
| `vision_alerts` | ALL | — | SELECT | — | SELECT | — |
| `transit_batches` | ALL | — | — | SELECT own, UPDATE own | SELECT | — |
| `transit_checkpoints` | ALL | — | — | SELECT own, UPDATE own | SELECT | — |
| `transit_pings` | SELECT | — | — | INSERT, SELECT own | — | — |
| `admit_cards` | ALL | — | — | — | SELECT (center) | — |
| `admit_card_scans` | SELECT | — | — | — | INSERT, SELECT | — |
| `batch_receptions` | ALL | — | — | — | INSERT, SELECT | — |
| `omr_records` | SELECT | — | — | — | INSERT | — |
| `omr_verifications` | ALL | — | — | — | — | — |
| `forensic_uploads` | SELECT | — | — | — | — | INSERT |
| `forensic_reports` | ALL | — | — | — | — | SELECT own upload |
| `audit_logs` | SELECT | — | — | — | — | — |

---

## 12. Enums

```sql
CREATE TYPE user_role_enum AS ENUM (
  'super_admin',
  'authority_a',
  'authority_b',
  'print_operator',
  'driver',
  'supervisor'
);

CREATE TYPE exam_status_enum AS ENUM (
  'draft',
  'active',
  'completed',
  'cancelled'
);

CREATE TYPE paper_status_enum AS ENUM (
  'encrypted',
  'print_authorized',
  'printed',
  'archived'
);

CREATE TYPE print_job_status_enum AS ENUM (
  'queued',
  'printing',
  'completed',
  'aborted'
);

CREATE TYPE transit_status_enum AS ENUM (
  'dispatched',
  'in_transit',
  'compromised',
  'delivered'
);

CREATE TYPE forensic_job_status_enum AS ENUM (
  'processing',
  'completed',
  'failed',
  'no_watermark_found'
);
```

---

## Appendix: Quick-Reference Column Name Glossary

Use these exact names **everywhere across the codebase** — API JSON keys, TypeScript interfaces, Python Pydantic models, and DB columns must all match.

| Concept | Column/Key Name |
|---|---|
| Primary key | `id` |
| Exam foreign key | `exam_id` |
| Center foreign key | `center_id` |
| Student foreign key | `student_id` |
| Paper foreign key | `paper_id` |
| Print job foreign key | `print_job_id` |
| Transit batch foreign key | `batch_id` |
| Operator foreign key | `operator_id` |
| Driver foreign key | `assigned_driver_id` |
| Watermark group | `watermark_batch_id` |
| SHA-256 hash | `sha256_hash` |
| Tracking Matrix Code data | `tmc_payload` / `tmc_decoded` |
| Confidence score | `confidence_score` |
| Upload Supabase path | `storage_path` |
| Creation time | `created_at` |
| Last update time | `updated_at` |
| Status | `status` |
| GPS latitude | `lat` |
| GPS longitude | `lng` |
