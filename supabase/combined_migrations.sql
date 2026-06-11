-- ==========================================
-- MIGRATION: 001_enums.sql
-- ==========================================
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


-- ==========================================
-- MIGRATION: 002_core_tables.sql
-- ==========================================
-- Pre-create Supabase storage buckets if storage schema exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES 
      ('encrypted-papers', 'encrypted-papers', false),
      ('omr-scans', 'omr-scans', false),
      ('vision-alerts', 'vision-alerts', false),
      ('forensic-uploads', 'forensic-uploads', false)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Create core user_profiles table referencing auth.users (Supabase internal)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role user_role_enum NOT NULL,
  assigned_location_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create exams table
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status exam_status_enum NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create exam_centers table
CREATE TABLE exam_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  capacity INTEGER NOT NULL,
  contact_supervisor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create exam_center_assignments table
CREATE TABLE exam_center_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE CASCADE,
  candidate_count INTEGER NOT NULL DEFAULT 0,
  assigned_supervisor_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_exam_center_assignments UNIQUE (exam_id, center_id)
);

-- Create students table
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  photo_storage_path TEXT,
  name_hash TEXT NOT NULL,
  photo_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create exam_enrollments table
CREATE TABLE exam_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_exam_enrollments UNIQUE (student_id, exam_id)
);

-- Add circular foreign keys
ALTER TABLE user_profiles 
  ADD CONSTRAINT fk_user_profiles_assigned_location 
  FOREIGN KEY (assigned_location_id) REFERENCES exam_centers(id) ON DELETE SET NULL;

ALTER TABLE exam_centers 
  ADD CONSTRAINT fk_exam_centers_contact_supervisor 
  FOREIGN KEY (contact_supervisor_id) REFERENCES user_profiles(id) ON DELETE SET NULL;


-- ==========================================
-- MIGRATION: 003_module1_tables.sql
-- ==========================================
-- Create papers table
CREATE TABLE papers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  encrypted_blob_path TEXT NOT NULL,
  iv_hex TEXT NOT NULL,
  auth_tag_hex TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  page_count INTEGER,
  status paper_status_enum NOT NULL DEFAULT 'encrypted',
  uploaded_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create key_shares table
CREATE TABLE key_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  authority_role TEXT NOT NULL,
  share_value_encrypted TEXT NOT NULL,
  is_retrieved BOOLEAN NOT NULL DEFAULT FALSE,
  retrieved_at TIMESTAMPTZ,
  retrieved_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_key_shares UNIQUE (paper_id, authority_role)
);

-- Create print_sessions table
CREATE TABLE print_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  authorized_by_a UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  authorized_by_b UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  authorized_copies INTEGER NOT NULL,
  authorized_centers UUID[] NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create print_jobs table
CREATE TABLE print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE RESTRICT,
  print_session_id UUID NOT NULL REFERENCES print_sessions(id) ON DELETE CASCADE,
  center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE RESTRICT,
  printer_id TEXT NOT NULL,
  operator_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  copies_requested INTEGER NOT NULL,
  copies_printed INTEGER NOT NULL DEFAULT 0,
  watermark_batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
  status print_job_status_enum NOT NULL DEFAULT 'queued',
  aborted_reason TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create watermark_registry table
CREATE TABLE watermark_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  print_job_id UUID NOT NULL REFERENCES print_jobs(id) ON DELETE CASCADE,
  watermark_batch_id UUID NOT NULL,
  copy_index INTEGER NOT NULL,
  page_index INTEGER NOT NULL,
  tmc_payload JSONB NOT NULL,
  tmc_code_hex TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_watermark_registry UNIQUE (print_job_id, copy_index, page_index)
);

-- Create vision_alerts table
CREATE TABLE vision_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL,
  location_type TEXT NOT NULL,
  location_id UUID NOT NULL,
  detected_class TEXT NOT NULL,
  confidence DOUBLE PRECISION NOT NULL,
  linked_job_id UUID REFERENCES print_jobs(id) ON DELETE SET NULL,
  frame_storage_path TEXT,
  is_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  triggered_abort BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==========================================
