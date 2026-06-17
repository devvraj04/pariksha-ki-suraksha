-- Create students table
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY')),
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    photo_path TEXT NULL,
    biometric_hash TEXT NULL,
    id_proof_type TEXT NULL,
    id_proof_number TEXT NULL, -- encrypted
    id_proof_path TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
-- Allow students to read/write their own profile
CREATE POLICY "Allow students to view their own profile"
    ON students
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Allow students to update their own profile"
    ON students
    FOR UPDATE
    USING (auth.uid() = user_id);
