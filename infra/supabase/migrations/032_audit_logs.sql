-- Create audit_logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
    exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
    actor_id UUID NULL,
    actor_role TEXT NULL,
    event_type TEXT NOT NULL,
    event_description TEXT NOT NULL,
    metadata JSONB NULL,
    ip_address TEXT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow INSERT for all authenticated users
CREATE POLICY "Allow authenticated users to insert audit logs"
    ON audit_logs
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Allow SELECT for platform admins and scoped agency heads
CREATE POLICY "Allow platform admins to view all audit logs"
    ON audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM platform_admins WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Allow agency heads to view their own agency audit logs"
    ON audit_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM agency_staff AS s
            WHERE s.user_id = auth.uid() AND s.agency_id = audit_logs.agency_id AND s.role = 'agency_head' AND s.is_active = true
        )
    );
