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
