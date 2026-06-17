-- Create surveillance_alerts table
CREATE TABLE IF NOT EXISTS surveillance_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE CASCADE,
    room_id UUID NULL REFERENCES exam_rooms(id) ON DELETE CASCADE,
    camera_id TEXT NOT NULL,
    alert_type TEXT NOT NULL CHECK (alert_type IN ('MOBILE_PHONE_DETECTED', 'EARPIECE_DETECTED', 'MASS_HEAD_TURNING', 'UNAUTHORIZED_PERSON', 'SUSPICIOUS_OBJECT')),
    confidence_score NUMERIC(5,4) NOT NULL,
    snapshot_path TEXT NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by UUID REFERENCES agency_staff(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NULL,
    review_outcome TEXT NULL CHECK (review_outcome IN ('DISMISSED', 'ESCALATED', 'ACTION_TAKEN'))
);

-- Enable Row Level Security
ALTER TABLE surveillance_alerts ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow agency staff of the owning agency to view alerts
CREATE POLICY "Allow agency staff to view surveillance alerts"
    ON surveillance_alerts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM exams AS e
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE e.id = surveillance_alerts.exam_id AND s.user_id = auth.uid() AND s.is_active = true
        )
    );

-- Allow managers/heads to review/modify alerts
CREATE POLICY "Allow authorized staff to review surveillance alerts"
    ON surveillance_alerts
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM exams AS e
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE e.id = surveillance_alerts.exam_id AND s.user_id = auth.uid() AND s.is_active = true
            AND s.role IN ('agency_head', 'manager')
        )
    );
