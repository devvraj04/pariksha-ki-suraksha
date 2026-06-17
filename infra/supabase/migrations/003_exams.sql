-- Create exams table
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES agency_staff(id),
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    mode TEXT NOT NULL CHECK (mode IN ('ONLINE', 'OFFLINE')),
    exam_date DATE NOT NULL,
    start_time TIMETZ NOT NULL,
    duration_minutes INTEGER NOT NULL,
    fee_inr NUMERIC(10,2) NOT NULL,
    total_seats INTEGER NOT NULL,
    eligibility_criteria JSONB NOT NULL,
    syllabus TEXT NULL,
    syllabus_pdf_path TEXT NULL,
    brochure_pdf_path TEXT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ADMIT_CARDS_ISSUED', 'ONGOING', 'PAPER_UPLOAD_PENDING', 'EVALUATION_IN_PROGRESS', 'RESULT_DECLARED')),
    registration_open_at TIMESTAMPTZ NULL,
    registration_close_at TIMESTAMPTZ NULL,
    visibility_score_threshold NUMERIC(3,1) NOT NULL DEFAULT 8.0,
    evaluation_approved_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow public read access to published exams
CREATE POLICY "Allow public read access to published exams"
    ON exams
    FOR SELECT
    USING (status NOT IN ('DRAFT'));

-- Allow agency staff of the owning agency to read/write exams
CREATE POLICY "Allow agency staff to manage their exams"
    ON exams
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM agency_staff AS s 
            WHERE s.user_id = auth.uid() AND s.agency_id = exams.agency_id AND s.is_active = true
        )
    );
