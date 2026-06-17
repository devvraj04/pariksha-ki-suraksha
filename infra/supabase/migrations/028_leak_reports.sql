-- Create leak_reports table
CREATE TABLE IF NOT EXISTS leak_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
    reported_by UUID REFERENCES agency_staff(id) ON DELETE SET NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('INTERNAL', 'WHISTLEBLOWER', 'PUBLIC_MEDIA')),
    uploaded_image_path TEXT NOT NULL,
    watermark_extracted TEXT NULL,
    extracted_center_code TEXT NULL,
    extracted_printer_id TEXT NULL,
    extracted_operator_id UUID REFERENCES agency_staff(id) ON DELETE SET NULL,
    extracted_timestamp TIMESTAMPTZ NULL,
    probability_report JSONB NULL,
    investigation_status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (investigation_status IN ('RECEIVED', 'PROCESSING', 'REPORT_GENERATED', 'CLOSED')),
    reported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE leak_reports ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow agency heads and managers of the owning agency (or any agency if general leak) to view leak reports
CREATE POLICY "Allow agency staff to read leak reports"
    ON leak_reports
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM platform_admins WHERE user_id = auth.uid()
        ) OR EXISTS (
            SELECT 1 FROM agency_staff AS s
            WHERE s.user_id = auth.uid() AND s.is_active = true
            AND s.role IN ('agency_head', 'manager')
        )
    );

-- Allow public / whistleblowers to submit leak reports
CREATE POLICY "Allow anyone to submit leak reports"
    ON leak_reports
    FOR INSERT
    WITH CHECK (true);
