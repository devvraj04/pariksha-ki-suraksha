-- Create transit_geofence_violations table
CREATE TABLE IF NOT EXISTS transit_geofence_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trunk_id UUID NOT NULL REFERENCES transit_trunks(id) ON DELETE CASCADE,
    violation_latitude NUMERIC(10,7) NOT NULL,
    violation_longitude NUMERIC(10,7) NOT NULL,
    deviation_meters INTEGER NOT NULL,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    alerted_to UUID NOT NULL REFERENCES agency_staff(id) ON DELETE RESTRICT,
    resolution TEXT NULL,
    resolved_at TIMESTAMPTZ NULL
);

-- Enable Row Level Security
ALTER TABLE transit_geofence_violations ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow agency staff of the owning agency to view geofence violations
CREATE POLICY "Allow agency staff to read geofence violations"
    ON transit_geofence_violations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM transit_trunks AS t
            JOIN exam_centers AS c ON c.id = t.center_id
            JOIN agency_staff AS s ON s.agency_id = c.agency_id
            WHERE t.id = transit_geofence_violations.trunk_id AND s.user_id = auth.uid() AND s.is_active = true
        )
    );

-- Allow managers to update violation resolution
CREATE POLICY "Allow managers to update geofence violations"
    ON transit_geofence_violations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM transit_trunks AS t
            JOIN exam_centers AS c ON c.id = t.center_id
            JOIN agency_staff AS s ON s.agency_id = c.agency_id
            WHERE t.id = transit_geofence_violations.trunk_id AND s.user_id = auth.uid() AND s.is_active = true
            AND s.role IN ('agency_head', 'manager')
        )
    );
