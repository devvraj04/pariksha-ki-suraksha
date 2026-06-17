-- Create checkin_events table
CREATE TABLE IF NOT EXISTS checkin_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL UNIQUE REFERENCES exam_registrations(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE CASCADE,
    qr_scan_result TEXT NOT NULL CHECK (qr_scan_result IN ('VALID', 'INVALID_SIGNATURE', 'WRONG_CENTER', 'EXPIRED')),
    biometric_match_score NUMERIC(5,4) NULL,
    biometric_match_result TEXT NOT NULL CHECK (biometric_match_result IN ('MATCHED', 'FAILED', 'SKIPPED')),
    biometric_photo_path TEXT NULL,
    checked_in_by UUID NOT NULL REFERENCES agency_staff(id) ON DELETE RESTRICT,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    is_flagged BOOLEAN NOT NULL DEFAULT false,
    flag_reason TEXT NULL
);

-- Enable Row Level Security
ALTER TABLE checkin_events ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow students to read their own checkin events
CREATE POLICY "Allow students to read their own checkin events"
    ON checkin_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM students WHERE students.id = checkin_events.student_id AND students.user_id = auth.uid()
        )
    );

-- Allow agency staff of the owning agency to manage checkin events
CREATE POLICY "Allow agency staff to manage checkin events"
    ON checkin_events
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM exams AS e
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE e.id = checkin_events.exam_id AND s.user_id = auth.uid() AND s.is_active = true
        )
    );
