-- Create transit_trunks table
CREATE TABLE IF NOT EXISTS transit_trunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trunk_code TEXT NOT NULL UNIQUE,
    print_job_id UUID NOT NULL REFERENCES print_jobs(id) ON DELETE CASCADE,
    center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE CASCADE,
    assigned_transit_manager_id UUID NOT NULL REFERENCES agency_staff(id) ON DELETE RESTRICT,
    device_imei TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'SEALED' CHECK (status IN ('SEALED', 'IN_TRANSIT', 'DELIVERED', 'COMPROMISED', 'UNLOCKED')),
    sealed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    dispatched_at TIMESTAMPTZ NULL,
    delivered_at TIMESTAMPTZ NULL,
    unlock_otp_sent_at TIMESTAMPTZ NULL,
    unlocked_at TIMESTAMPTZ NULL,
    unlocked_by UUID REFERENCES agency_staff(id) ON DELETE SET NULL,
    unlock_gps_latitude NUMERIC(10,7) NULL,
    unlock_gps_longitude NUMERIC(10,7) NULL
);

-- Enable Row Level Security
ALTER TABLE transit_trunks ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow agency staff of the owning agency to read trunks
CREATE POLICY "Allow agency staff to read transit trunks"
    ON transit_trunks
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM exam_centers AS c
            JOIN agency_staff AS s ON s.agency_id = c.agency_id
            WHERE c.id = transit_trunks.center_id AND s.user_id = auth.uid() AND s.is_active = true
        )
    );

-- Allow transit managers and center officers to update status/unlock details
CREATE POLICY "Allow staff to update transit trunks"
    ON transit_trunks
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM exam_centers AS c
            JOIN agency_staff AS s ON s.agency_id = c.agency_id
            WHERE c.id = transit_trunks.center_id AND s.user_id = auth.uid() AND s.is_active = true
            AND s.role IN ('agency_head', 'manager', 'transit_manager', 'center_officer')
        )
    );
