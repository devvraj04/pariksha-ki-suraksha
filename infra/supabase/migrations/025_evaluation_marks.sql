-- Create evaluation_marks table
CREATE TABLE IF NOT EXISTS evaluation_marks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL REFERENCES answer_sheet_uploads(id) ON DELETE CASCADE,
    center_uid UUID NOT NULL REFERENCES exam_centers(id) ON DELETE CASCADE,
    evaluator_id UUID NOT NULL REFERENCES agency_staff(id) ON DELETE RESTRICT,
    assignment_id UUID NOT NULL REFERENCES evaluator_assignments(id) ON DELETE CASCADE,
    evaluation_tier INTEGER NOT NULL CHECK (evaluation_tier IN (1, 2, 3)),
    marks_awarded NUMERIC(7,2) NOT NULL,
    max_marks NUMERIC(7,2) NOT NULL,
    subject_breakdown JSONB NULL,
    remarks TEXT NULL,
    evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE evaluation_marks ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow evaluators to see marks they entered if their assignment is not locked/revoked
CREATE POLICY "Allow evaluators to read their active marks submissions"
    ON evaluation_marks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM evaluator_assignments AS a
            JOIN agency_staff AS s ON s.id = a.evaluator_id
            WHERE a.id = evaluation_marks.assignment_id AND s.user_id = auth.uid()
            AND a.access_revoked_at IS NULL
        )
    );

-- Allow agency staff (heads/managers) of the owning agency to view evaluation marks
CREATE POLICY "Allow agency staff to read evaluation marks"
    ON evaluation_marks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM exams AS e
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE e.id = evaluation_marks.exam_id AND s.user_id = auth.uid() AND s.is_active = true
            AND s.role IN ('agency_head', 'manager', 'chief_moderator')
        )
    );

-- Allow evaluators to insert marks
CREATE POLICY "Allow evaluators to submit marks"
    ON evaluation_marks
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM evaluator_assignments AS a
            JOIN agency_staff AS s ON s.id = a.evaluator_id
            WHERE a.id = evaluation_marks.assignment_id AND s.user_id = auth.uid()
            AND a.status IN ('PENDING', 'IN_PROGRESS')
            AND a.access_revoked_at IS NULL
        )
    );
