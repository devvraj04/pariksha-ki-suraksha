-- Create room_allocations table
CREATE TABLE IF NOT EXISTS room_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checkin_event_id UUID NOT NULL UNIQUE REFERENCES checkin_events(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES exam_rooms(id) ON DELETE CASCADE,
    seat_number TEXT NULL,
    allocated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE room_allocations ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow students to read their own room allocation
CREATE POLICY "Allow students to view their own room allocation"
    ON room_allocations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM students WHERE students.id = room_allocations.student_id AND students.user_id = auth.uid()
        )
    );

-- Allow agency staff of the owning agency to manage room allocations
CREATE POLICY "Allow agency staff to manage room allocations"
    ON room_allocations
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM exams AS e
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE e.id = room_allocations.exam_id AND s.user_id = auth.uid() AND s.is_active = true
        )
    );