-- MIGRATION: 004_module2_tables.sql
-- ==========================================
-- Create transit_batches table
CREATE TABLE transit_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  print_job_id UUID NOT NULL REFERENCES print_jobs(id) ON DELETE CASCADE UNIQUE,
  center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE RESTRICT,
  assigned_driver_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  qr_seal_payload TEXT NOT NULL,
  route_polyline TEXT NOT NULL,
  route_origin_lat DOUBLE PRECISION NOT NULL,
  route_origin_lng DOUBLE PRECISION NOT NULL,
  route_destination_lat DOUBLE PRECISION NOT NULL,
  route_destination_lng DOUBLE PRECISION NOT NULL,
  status transit_status_enum NOT NULL DEFAULT 'dispatched',
  compromised_reason TEXT,
  dispatched_at TIMESTAMPTZ NOT NULL,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create transit_checkpoints table
CREATE TABLE transit_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES transit_batches(id) ON DELETE CASCADE,
  checkpoint_index INTEGER NOT NULL,
  label TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  scanned_at TIMESTAMPTZ,
  scanned_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_transit_checkpoints UNIQUE (batch_id, checkpoint_index)
);

-- Create transit_pings table
CREATE TABLE transit_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES transit_batches(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy_meters DOUBLE PRECISION,
  deviation_meters DOUBLE PRECISION,
  geofence_status TEXT NOT NULL,
  pinged_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==========================================
-- MIGRATION: 005_module3_tables.sql
-- ==========================================
-- Create admit_cards table
CREATE TABLE admit_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE CASCADE,
  jwt_payload_hash TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_admit_cards UNIQUE (student_id, exam_id)
);

-- Create admit_card_scans table
CREATE TABLE admit_card_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admit_card_id UUID NOT NULL REFERENCES admit_cards(id) ON DELETE CASCADE,
  center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE CASCADE,
  scanned_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  is_valid BOOLEAN NOT NULL,
  failure_reason TEXT,
  scanned_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create batch_receptions table
CREATE TABLE batch_receptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES transit_batches(id) ON DELETE CASCADE UNIQUE,
  center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE CASCADE,
  received_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  paper_count_expected INTEGER NOT NULL,
  paper_count_received INTEGER NOT NULL,
  count_mismatch BOOLEAN NOT NULL GENERATED ALWAYS AS (paper_count_expected != paper_count_received) STORED,
  qr_seal_verified BOOLEAN NOT NULL DEFAULT FALSE,
  received_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==========================================
-- MIGRATION: 006_module4_tables.sql
-- ==========================================
-- Create omr_records table
CREATE TABLE omr_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE RESTRICT,
  center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE RESTRICT,
  sha256_hash TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  uploaded_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_omr_records UNIQUE (student_id, exam_id)
);

-- Create omr_verifications table
CREATE TABLE omr_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  omr_record_id UUID NOT NULL REFERENCES omr_records(id) ON DELETE CASCADE,
  recomputed_hash TEXT NOT NULL,
  is_match BOOLEAN NOT NULL,
  verified_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==========================================
-- MIGRATION: 007_module5_tables.sql
-- ==========================================
-- Create forensic_uploads table
CREATE TABLE forensic_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  original_filename TEXT,
  description TEXT,
  uploader_ip_hash TEXT,
  status forensic_job_status_enum NOT NULL DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create forensic_reports table
CREATE TABLE forensic_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id UUID NOT NULL REFERENCES forensic_uploads(id) ON DELETE CASCADE UNIQUE,
  tmc_decoded JSONB,
  primary_suspect_operator_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  primary_suspect_printer_id TEXT,
  primary_suspect_center_id UUID REFERENCES exam_centers(id) ON DELETE SET NULL,
  leaked_at TIMESTAMPTZ,
  custody_chain JSONB,
  confidence_score DOUBLE PRECISION,
  processing_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==========================================
-- MIGRATION: 008_audit_tables.sql
-- ==========================================
-- Create audit_logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ==========================================
-- MIGRATION: 009_indexes.sql
-- ==========================================
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


