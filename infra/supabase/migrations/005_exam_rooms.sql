-- Create exam_rooms table
CREATE TABLE IF NOT EXISTS exam_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    room_code TEXT NOT NULL,
    seating_capacity INTEGER NOT NULL,
    current_occupancy INTEGER NOT NULL DEFAULT 0,
    camera_stream_url TEXT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE exam_rooms ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow agency staff of the owning agency to manage exam rooms
CREATE POLICY "Allow agency staff to manage their exam rooms"
    ON exam_rooms
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM exam_centers AS c
            JOIN agency_staff AS s ON s.agency_id = c.agency_id
            WHERE c.id = exam_rooms.center_id AND s.user_id = auth.uid() AND s.is_active = true
        )
    );

-- Function to atomically increment room occupancy
CREATE OR REPLACE FUNCTION increment_room_occupancy(p_room_id UUID)
RETURNS VOID AS $$
DECLARE
    v_updated_rows INT;
BEGIN
    UPDATE exam_rooms
    SET current_occupancy = current_occupancy + 1
    WHERE id = p_room_id AND current_occupancy < seating_capacity;
    
    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    
    IF v_updated_rows = 0 THEN
        RAISE EXCEPTION 'ROOM_FULL: Room capacity exceeded or room not found';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
