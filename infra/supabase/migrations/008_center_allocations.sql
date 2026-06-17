-- Create center_allocations table
CREATE TABLE IF NOT EXISTS center_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL UNIQUE REFERENCES exam_registrations(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    allocated_center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE CASCADE,
    preference_rank_matched INTEGER NOT NULL,
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    allocated_by UUID NOT NULL REFERENCES agency_staff(id) ON DELETE RESTRICT
);

-- Enable Row Level Security
ALTER TABLE center_allocations ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow students to read their own center allocation
CREATE POLICY "Allow students to view their own allocation"
    ON center_allocations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM students WHERE students.id = center_allocations.student_id AND students.user_id = auth.uid()
        )
    );

-- Allow agency staff of the owning agency to manage center allocations
CREATE POLICY "Allow agency staff to manage center allocations"
    ON center_allocations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM exams AS e
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE e.id = center_allocations.exam_id AND s.user_id = auth.uid() AND s.is_active = true
        )
    );
