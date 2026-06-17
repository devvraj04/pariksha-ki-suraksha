-- Create admit_cards table
CREATE TABLE IF NOT EXISTS admit_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id UUID NOT NULL UNIQUE REFERENCES exam_registrations(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE CASCADE,
    qr_payload_jwt TEXT NOT NULL,
    qr_biometric_hash TEXT NOT NULL,
    pdf_path TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_valid BOOLEAN NOT NULL DEFAULT true
);

-- Enable Row Level Security
ALTER TABLE admit_cards ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow students to read their own admit cards
CREATE POLICY "Allow students to view their own admit card"
    ON admit_cards
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM students WHERE students.id = admit_cards.student_id AND students.user_id = auth.uid()
        )
    );

-- Allow agency staff of the owning agency to view admit cards
CREATE POLICY "Allow agency staff to view admit cards"
    ON admit_cards
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM exams AS e
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE e.id = admit_cards.exam_id AND s.user_id = auth.uid() AND s.is_active = true
        )
    );
