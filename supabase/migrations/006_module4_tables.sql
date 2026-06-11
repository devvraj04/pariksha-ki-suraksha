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
