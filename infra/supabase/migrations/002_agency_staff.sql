-- Create agency_staff table
CREATE TABLE IF NOT EXISTS agency_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID NOT NULL REFERENCES agencies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('agency_head', 'manager', 'operator', 'transit_manager', 'center_officer', 'chief_moderator', 'moderator', 'grading_teacher')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    joined_at TIMESTAMPTZ NULL,
    created_by UUID REFERENCES agency_staff(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE agency_staff ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Staff members can read all staff profiles belonging to their own agency
CREATE POLICY "Allow staff to read profiles of the same agency"
    ON agency_staff
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM agency_staff AS s 
            WHERE s.user_id = auth.uid() AND s.agency_id = agency_staff.agency_id AND s.is_active = true
        )
    );

-- Agency heads can manage staff for their agency
CREATE POLICY "Allow agency heads to manage staff"
    ON agency_staff
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM agency_staff AS s 
            WHERE s.user_id = auth.uid() AND s.agency_id = agency_staff.agency_id AND s.role = 'agency_head' AND s.is_active = true
        )
    );
