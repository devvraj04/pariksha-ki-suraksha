-- Create question_papers table
CREATE TABLE IF NOT EXISTS question_papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES agency_staff(id) ON DELETE RESTRICT,
    encrypted_storage_path TEXT NOT NULL,
    key_share_1_vault_ref TEXT NOT NULL,
    key_share_2_hsm_ref TEXT NOT NULL,
    encryption_algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
    paper_version INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'VAULTED' CHECK (status IN ('VAULTED', 'DECRYPTED_FOR_PRINT', 'DECRYPTED_FOR_CBT', 'ARCHIVED')),
    paper_type TEXT NOT NULL DEFAULT 'QUESTION_PAPER' CHECK (paper_type IN ('QUESTION_PAPER', 'ANSWER_KEY')),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    upload_session_recording_path TEXT NULL
);

-- Enable Row Level Security
ALTER TABLE question_papers ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Only agency head, manager, and operator can read metadata of papers, never the key references or files directly
CREATE POLICY "Allow agency staff to read paper metadata"
    ON question_papers
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM exams AS e
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE e.id = question_papers.exam_id AND s.user_id = auth.uid() AND s.is_active = true
            AND s.role IN ('agency_head', 'manager', 'operator')
        )
    );

-- Only agency head or manager can create/modify paper records
CREATE POLICY "Allow agency head and managers to manage papers"
    ON question_papers
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM exams AS e
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE e.id = question_papers.exam_id AND s.user_id = auth.uid() AND s.is_active = true
            AND s.role IN ('agency_head', 'manager')
        )
    );
