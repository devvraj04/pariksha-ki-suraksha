-- Pre-create Supabase storage buckets if storage schema exists
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'buckets') THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES 
      ('encrypted-papers', 'encrypted-papers', false),
      ('omr-scans', 'omr-scans', false),
      ('vision-alerts', 'vision-alerts', false),
      ('forensic-uploads', 'forensic-uploads', false)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Create core user_profiles table referencing auth.users (Supabase internal)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role user_role_enum NOT NULL,
  assigned_location_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create exams table
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status exam_status_enum NOT NULL DEFAULT 'draft',
  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create exam_centers table
CREATE TABLE exam_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  capacity INTEGER NOT NULL,
  contact_supervisor_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create exam_center_assignments table
CREATE TABLE exam_center_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE CASCADE,
  candidate_count INTEGER NOT NULL DEFAULT 0,
  assigned_supervisor_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_exam_center_assignments UNIQUE (exam_id, center_id)
);

-- Create students table
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roll_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  photo_storage_path TEXT,
  name_hash TEXT NOT NULL,
  photo_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create exam_enrollments table
CREATE TABLE exam_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  center_id UUID NOT NULL REFERENCES exam_centers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_exam_enrollments UNIQUE (student_id, exam_id)
);

-- Add circular foreign keys
ALTER TABLE user_profiles 
  ADD CONSTRAINT fk_user_profiles_assigned_location 
  FOREIGN KEY (assigned_location_id) REFERENCES exam_centers(id) ON DELETE SET NULL;

ALTER TABLE exam_centers 
  ADD CONSTRAINT fk_exam_centers_contact_supervisor 
  FOREIGN KEY (contact_supervisor_id) REFERENCES user_profiles(id) ON DELETE SET NULL;
