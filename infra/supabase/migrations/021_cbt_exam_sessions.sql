-- Create cbt_exam_sessions table
CREATE TABLE IF NOT EXISTS cbt_exam_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL REFERENCES exam_registrations(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'ACTIVE', 'SUBMITTED', 'TIMED_OUT', 'FLAGGED')),
    decrypted_at TIMESTAMPTZ NULL,
    started_at TIMESTAMPTZ NULL,
    submitted_at TIMESTAMPTZ NULL,
    tab_switch_count INTEGER NOT NULL DEFAULT 0,
    suspicious_typing_flags INTEGER NOT NULL DEFAULT 0,
    responses_encrypted_path TEXT NULL
);

-- Enable Row Level Security
ALTER TABLE cbt_exam_sessions ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow students to read/update their own exam sessions
CREATE POLICY "Allow students to manage their own CBT sessions"
    ON cbt_exam_sessions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM students WHERE students.id = cbt_exam_sessions.student_id AND students.user_id = auth.uid()
        )
    );

-- Allow agency staff of the owning agency to view CBT sessions
CREATE POLICY "Allow agency staff to read CBT sessions"
    ON cbt_exam_sessions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM exams AS e
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE e.id = cbt_exam_sessions.exam_id AND s.user_id = auth.uid() AND s.is_active = true
        )
    );
