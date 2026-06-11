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
