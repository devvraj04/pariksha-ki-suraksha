-- Create agencies table
CREATE TABLE IF NOT EXISTS agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    official_email TEXT NOT NULL UNIQUE,
    pan_number TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    phone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'DEREGISTERED')),
    approved_at TIMESTAMPTZ NULL,
    approved_by UUID REFERENCES platform_admins(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow anyone to view details of active agencies
CREATE POLICY "Allow public read access to active agencies"
    ON agencies
    FOR SELECT
    USING (status = 'ACTIVE');

-- Allow platform admins to manage all agencies
CREATE POLICY "Allow platform admins full access to agencies"
    ON agencies
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM platform_admins WHERE user_id = auth.uid()
        )
    );
