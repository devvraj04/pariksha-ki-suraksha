-- Create platform_admins table
CREATE TABLE IF NOT EXISTS platform_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

-- Simple RLS Policy
CREATE POLICY "Allow platform admins to view their own profile" 
    ON platform_admins 
    FOR SELECT 
    USING (auth.uid() = user_id);
