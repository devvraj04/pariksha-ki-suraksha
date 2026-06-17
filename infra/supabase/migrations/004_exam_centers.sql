-- Create exam_centers table
CREATE TABLE IF NOT EXISTS exam_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    latitude NUMERIC(10,7) NOT NULL,
    longitude NUMERIC(10,7) NOT NULL,
    geofence_radius_meters INTEGER NOT NULL DEFAULT 100,
    center_code TEXT NOT NULL,
    total_capacity INTEGER NOT NULL,
    center_officer_id UUID NULL REFERENCES agency_staff(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (exam_id, center_code)
);

-- Enable Row Level Security
ALTER TABLE exam_centers ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow anyone to view details of active exam centers (needed for student preference selection)
CREATE POLICY "Allow public read access to active exam centers"
    ON exam_centers
    FOR SELECT
    USING (is_active = true);

-- Allow agency staff of the owning agency to manage exam centers
CREATE POLICY "Allow agency staff to manage their exam centers"
    ON exam_centers
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM agency_staff AS s 
            WHERE s.user_id = auth.uid() AND s.agency_id = exam_centers.agency_id AND s.is_active = true
        )
    );
