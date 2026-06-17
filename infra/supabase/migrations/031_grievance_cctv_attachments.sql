-- Create grievance_cctv_attachments table
CREATE TABLE IF NOT EXISTS grievance_cctv_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grievance_id UUID NOT NULL REFERENCES student_grievances(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES exam_rooms(id) ON DELETE CASCADE,
    camera_id TEXT NOT NULL,
    footage_start TIMESTAMPTZ NOT NULL,
    footage_end TIMESTAMPTZ NOT NULL,
    footage_path TEXT NOT NULL,
    pulled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE grievance_cctv_attachments ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow students to read their own grievance cctv attachments
CREATE POLICY "Allow students to view their own grievance cctv attachments"
    ON grievance_cctv_attachments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM student_grievances AS g
            JOIN students AS s ON s.id = g.student_id
            WHERE g.id = grievance_cctv_attachments.grievance_id AND s.user_id = auth.uid()
        )
    );

-- Allow agency staff of the owning agency to view grievance cctv attachments
CREATE POLICY "Allow agency staff to read grievance cctv attachments"
    ON grievance_cctv_attachments
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM student_grievances AS g
            JOIN exams AS e ON e.id = g.exam_id
            JOIN agency_staff AS s ON s.agency_id = e.agency_id
            WHERE g.id = grievance_cctv_attachments.grievance_id AND s.user_id = auth.uid() AND s.is_active = true
        )
    );
