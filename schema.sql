
-- Enable HTTP extension if not already enabled (needed for some Supabase features, good to have)
CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "extensions";

-- Enable pg_graphql extension if you plan to use Supabase GraphQL features
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";

-- Enable vector extension if you plan to use embeddings/vector search
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";

-- Custom ENUM types
DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM ('superadmin', 'admin', 'teacher', 'student');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE school_status_enum AS ENUM ('Active', 'Inactive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE attendance_status_enum AS ENUM ('Present', 'Absent', 'Late', 'Excused');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE leave_request_status_enum AS ENUM ('Pending AI Review', 'Approved', 'Rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_status_enum AS ENUM ('Pending', 'Paid', 'Partially Paid', 'Overdue', 'Failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE day_of_week_enum AS ENUM ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE course_resource_type_enum AS ENUM ('ebook', 'video', 'note', 'webinar');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE admission_status_enum AS ENUM ('Pending Review', 'Admitted', 'Enrolled', 'Rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- Function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Users Table (for login and basic info)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role user_role_enum NOT NULL,
    password_hash TEXT NOT NULL,
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL, -- Admin/Teacher can be linked to a school
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Schools Table
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    admin_email TEXT NOT NULL UNIQUE, -- Denormalized for easier querying/uniqueness if needed
    admin_name TEXT NOT NULL,
    admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Link to the admin's user record
    status school_status_enum NOT NULL DEFAULT 'Active',
    contact_phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_schools_admin_email ON schools(admin_email);
CREATE TRIGGER set_schools_updated_at
BEFORE UPDATE ON schools
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Students Table (Profile information)
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Student Profile ID
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Link to login user
    name TEXT NOT NULL, -- Can be inherited from users table or specific here
    email TEXT UNIQUE NOT NULL, -- Denormalized from users table for easier access
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
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
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_school_id ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE TRIGGER set_students_updated_at
BEFORE UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Teachers Table (Profile information)
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Teacher Profile ID
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Link to login user
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL, 
    subject TEXT,
    profile_picture_url TEXT,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_teachers_user_id ON teachers(user_id);
CREATE INDEX IF NOT EXISTS idx_teachers_school_id ON teachers(school_id);
CREATE TRIGGER set_teachers_updated_at
BEFORE UPDATE ON teachers
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Class Names Table (e.g., Grade 1, Grade 10)
CREATE TABLE IF NOT EXISTS class_names (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (name, school_id)
);
CREATE TRIGGER set_class_names_updated_at
BEFORE UPDATE ON class_names
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Section Names Table (e.g., A, B, Blue, Red)
CREATE TABLE IF NOT EXISTS section_names (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (name, school_id)
);
CREATE TRIGGER set_section_names_updated_at
BEFORE UPDATE ON section_names
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Academic Years Table
CREATE TABLE IF NOT EXISTS academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (name, school_id),
    CONSTRAINT check_dates CHECK (start_date < end_date)
);
CREATE TRIGGER set_academic_years_updated_at
BEFORE UPDATE ON academic_years
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Classes Table (Active combination of ClassName, SectionName, Teacher, AcademicYear)
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- Denormalized: e.g., "Grade 10"
    division TEXT NOT NULL, -- Denormalized: e.g., "A"
    class_name_id UUID NOT NULL REFERENCES class_names(id) ON DELETE RESTRICT,
    section_name_id UUID NOT NULL REFERENCES section_names(id) ON DELETE RESTRICT,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL, -- Teacher's profile ID
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (class_name_id, section_name_id, school_id, academic_year_id) -- A class-section can only exist once per year (or once if no year)
);
CREATE TRIGGER set_classes_updated_at
BEFORE UPDATE ON classes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Subjects Table
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (code, school_id, academic_year_id)
);
CREATE TRIGGER set_subjects_updated_at
BEFORE UPDATE ON subjects
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Exams Table
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL, -- Optional: Exam specific to a class
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    max_marks INTEGER,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_exams_updated_at
BEFORE UPDATE ON exams
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Student Scores Table
CREATE TABLE IF NOT EXISTS student_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, -- Denormalized for easier querying if exam doesn't directly link subject
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE, -- Class student was in when score was recorded
    score TEXT NOT NULL, -- Using TEXT to accommodate various grading systems (e.g., A+, 95, Pass)
    max_marks INTEGER,
    recorded_by_teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT, -- Teacher's profile ID
    date_recorded DATE NOT NULL DEFAULT CURRENT_DATE,
    comments TEXT,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, exam_id, class_id) -- A student can have one score per exam in a class
);
CREATE TRIGGER set_student_scores_updated_at
BEFORE UPDATE ON student_scores
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Assignments Table
CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE, -- Teacher's profile ID
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_assignments_updated_at
BEFORE UPDATE ON assignments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- Admission Records Table
CREATE TABLE IF NOT EXISTS admission_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    date_of_birth DATE,
    guardian_name TEXT,
    contact_number TEXT,
    address TEXT,
    admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status admission_status_enum NOT NULL,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL, -- Intended class
    student_profile_id UUID REFERENCES students(id) ON DELETE SET NULL, -- Link to actual student profile if enrolled
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_admission_records_updated_at
BEFORE UPDATE ON admission_records
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Leave Applications Table
CREATE TABLE IF NOT EXISTS leave_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_profile_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL, -- Denormalized for display
    reason TEXT NOT NULL,
    medical_notes_data_uri TEXT,
    submission_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status leave_request_status_enum NOT NULL DEFAULT 'Pending AI Review',
    ai_reasoning TEXT,
    applicant_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- User who submitted
    applicant_role user_role_enum NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_leave_applications_updated_at
