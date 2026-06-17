-- Create print_watermark_registry table
CREATE TABLE IF NOT EXISTS print_watermark_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    print_job_id UUID NOT NULL REFERENCES print_jobs(id) ON DELETE CASCADE,
    center_code TEXT NOT NULL,
    printer_id TEXT NOT NULL,
    operator_id UUID NOT NULL REFERENCES agency_staff(id) ON DELETE RESTRICT,
    page_number INTEGER NOT NULL,
    copy_number INTEGER NOT NULL,
    watermark_code TEXT NOT NULL UNIQUE,
    printed_at TIMESTAMPTZ NOT NULL
);

-- Enable Row Level Security
ALTER TABLE print_watermark_registry ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow agency staff of the owning agency to view print watermark records
CREATE POLICY "Allow agency staff to read print watermark registry"
    ON print_watermark_registry
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM print_jobs AS p
            JOIN exams AS e ON e.id = p.exam_id
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE p.id = print_watermark_registry.print_job_id AND s.user_id = auth.uid() AND s.is_active = true
            AND s.role IN ('agency_head', 'manager')
        )
    );
