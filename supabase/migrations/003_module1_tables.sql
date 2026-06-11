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
