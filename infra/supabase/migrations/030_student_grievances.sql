-- Create student_grievances table
CREATE TABLE IF NOT EXISTS student_grievances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    registration_id UUID NOT NULL REFERENCES exam_registrations(id) ON DELETE CASCADE,
    category TEXT NOT NULL CHECK (category IN ('ANSWER_KEY_DISPUTE', 'QUESTION_PAPER_ERROR', 'CENTER_MISCONDUCT', 'PEER_CHEATING', 'CBT_TECHNICAL_ISSUE', 'MISPRINTED_PAPER', 'UNFAIR_EVALUATION', 'OTHER')),
    description TEXT NOT NULL,
    evidence_paths TEXT[] NULL,
    priority TEXT NOT NULL DEFAULT 'HIGH' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED')),
    auto_cctv_attached BOOLEAN NOT NULL DEFAULT false,
    assigned_to UUID REFERENCES agency_staff(id) ON DELETE SET NULL,
    resolution_notes TEXT NULL,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ NULL
);

-- Enable Row Level Security
ALTER TABLE student_grievances ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow students to read/write their own grievances
CREATE POLICY "Allow students to view their own grievances"
    ON student_grievances
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM students WHERE students.id = student_grievances.student_id AND students.user_id = auth.uid()
        )
    );

CREATE POLICY "Allow students to insert their own grievances"
    ON student_grievances
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM students WHERE students.id = student_grievances.student_id AND students.user_id = auth.uid()
        )
    );

-- Allow agency staff of the owning agency to manage grievances
CREATE POLICY "Allow agency staff to read and resolve grievances"
    ON student_grievances
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM exams AS e
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE e.id = student_grievances.exam_id AND s.user_id = auth.uid() AND s.is_active = true
        )
    );
