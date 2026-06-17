-- Create paper_vault_access_logs table
CREATE TABLE IF NOT EXISTS paper_vault_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES question_papers(id) ON DELETE CASCADE,
    accessed_by UUID NOT NULL REFERENCES agency_staff(id) ON DELETE RESTRICT,
    access_type TEXT NOT NULL CHECK (access_type IN ('UPLOAD', 'VIEW_ENCRYPTED', 'DECRYPT_FOR_PRINT', 'DECRYPT_FOR_CBT', 'ADMIN_REVIEW')),
    ip_address TEXT NOT NULL,
    device_fingerprint TEXT NULL,
    webcam_snapshot_path TEXT NULL,
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT NULL
);

-- Enable Row Level Security
ALTER TABLE paper_vault_access_logs ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Only agency heads can read vault access logs
CREATE POLICY "Allow agency heads to read vault access logs"
    ON paper_vault_access_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM question_papers AS q
            JOIN exams AS e ON e.id = q.exam_id
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE q.id = paper_vault_access_logs.paper_id AND s.user_id = auth.uid() AND s.is_active = true
            AND s.role = 'agency_head'
        )
    );

-- Allow insertion for service-role and authorized staff
CREATE POLICY "Allow insertions of vault access logs"
    ON paper_vault_access_logs
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM question_papers AS q
            JOIN exams AS e ON e.id = q.exam_id
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE q.id = paper_vault_access_logs.paper_id AND s.user_id = auth.uid() AND s.is_active = true
        )
    );
