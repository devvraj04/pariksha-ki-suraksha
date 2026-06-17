-- Create exam_results table
CREATE TABLE IF NOT EXISTS exam_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    registration_id UUID NOT NULL REFERENCES exam_registrations(id) ON DELETE CASCADE,
    final_marks NUMERIC(7,2) NOT NULL,
    max_marks NUMERIC(7,2) NOT NULL,
    percentage NUMERIC(5,2) NOT NULL,
    rank INTEGER NULL,
    category_rank INTEGER NULL,
    result_status TEXT NOT NULL CHECK (result_status IN ('PASS', 'FAIL', 'ABSENT', 'WITHHELD')),
    subject_breakdown JSONB NULL,
    result_pdf_path TEXT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_by UUID NOT NULL REFERENCES agency_staff(id) ON DELETE RESTRICT
);

-- Enable Row Level Security
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow students to read their own results
CREATE POLICY "Allow students to view their own results"
    ON exam_results
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM students WHERE students.id = exam_results.student_id AND students.user_id = auth.uid()
        )
    );

-- Allow agency staff of the owning agency to view results
CREATE POLICY "Allow agency staff to read exam results"
    ON exam_results
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM exams AS e
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE e.id = exam_results.exam_id AND s.user_id = auth.uid() AND s.is_active = true
        )
    );
