-- Create evaluator_assignments table
CREATE TABLE IF NOT EXISTS evaluator_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    evaluator_id UUID NOT NULL REFERENCES agency_staff(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('grading_teacher', 'moderator', 'chief_moderator')),
    batch_code TEXT NOT NULL,
    upload_ids UUID[] NOT NULL,
    assigned_by UUID NOT NULL REFERENCES agency_staff(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'LOCKED')),
    completed_at TIMESTAMPTZ NULL,
    access_revoked_at TIMESTAMPTZ NULL
);

-- Enable Row Level Security
ALTER TABLE evaluator_assignments ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow evaluators to see their own assignments
CREATE POLICY "Allow evaluators to see their own assignments"
    ON evaluator_assignments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM agency_staff WHERE agency_staff.id = evaluator_assignments.evaluator_id AND agency_staff.user_id = auth.uid()
        )
    );

-- Allow agency staff of the owning agency to view/manage assignments
CREATE POLICY "Allow agency staff to manage evaluator assignments"
    ON evaluator_assignments
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM exams AS e
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE e.id = evaluator_assignments.exam_id AND s.user_id = auth.uid() AND s.is_active = true
            AND s.role IN ('agency_head', 'manager')
        )
    );