-- ==========================================
-- MIGRATION: 010_rls_policies.sql
-- ==========================================
-- Helper function to resolve the requesting user's role from their user profile
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role_enum AS $$
  SELECT role FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_center_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE watermark_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transit_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE transit_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE transit_pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE admit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE admit_card_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_receptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE omr_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE omr_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE forensic_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE forensic_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 1. user_profiles Policies
CREATE POLICY user_profiles_admin ON user_profiles FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY user_profiles_select_own ON user_profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- 2. exams Policies
CREATE POLICY exams_admin ON exams FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY exams_select ON exams FOR SELECT TO authenticated
  USING (true);

-- 3. exam_centers Policies
CREATE POLICY exam_centers_admin ON exam_centers FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY exam_centers_select ON exam_centers FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('print_operator', 'driver', 'supervisor'));

-- 4. papers Policies
CREATE POLICY papers_admin ON papers FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY papers_print_operator ON papers FOR SELECT TO authenticated
  USING (public.get_user_role() = 'print_operator' AND EXISTS (
    SELECT 1 FROM public.print_sessions ps 
    WHERE ps.paper_id = papers.id AND ps.is_active = TRUE AND ps.expires_at > NOW()
  ));

-- 5. key_shares Policies
CREATE POLICY key_shares_admin_select ON key_shares FOR SELECT TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY key_shares_admin_delete ON key_shares FOR DELETE TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY key_shares_authority ON key_shares FOR SELECT TO authenticated
  USING (public.get_user_role()::text = authority_role);

-- 6. print_sessions Policies
CREATE POLICY print_sessions_admin ON print_sessions FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY print_sessions_authority_insert ON print_sessions FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() IN ('authority_a', 'authority_b'));

CREATE POLICY print_sessions_operator_select ON print_sessions FOR SELECT TO authenticated
  USING (public.get_user_role() = 'print_operator' AND is_active = TRUE AND expires_at > NOW());

-- 7. print_jobs Policies
CREATE POLICY print_jobs_admin ON print_jobs FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY print_jobs_operator_insert ON print_jobs FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'print_operator' AND operator_id = auth.uid());

CREATE POLICY print_jobs_operator_select ON print_jobs FOR SELECT TO authenticated
  USING (public.get_user_role() = 'print_operator' AND operator_id = auth.uid());

-- 8. watermark_registry Policies
CREATE POLICY watermark_registry_admin_select ON watermark_registry FOR SELECT TO authenticated
  USING (public.get_user_role() = 'super_admin');

-- 9. vision_alerts Policies
CREATE POLICY vision_alerts_admin ON vision_alerts FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY vision_alerts_select ON vision_alerts FOR SELECT TO authenticated
  USING (public.get_user_role() IN ('print_operator', 'supervisor'));

-- 10. transit_batches Policies
CREATE POLICY transit_batches_admin ON transit_batches FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY transit_batches_driver_select ON transit_batches FOR SELECT TO authenticated
  USING (public.get_user_role() = 'driver' AND assigned_driver_id = auth.uid());

CREATE POLICY transit_batches_driver_update ON transit_batches FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'driver' AND assigned_driver_id = auth.uid());

CREATE POLICY transit_batches_supervisor_select ON transit_batches FOR SELECT TO authenticated
  USING (public.get_user_role() = 'supervisor');

-- 11. transit_checkpoints Policies
CREATE POLICY transit_checkpoints_admin ON transit_checkpoints FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY transit_checkpoints_driver_select ON transit_checkpoints FOR SELECT TO authenticated
  USING (public.get_user_role() = 'driver' AND EXISTS (
    SELECT 1 FROM public.transit_batches tb 
    WHERE tb.id = transit_checkpoints.batch_id AND tb.assigned_driver_id = auth.uid()
  ));

