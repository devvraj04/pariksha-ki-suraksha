-- Create evaluation_discrepancies table
CREATE TABLE IF NOT EXISTS evaluation_discrepancies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL REFERENCES answer_sheet_uploads(id) ON DELETE CASCADE,
    tier1_marks_id UUID NOT NULL REFERENCES evaluation_marks(id) ON DELETE CASCADE,
    tier2_marks_id UUID NOT NULL REFERENCES evaluation_marks(id) ON DELETE CASCADE,
    marks_difference NUMERIC(7,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED')),
    resolved_by UUID REFERENCES agency_staff(id) ON DELETE SET NULL,
    final_marks_id UUID REFERENCES evaluation_marks(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ NULL
);

-- Enable Row Level Security
ALTER TABLE evaluation_discrepancies ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow agency staff (heads, managers, chief moderators) of the owning agency to read discrepancies
CREATE POLICY "Allow agency staff to read discrepancies"
    ON evaluation_discrepancies
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM exams AS e
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE e.id = evaluation_discrepancies.exam_id AND s.user_id = auth.uid() AND s.is_active = true
            AND s.role IN ('agency_head', 'manager', 'chief_moderator')
        )
    );

-- Allow chief moderators and managers to resolve discrepancies
CREATE POLICY "Allow authorized staff to resolve discrepancies"
    ON evaluation_discrepancies
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM exams AS e
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE e.id = evaluation_discrepancies.exam_id AND s.user_id = auth.uid() AND s.is_active = true
            AND s.role IN ('agency_head', 'chief_moderator')
        )
    );
