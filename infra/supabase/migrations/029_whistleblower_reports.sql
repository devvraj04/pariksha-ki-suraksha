-- Create whistleblower_reports table
CREATE TABLE IF NOT EXISTS whistleblower_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
    category TEXT NOT NULL CHECK (category IN ('PAPER_LEAK', 'BRIBERY', 'IMPERSONATION', 'INVIGILATOR_MISCONDUCT', 'OTHER')),
    description TEXT NOT NULL,
    evidence_paths TEXT[] NULL,
    location_text TEXT NULL,
    ai_risk_score INTEGER NULL CHECK (ai_risk_score >= 0 AND ai_risk_score <= 100),
    routing_status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (routing_status IN ('RECEIVED', 'AI_SCORED', 'ROUTED_TO_AUDIT', 'CLOSED')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE whistleblower_reports ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Only platform admins and authorized agency staff can view whistleblower reports
CREATE POLICY "Allow platform admins and agency staff to read whistleblower reports"
    ON whistleblower_reports
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

-- Allow public to submit whistleblower reports anonymously
CREATE POLICY "Allow anonymous submission of whistleblower reports"
    ON whistleblower_reports
    FOR INSERT
    WITH CHECK (true);