CREATE POLICY transit_checkpoints_driver_update ON transit_checkpoints FOR UPDATE TO authenticated
  USING (public.get_user_role() = 'driver' AND EXISTS (
    SELECT 1 FROM public.transit_batches tb 
    WHERE tb.id = transit_checkpoints.batch_id AND tb.assigned_driver_id = auth.uid()
  ));

CREATE POLICY transit_checkpoints_supervisor_select ON transit_checkpoints FOR SELECT TO authenticated
  USING (public.get_user_role() = 'supervisor');

-- 12. transit_pings Policies
CREATE POLICY transit_pings_admin ON transit_pings FOR SELECT TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY transit_pings_driver_insert ON transit_pings FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'driver' AND EXISTS (
    SELECT 1 FROM public.transit_batches tb 
    WHERE tb.id = transit_pings.batch_id AND tb.assigned_driver_id = auth.uid()
  ));

CREATE POLICY transit_pings_driver_select ON transit_pings FOR SELECT TO authenticated
  USING (public.get_user_role() = 'driver' AND EXISTS (
    SELECT 1 FROM public.transit_batches tb 
    WHERE tb.id = transit_pings.batch_id AND tb.assigned_driver_id = auth.uid()
  ));

-- 13. admit_cards Policies
CREATE POLICY admit_cards_admin ON admit_cards FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY admit_cards_supervisor_select ON admit_cards FOR SELECT TO authenticated
  USING (public.get_user_role() = 'supervisor' AND center_id = (
    SELECT assigned_location_id FROM public.user_profiles WHERE id = auth.uid()
  ));

-- 14. admit_card_scans Policies
CREATE POLICY admit_card_scans_admin ON admit_card_scans FOR SELECT TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY admit_card_scans_supervisor_insert ON admit_card_scans FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'supervisor');

CREATE POLICY admit_card_scans_supervisor_select ON admit_card_scans FOR SELECT TO authenticated
  USING (public.get_user_role() = 'supervisor');

-- 15. batch_receptions Policies
CREATE POLICY batch_receptions_admin ON batch_receptions FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY batch_receptions_supervisor_insert ON batch_receptions FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'supervisor');

CREATE POLICY batch_receptions_supervisor_select ON batch_receptions FOR SELECT TO authenticated
  USING (public.get_user_role() = 'supervisor');

-- 16. omr_records Policies
CREATE POLICY omr_records_admin ON omr_records FOR SELECT TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY omr_records_supervisor_insert ON omr_records FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role() = 'supervisor');

-- 17. omr_verifications Policies
CREATE POLICY omr_verifications_admin ON omr_verifications FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

-- 18. forensic_uploads Policies
CREATE POLICY forensic_uploads_admin ON forensic_uploads FOR SELECT TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY forensic_uploads_public_insert ON forensic_uploads FOR INSERT TO public
  WITH CHECK (TRUE);

-- 19. forensic_reports Policies
CREATE POLICY forensic_reports_admin ON forensic_reports FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

CREATE POLICY forensic_reports_public_select ON forensic_reports FOR SELECT TO public
  USING (TRUE);

-- 20. audit_logs Policies
CREATE POLICY audit_logs_admin ON audit_logs FOR SELECT TO authenticated
  USING (public.get_user_role() = 'super_admin');


-- ==========================================
-- MIGRATION: 011_vault_view_tokens.sql
-- ==========================================
-- Create vault_view_tokens table for replay-attack protection
CREATE TABLE vault_view_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient token verification
CREATE INDEX idx_vault_view_tokens_lookup ON vault_view_tokens(token, is_used, expires_at);

-- Enable Row-Level Security (RLS)
ALTER TABLE vault_view_tokens ENABLE ROW LEVEL SECURITY;

-- super_admin: ALL permissions
CREATE POLICY vault_view_tokens_admin ON vault_view_tokens FOR ALL TO authenticated
  USING (public.get_user_role() = 'super_admin');

-- print_operator: SELECT active, unused tokens
CREATE POLICY vault_view_tokens_operator ON vault_view_tokens FOR SELECT TO authenticated
  USING (public.get_user_role() = 'print_operator' AND is_used = FALSE AND expires_at > NOW());


