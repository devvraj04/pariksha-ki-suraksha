-- Create print_jobs table
CREATE TABLE IF NOT EXISTS print_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES question_papers(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE CASCADE,
    initiated_by UUID NOT NULL REFERENCES agency_staff(id) ON DELETE RESTRICT,
    printer_id TEXT NOT NULL,
    copies_requested INTEGER NOT NULL,
    copies_budget INTEGER NOT NULL,
    copies_approved INTEGER NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'PRINTING', 'COMPLETED', 'BLOCKED_OVER_BUDGET', 'BLOCKED_ANOMALOUS_TIME')),
    print_started_at TIMESTAMPTZ NULL,
    print_completed_at TIMESTAMPTZ NULL,
    block_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow agency staff of the owning agency to view print jobs
CREATE POLICY "Allow agency staff to read print jobs"
    ON print_jobs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM exams AS e
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE e.id = print_jobs.exam_id AND s.user_id = auth.uid() AND s.is_active = true
        )
    );

-- Allow operators and managers of the owning agency to manage print jobs
CREATE POLICY "Allow authorized staff to manage print jobs"
    ON print_jobs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM exams AS e
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE e.id = print_jobs.exam_id AND s.user_id = auth.uid() AND s.is_active = true
            AND s.role IN ('agency_head', 'manager', 'operator')
        )
    );
