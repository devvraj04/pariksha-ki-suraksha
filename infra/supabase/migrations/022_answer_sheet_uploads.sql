-- Create answer_sheet_uploads table
CREATE TABLE IF NOT EXISTS answer_sheet_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    registration_id UUID NOT NULL REFERENCES exam_registrations(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES agency_staff(id) ON DELETE RESTRICT,
    encrypted_pdf_path TEXT NOT NULL,
    total_pages INTEGER NOT NULL,
    upload_status TEXT NOT NULL DEFAULT 'UPLOADED' CHECK (upload_status IN ('UPLOADED', 'SCORING', 'APPROVED', 'RESCAN_REQUIRED', 'SEALED')),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE answer_sheet_uploads ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow agency staff of the owning agency to view uploads
CREATE POLICY "Allow agency staff to read answer sheet uploads"
    ON answer_sheet_uploads
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM exams AS e
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE e.id = answer_sheet_uploads.exam_id AND s.user_id = auth.uid() AND s.is_active = true
        )
    );

-- Allow center officers and staff to upload and modify answer sheets
CREATE POLICY "Allow authorized staff to manage answer sheet uploads"
    ON answer_sheet_uploads
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM exams AS e
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE e.id = answer_sheet_uploads.exam_id AND s.user_id = auth.uid() AND s.is_active = true
            AND s.role IN ('agency_head', 'manager', 'center_officer', 'operator')
        )
    );