BEFORE UPDATE ON leave_applications
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Announcements Table
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    author_name TEXT NOT NULL, -- Name of person/dept posting
    posted_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    posted_by_role user_role_enum NOT NULL,
    target_class_id UUID REFERENCES classes(id) ON DELETE SET NULL, -- Optional: for class-specific announcements
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_announcements_updated_at
BEFORE UPDATE ON announcements
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Calendar Events Table
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
    posted_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_calendar_events_updated_at
BEFORE UPDATE ON calendar_events
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Fee Categories Table
CREATE TABLE IF NOT EXISTS fee_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(10, 2), -- Optional default amount
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (name, school_id)
);
CREATE TRIGGER set_fee_categories_updated_at
BEFORE UPDATE ON fee_categories
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Student Fee Payments Table
CREATE TABLE IF NOT EXISTS student_fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    fee_category_id UUID NOT NULL REFERENCES fee_categories(id) ON DELETE RESTRICT,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    assigned_amount NUMERIC(10, 2) NOT NULL,
    paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    due_date DATE,
    payment_date DATE,
    status payment_status_enum NOT NULL DEFAULT 'Pending',
    notes TEXT,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_student_fee_payments_updated_at
BEFORE UPDATE ON student_fee_payments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Class Schedule Items Table
CREATE TABLE IF NOT EXISTS class_schedule_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE, -- Teacher's profile ID
    day_of_week day_of_week_enum NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT check_schedule_times CHECK (start_time < end_time)
);
CREATE TRIGGER set_class_schedule_items_updated_at
BEFORE UPDATE ON class_schedule_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Attendance Records Table
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status attendance_status_enum NOT NULL,
    remarks TEXT,
    taken_by_teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT, -- Teacher's profile ID
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, class_id, date) -- One record per student, per class, per day
);
CREATE TRIGGER set_attendance_records_updated_at
BEFORE UPDATE ON attendance_records
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- LMS Courses Table
CREATE TABLE IF NOT EXISTS lms_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    price NUMERIC(10, 2),
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE, -- Can be school-specific or general
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_lms_courses_updated_at
BEFORE UPDATE ON lms_courses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- LMS Course Resources Table
CREATE TABLE IF NOT EXISTS lms_course_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type course_resource_type_enum NOT NULL,
    url_or_content TEXT NOT NULL,
    file_name TEXT, -- For downloadable resources
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_lms_course_resources_updated_at
BEFORE UPDATE ON lms_course_resources
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- LMS Course Activation Codes Table
CREATE TABLE IF NOT EXISTS lms_course_activation_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    used_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    generated_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiry_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TRIGGER set_lms_course_activation_codes_updated_at
BEFORE UPDATE ON lms_course_activation_codes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- LMS Student Course Enrollments Table (Explicit Join Table)
CREATE TABLE IF NOT EXISTS lms_student_course_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_user_id, course_id)
);

-- LMS Teacher Course Enrollments Table (Explicit Join Table)
CREATE TABLE IF NOT EXISTS lms_teacher_course_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (teacher_user_id, course_id)
);


