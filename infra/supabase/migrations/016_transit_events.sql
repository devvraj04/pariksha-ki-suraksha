-- Create transit_events table
CREATE TABLE IF NOT EXISTS transit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trunk_id UUID NOT NULL REFERENCES transit_trunks(id) ON DELETE CASCADE,
    latitude NUMERIC(10,7) NOT NULL,
    longitude NUMERIC(10,7) NOT NULL,
    speed_kmh NUMERIC(6,2) NULL,
    is_on_route BOOLEAN NOT NULL DEFAULT true,
    recorded_at TIMESTAMPTZ NOT NULL
);

-- Enable Row Level Security
ALTER TABLE transit_events ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow agency staff of the owning agency to read transit events
CREATE POLICY "Allow agency staff to read transit events"
    ON transit_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM transit_trunks AS t
            JOIN exam_centers AS c ON c.id = t.center_id
            JOIN agency_staff AS s ON s.agency_id = c.agency_id
            WHERE t.id = transit_events.trunk_id AND s.user_id = auth.uid() AND s.is_active = true
        )
    );
