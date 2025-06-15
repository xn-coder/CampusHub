-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum Types
CREATE TYPE user_role_enum AS ENUM ('superadmin', 'admin', 'teacher', 'student', 'staff');
CREATE TYPE school_status_enum AS ENUM ('Active', 'Inactive');
CREATE TYPE leave_status_enum AS ENUM ('Pending', 'Approved', 'Rejected');
CREATE TYPE attendance_status_enum AS ENUM ('Present', 'Absent', 'Late', 'Excused');
CREATE TYPE day_of_week_enum AS ENUM ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
CREATE TYPE fee_payment_status_enum AS ENUM ('Pending', 'Paid', 'PartiallyPaid', 'Overdue', 'Failed');
CREATE TYPE payroll_status_enum AS ENUM ('Pending', 'Paid', 'Processing');
CREATE TYPE course_resource_type_enum AS ENUM ('ebook', 'video', 'note', 'webinar');

-- Trigger function to update 'updated_at' column
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role user_role_enum NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Schools Table
CREATE TABLE IF NOT EXISTS schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  admin_email TEXT UNIQUE NOT NULL, -- For lookup, actual admin is linked via admin_user_id
  admin_name TEXT NOT NULL,
  admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Link to the admin user
  status school_status_enum NOT NULL DEFAULT 'Active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_schools_updated_at
BEFORE UPDATE ON schools
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Academic Years Table
CREATE TABLE IF NOT EXISTS academic_years (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_academic_year_name_school_id UNIQUE (name, school_id),
  CONSTRAINT chk_start_date_before_end_date CHECK (start_date < end_date)
);
CREATE TRIGGER set_academic_years_updated_at
BEFORE UPDATE ON academic_years
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Enable RLS for tables (example for users, apply to others as needed)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
-- Add other tables here

-- RLS Policies for 'users' table to allow ensureSuperAdminExists to function with anon key
-- WARNING: These are broad. Review and restrict for production.
-- Allows anon role to read user records (e.g., to check if superadmin email exists)
CREATE POLICY "Allow anon select on users table"
ON public.users
FOR SELECT
TO anon
USING (true);

-- Allows anon role to insert into users table (e.g., to create superadmin if not exists)
-- For production, this should ideally be handled by a service_role key or a more secure mechanism.
CREATE POLICY "Allow anon insert on users table for initial setup"
ON public.users
FOR INSERT
TO anon
WITH CHECK (true);


-- Placeholder for other tables based on src/types/index.ts
-- (Student, Teacher, Employee, ClassNameRecord, SectionRecord, ClassData, Announcement, etc.)
-- These would need to be defined similarly with appropriate columns, types, relations, and RLS.

/* Example for Students table (profiles)
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID REFERENCES class_data(id) ON DELETE SET NULL, -- Assuming class_data table
  profile_picture_url TEXT,
  date_of_birth DATE,
  guardian_name TEXT,
  contact_number TEXT,
  address TEXT,
  admission_date DATE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_students_updated_at
BEFORE UPDATE ON students
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
*/

/* Example for Teachers table (profiles)
CREATE TABLE IF NOT EXISTS teachers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT, -- Or link to a subjects table
  profile_picture_url TEXT,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_teachers_updated_at
BEFORE UPDATE ON teachers
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
*/

-- Add more table definitions and RLS policies as needed for your application.

COMMENT ON COLUMN users.password_hash IS 'Stores the hashed password using bcrypt';
COMMENT ON COLUMN schools.admin_user_id IS 'Foreign key referencing the users table for the school''s primary administrator';
COMMENT ON POLICY "Allow anon select on users table" ON public.users IS 'Allows anonymous users to read user data. Required for email existence checks during superadmin setup with anon key. Review for production.';
COMMENT ON POLICY "Allow anon insert on users table for initial setup" ON public.users IS 'Allows anonymous users to insert into the users table. Required for superadmin creation with anon key if it does''t exist. HIGHLY insecure for production if left open; should be temporary or use service_role.';

