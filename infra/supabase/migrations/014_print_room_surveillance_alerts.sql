-- Create print_room_surveillance_alerts table
CREATE TABLE IF NOT EXISTS print_room_surveillance_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    print_job_id UUID NOT NULL REFERENCES print_jobs(id) ON DELETE CASCADE,
    camera_id TEXT NOT NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('MOBILE_PHONE_DETECTED', 'UNAUTHORIZED_PERSON', 'EXTRA_PAGES_TAKEN', 'ANOMALOUS_BEHAVIOR')),
    confidence_score NUMERIC(5,4) NOT NULL,
    snapshot_path TEXT NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by UUID REFERENCES agency_staff(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NULL,
    review_outcome TEXT NULL CHECK (review_outcome IN ('DISMISSED', 'ESCALATED', 'ACTION_TAKEN'))
);

-- Enable Row Level Security
ALTER TABLE print_room_surveillance_alerts ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow agency staff of the owning agency to view alerts
CREATE POLICY "Allow agency staff to read print room alerts"
    ON print_room_surveillance_alerts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM print_jobs AS p
            JOIN exams AS e ON e.id = p.exam_id
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE p.id = print_room_surveillance_alerts.print_job_id AND s.user_id = auth.uid() AND s.is_active = true
        )
    );

-- Allow managers to review/modify alerts
CREATE POLICY "Allow managers to update print room alerts"
    ON print_room_surveillance_alerts
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM print_jobs AS p
            JOIN exams AS e ON e.id = p.exam_id
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE p.id = print_room_surveillance_alerts.print_job_id AND s.user_id = auth.uid() AND s.is_active = true
            AND s.role IN ('agency_head', 'manager')
        )
    );
