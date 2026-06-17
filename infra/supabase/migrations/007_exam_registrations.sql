-- Create exam_registrations table
CREATE TABLE IF NOT EXISTS exam_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    application_number TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK (status IN ('PENDING_PAYMENT', 'REGISTERED', 'CANCELLED', 'CHECKED_IN', 'APPEARED', 'ABSENT')),
    payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')),
    payment_transaction_id TEXT NULL,
    payment_amount_inr NUMERIC(10,2) NULL,
    payment_at TIMESTAMPTZ NULL,
    center_preference_1 UUID NULL REFERENCES exam_centers(id) ON DELETE SET NULL,
    center_preference_2 UUID NULL REFERENCES exam_centers(id) ON DELETE SET NULL,
    center_preference_3 UUID NULL REFERENCES exam_centers(id) ON DELETE SET NULL,
    registered_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE exam_registrations ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow students to read/write their own registrations
CREATE POLICY "Allow students to view their own registrations"
    ON exam_registrations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM students WHERE students.id = exam_registrations.student_id AND students.user_id = auth.uid()
        )
    );

-- Allow agency staff of the owning agency to view registrations
CREATE POLICY "Allow agency staff to view registrations"
    ON exam_registrations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM exams AS e
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE e.id = exam_registrations.exam_id AND s.user_id = auth.uid() AND s.is_active = true
        )
    );