-- RLS Policies --
-- IMPORTANT: These are basic policies. Review and enhance them for production.
-- The service_role key will bypass these, so server actions using it will work.
-- For client-side, 'anon' and 'authenticated' roles are relevant if using Supabase built-in auth (which we are not for user/pass).
-- Since custom auth is used, `auth.uid()` and `auth.role()` in RLS policies won't map directly to your `users` table roles/IDs without additional setup (like setting session variables via custom claims if you were using JWTs from Supabase Auth).
-- For now, `anon` policies will be very restrictive for write operations.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to users" ON users;
CREATE POLICY "Allow public read access to users" ON users FOR SELECT TO anon, authenticated USING (true);
-- Allow users to update their own profiles (name, non-critical fields)
-- This would typically use auth.uid() = id. For custom auth, this is tricky.
-- Server actions using service_role should handle user updates.
DROP POLICY IF EXISTS "Allow individual user update own data" ON users;
-- CREATE POLICY "Allow individual user update own data" ON users FOR UPDATE TO authenticated
-- USING (auth.uid() = id)
-- WITH CHECK (auth.uid() = id);
-- For now, only service_role can update users.

ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to schools" ON schools;
CREATE POLICY "Allow public read access to schools" ON schools FOR SELECT TO anon, authenticated USING (true);
-- Only service_role (via server actions) can create/update/delete schools.

ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to academic years" ON academic_years;
CREATE POLICY "Allow public read access to academic years" ON academic_years FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to student profiles" ON students;
CREATE POLICY "Allow public read access to student profiles" ON students FOR SELECT TO anon, authenticated USING (true);
-- Teacher might select students of their school_id. Admin might select students of their school_id.
-- Student can select their own profile.
-- User-specific policies would be needed for updates (e.g., student updating their own contact, admin updating any student in their school).

ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to teacher profiles" ON teachers;
CREATE POLICY "Allow public read access to teacher profiles" ON teachers FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to classes" ON classes;
CREATE POLICY "Allow public read access to classes" ON classes FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to subjects" ON subjects;
CREATE POLICY "Allow public read access to subjects" ON subjects FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to exams" ON exams;
CREATE POLICY "Allow public read access to exams" ON exams FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE student_scores ENABLE ROW LEVEL SECURITY;
-- Students should only see their own scores. Teachers should only see/manage scores for their students.
-- For simplicity here, allowing broader read for now. This needs to be tightened.
DROP POLICY IF EXISTS "Allow authenticated read access to student scores" ON student_scores;
CREATE POLICY "Allow authenticated read access to student scores" ON student_scores FOR SELECT TO authenticated USING (true);
-- Example: Teacher can insert/update for their school
-- CREATE POLICY "Allow teachers to manage scores in their school" ON student_scores
-- FOR ALL TO authenticated -- Assuming teacher has 'authenticated' role
-- USING (school_id = (SELECT school_id FROM users WHERE id = auth.uid()))
-- WITH CHECK (school_id = (SELECT school_id FROM users WHERE id = auth.uid()));

ALTER TABLE lms_courses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to lms_courses" ON lms_courses;
CREATE POLICY "Allow public read access to lms_courses" ON lms_courses FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE lms_course_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow enrolled users to read lms_course_resources" ON lms_course_resources;
-- This policy is more complex and would require checking enrollment status.
-- For now, allow broader read access, to be refined.
CREATE POLICY "Allow enrolled users to read lms_course_resources" ON lms_course_resources FOR SELECT TO authenticated USING (true);

ALTER TABLE lms_course_activation_codes ENABLE ROW LEVEL SECURITY;
-- Highly restrictive. Only service_role should manage these.
-- Anon/authenticated shouldn't read these directly typically.

ALTER TABLE lms_student_course_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow student to see their own enrollments" ON lms_student_course_enrollments;
-- CREATE POLICY "Allow student to see their own enrollments" ON lms_student_course_enrollments
-- FOR SELECT TO authenticated USING (student_user_id = auth.uid());

ALTER TABLE lms_teacher_course_enrollments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow teacher to see their own assignments to courses" ON lms_teacher_course_enrollments;
-- CREATE POLICY "Allow teacher to see their own assignments to courses" ON lms_teacher_course_enrollments
-- FOR SELECT TO authenticated USING (teacher_user_id = auth.uid());

-- Default DENY for all other tables not explicitly granted for anon/authenticated
-- (Service role bypasses RLS anyway)
ALTER TABLE class_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

-- Ensure all tables not explicitly granting SELECT to anon/authenticated are protected by default.
-- Example:
-- ALTER TABLE some_sensitive_table ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Deny all access to sensitive table" ON some_sensitive_table FOR ALL USING (false);

-- It's good practice to make sure RLS is enabled for ALL tables and default to deny.
-- Then explicitly grant permissions. The above policies grant broad read access to anon/authenticated
-- which might need to be tightened for specific tables based on your app's logic.
-- For example, announcements might be public, but student_scores should be very restricted.

-- Final step: ensure the `postgres` user (default superuser) owns these tables.
-- This is usually handled by Supabase, but ensure the user running these commands has permissions.

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- Grant usage on schema public to anon and authenticated roles.
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Selectively grant permissions to anon and authenticated roles.
-- Example: For public tables, you might grant SELECT.
-- For tables where users interact (even with custom auth), you'll need more specific RLS.
-- Since service_role is used for mutations, anon/authenticated typically need fewer direct write permissions.

GRANT SELECT ON TABLE users TO anon;
GRANT SELECT ON TABLE schools TO anon;
GRANT SELECT ON TABLE academic_years TO anon;
GRANT SELECT ON TABLE students TO anon;
GRANT SELECT ON TABLE teachers TO anon;
GRANT SELECT ON TABLE classes TO anon;
GRANT SELECT ON TABLE subjects TO anon;
GRANT SELECT ON TABLE exams TO anon;
GRANT SELECT ON TABLE lms_courses TO anon;
-- etc. for other tables that need to be publicly readable.

-- IMPORTANT: The RLS policy of "USING (true)" for SELECT grants access to all rows.
-- This should be replaced with more specific conditions based on user roles and ownership
-- if client-side components are fetching data directly without server actions.
-- e.g., FOR SELECT USING (school_id = current_user_school_id_function())
-- Or for user-specific data: USING (user_id = auth.uid()) if using Supabase auth.
-- With custom auth, these become more complex to implement purely in RLS without helper functions.
