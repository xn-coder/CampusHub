
-- Enable UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ENUM Types (adjust as per your full requirements)
CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'teacher', 'student', 'staff');
CREATE TYPE school_status AS ENUM ('Active', 'Inactive');
CREATE TYPE leave_status AS ENUM ('Pending', 'Approved', 'Rejected', 'Pending AI Review');
CREATE TYPE fee_payment_status AS ENUM ('Pending', 'Paid', 'PartiallyPaid', 'Overdue', 'Failed');
CREATE TYPE payroll_status AS ENUM ('Pending', 'Paid', 'Processing');
CREATE TYPE resource_type_lms AS ENUM ('ebook', 'video', 'note', 'webinar');
CREATE TYPE day_of_week AS ENUM ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
CREATE TYPE attendance_status AS ENUM ('Present', 'Absent', 'Late', 'Excused');
CREATE TYPE admission_status AS ENUM ('Pending Review', 'Admitted', 'Enrolled', 'Rejected');


-- Function to automatically update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Schools Table
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    admin_email TEXT UNIQUE, -- Email of the primary admin for this school
    admin_name TEXT,         -- Name of the primary admin
    admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Link to the users table
    status school_status DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_schools
BEFORE UPDATE ON schools
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Academic Years Table
CREATE TABLE academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT check_start_end_dates CHECK (start_date < end_date),
    UNIQUE (name, school_id) -- Ensure academic year name is unique within a school
);
CREATE TRIGGER set_timestamp_academic_years
BEFORE UPDATE ON academic_years
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Class Names (e.g., Grade 1, Grade 10)
CREATE TABLE class_names (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, school_id)
);
CREATE TRIGGER set_timestamp_class_names
BEFORE UPDATE ON class_names
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Section Names (e.g., A, B, Blue, Red)
CREATE TABLE section_names (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(name, school_id)
);
CREATE TRIGGER set_timestamp_section_names
BEFORE UPDATE ON section_names
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Teacher Profiles Table
CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- This is the Teacher Profile ID
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Link to the users table for login
    subject TEXT, -- Primary subject
    profile_picture_url TEXT,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_teachers
BEFORE UPDATE ON teachers
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Class Data (Activated Class-Sections)
CREATE TABLE class_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- e.g., "Grade 10" (comes from class_names.name)
    division TEXT NOT NULL, -- e.g., "A" (comes from section_names.name)
    class_name_id UUID NOT NULL REFERENCES class_names(id) ON DELETE RESTRICT,
    section_name_id UUID NOT NULL REFERENCES section_names(id) ON DELETE RESTRICT,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL, -- Teacher Profile ID
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_name_id, section_name_id, academic_year_id, school_id) -- Ensure unique combination
);
CREATE TRIGGER set_timestamp_class_data
BEFORE UPDATE ON class_data
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Student Profiles Table
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- This is the Student Profile ID
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Link to the users table for login/email
    class_id UUID REFERENCES class_data(id) ON DELETE SET NULL, -- Link to the active class-section
    profile_picture_url TEXT,
    date_of_birth DATE,
    guardian_name TEXT,
    contact_number TEXT,
    address TEXT,
    admission_date DATE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_students
BEFORE UPDATE ON students
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();


-- Subjects Table
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(code, school_id, academic_year_id) -- Code should be unique within a school/year context
);
CREATE TRIGGER set_timestamp_subjects
BEFORE UPDATE ON subjects
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Exams Table
CREATE TABLE exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_section_id UUID REFERENCES class_data(id) ON DELETE SET NULL, -- Optional: if exam is for a specific class
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    max_marks NUMERIC(5, 2),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_exams
BEFORE UPDATE ON exams
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Student Scores Table
CREATE TABLE student_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, -- Denormalized for easier querying, matches exam's subject
    class_section_id UUID NOT NULL REFERENCES class_data(id) ON DELETE CASCADE,
    score TEXT NOT NULL, -- Can be numeric or grade like "A+"
    max_marks NUMERIC(5, 2), -- Can be from exam.max_marks
    recorded_by_teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT, -- Teacher Profile ID
    recorded_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT, -- User ID of the teacher
    date_recorded TIMESTAMPTZ DEFAULT NOW(),
    comments TEXT,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, exam_id) -- A student should have one score per exam
);
CREATE TRIGGER set_timestamp_student_scores
BEFORE UPDATE ON student_scores
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Admission Records Table
CREATE TABLE admission_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE, -- Link to the created student profile
    -- Student details like name, email, dob etc. are in the students and users table.
    -- You can add redundant fields here if needed for historical admission data before a student profile is fully made.
    -- For this schema, we assume student profile is made upon or before admission record.
    admission_date DATE NOT NULL,
    status admission_status NOT NULL DEFAULT 'Pending Review',
    class_id UUID REFERENCES class_data(id) ON DELETE SET NULL, -- Assigned class after admission
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_admission_records
BEFORE UPDATE ON admission_records
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();


-- Note: This is a foundational schema. You'll need to add more tables
-- (e.g., Employee, ClassScheduleItem, AttendanceRecord, FeeCategory, StudentFeePayment, PayrollEntry,
-- LMS_Courses, LMS_Resources, Announcements, CalendarEvents, SchoolDetails, Holidays etc.)
-- based on your `src/types/index.ts` and application requirements.
-- Remember to add appropriate foreign keys, constraints, and indexes for performance.
-- For RLS (Row Level Security), you'll define policies in the Supabase dashboard for each table.
-- Example for a simple RLS policy on 'students' allowing authenticated users to see all students (adjust as needed):
-- CREATE POLICY "Allow all authenticated users to read students" ON students FOR SELECT TO authenticated USING (true);
-- You'll need more granular policies, e.g., student can only see their own data, teacher their students etc.
