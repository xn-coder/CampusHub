
-- Enable pgcrypto for gen_random_uuid() if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop existing types and tables if they exist to start fresh (optional, use with caution)
-- Enums
DROP TYPE IF EXISTS public.user_role_enum CASCADE;
DROP TYPE IF EXISTS public.school_status_enum CASCADE;
DROP TYPE IF EXISTS public.leave_status_enum CASCADE;
DROP TYPE IF EXISTS public.day_of_week_enum CASCADE;
DROP TYPE IF EXISTS public.attendance_status_enum CASCADE;
DROP TYPE IF EXISTS public.fee_payment_status_enum CASCADE;
DROP TYPE IF EXISTS public.payroll_status_enum CASCADE;
DROP TYPE IF EXISTS public.course_resource_type_enum CASCADE;
-- Tables (in reverse order of dependency)
DROP TABLE IF EXISTS public.teacher_course_enrollments CASCADE;
DROP TABLE IF EXISTS public.student_course_enrollments CASCADE;
DROP TABLE IF EXISTS public.course_activation_codes CASCADE;
DROP TABLE IF EXISTS public.course_resources CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.payroll_entries CASCADE;
DROP TABLE IF EXISTS public.student_fee_payments CASCADE;
DROP TABLE IF EXISTS public.fee_categories CASCADE;
DROP TABLE IF EXISTS public.attendance_records CASCADE;
DROP TABLE IF EXISTS public.class_schedule_items CASCADE;
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.student_scores CASCADE;
DROP TABLE IF EXISTS public.exams CASCADE;
DROP TABLE IF EXISTS public.subjects CASCADE;
DROP TABLE IF EXISTS public.holidays CASCADE;
DROP TABLE IF EXISTS public.announcements CASCADE;
DROP TABLE IF EXISTS public.calendar_events CASCADE;
DROP TABLE IF EXISTS public.class_data CASCADE;
DROP TABLE IF EXISTS public.section_records CASCADE;
DROP TABLE IF EXISTS public.class_name_records CASCADE;
DROP TABLE IF EXISTS public.admission_records CASCADE;
DROP TABLE IF EXISTS public.employees CASCADE;
DROP TABLE IF EXISTS public.teachers CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.academic_years CASCADE;
DROP TABLE IF EXISTS public.schools CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;


-- Custom ENUM types
CREATE TYPE public.user_role_enum AS ENUM ('superadmin', 'admin', 'teacher', 'student', 'staff');
CREATE TYPE public.school_status_enum AS ENUM ('Active', 'Inactive');
CREATE TYPE public.leave_status_enum AS ENUM ('Pending AI Review', 'Approved', 'Rejected', 'Pending'); -- Added 'Pending'
CREATE TYPE public.day_of_week_enum AS ENUM ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
CREATE TYPE public.attendance_status_enum AS ENUM ('Present', 'Absent', 'Late', 'Excused');
CREATE TYPE public.fee_payment_status_enum AS ENUM ('Pending', 'Paid', 'Partially Paid', 'Overdue', 'Failed'); -- Corrected 'PartiallyPaid'
CREATE TYPE public.payroll_status_enum AS ENUM ('Pending', 'Paid', 'Processing');
CREATE TYPE public.course_resource_type_enum AS ENUM ('ebook', 'video', 'note', 'webinar');


-- Function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION public.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Users Table (Central Authentication Table)
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role public.user_role_enum NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Schools Table
CREATE TABLE public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    admin_email TEXT UNIQUE NOT NULL, -- Used for initial linking, could be denormalized or derived
    admin_name TEXT NOT NULL,      -- Same as above
    admin_user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT, -- School must have an admin
    status public.school_status_enum NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_timestamp_schools
BEFORE UPDATE ON public.schools
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Academic Years Table
CREATE TABLE public.academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (school_id, name)
);
CREATE TRIGGER set_timestamp_academic_years
BEFORE UPDATE ON public.academic_years
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();


-- Students Table (Student Profiles)
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, -- Link to login user
    name TEXT NOT NULL, -- Denormalized from users table for convenience or can be joined
    email TEXT UNIQUE NOT NULL, -- Denormalized from users table
    class_id UUID, -- REFERENCES public.class_data(id) ON DELETE SET NULL, -- Nullable if student not yet assigned
    profile_picture_url TEXT,
    date_of_birth DATE,
    guardian_name TEXT,
    contact_number TEXT,
    address TEXT,
    admission_date DATE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_timestamp_students
BEFORE UPDATE ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Teachers Table (Teacher Profiles)
CREATE TABLE public.teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, -- Link to login user
    name TEXT NOT NULL, -- Denormalized
    email TEXT UNIQUE NOT NULL, -- Denormalized
    subject TEXT, -- Primary subject
    profile_picture_url TEXT,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_timestamp_teachers
BEFORE UPDATE ON public.teachers
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Employees Table (Non-teaching staff)
CREATE TABLE public.employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, -- Link to login user
    name TEXT NOT NULL, -- Denormalized
    email TEXT UNIQUE NOT NULL, -- Denormalized
    role_description TEXT NOT NULL, -- e.g., "Accountant", "Librarian"
    department TEXT,
    joining_date DATE,
    profile_picture_url TEXT,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_timestamp_employees
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- ClassName Records (e.g., Grade 1, Grade 2)
CREATE TABLE public.class_name_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    UNIQUE (school_id, name),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_timestamp_class_name_records
BEFORE UPDATE ON public.class_name_records
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Section Records (e.g., A, B, Blue, Red)
CREATE TABLE public.section_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    UNIQUE (school_id, name),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_timestamp_section_records
BEFORE UPDATE ON public.section_records
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();

-- Class Data (Activated Class-Sections, e.g., Grade 1-A)
CREATE TABLE public.class_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- e.g., "Grade 1"
    division TEXT NOT NULL, -- e.g., "A"
    class_name_record_id UUID NOT NULL REFERENCES public.class_name_records(id) ON DELETE RESTRICT,
    section_record_id UUID NOT NULL REFERENCES public.section_records(id) ON DELETE RESTRICT,
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL, -- Teacher's profile ID
    academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    UNIQUE (school_id, class_name_record_id, section_record_id, academic_year_id), -- A class-section combination should be unique for a given year
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
CREATE TRIGGER set_timestamp_class_data
BEFORE UPDATE ON public.class_data
FOR EACH ROW
EXECUTE FUNCTION public.trigger_set_timestamp();
-- Add foreign key from students to class_data AFTER class_data is defined
ALTER TABLE public.students ADD CONSTRAINT fk_students_class_id FOREIGN KEY (class_id) REFERENCES public.class_data(id) ON DELETE SET NULL;


-- Row Level Security (RLS) Policies
-- Enable RLS for all relevant tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_name_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_data ENABLE ROW LEVEL SECURITY;

-- Policies for 'users' table
CREATE POLICY "Allow anon to select users for login/check" ON public.users FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon to insert superadmin/admin (temporary)" ON public.users FOR INSERT TO anon WITH CHECK (true); -- NEEDS REVIEW FOR PRODUCTION
CREATE POLICY "Users can select their own data" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own data" ON public.users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Superadmins have full access to users" ON public.users TO service_role USING (true) WITH CHECK (true); -- Or use specific role check if using Supabase auth roles

-- Policies for 'schools' table
CREATE POLICY "Allow anon to read schools (e.g. for listing)" ON public.schools FOR SELECT TO anon USING (true); -- Adjust as needed
CREATE POLICY "Allow anon to mutate schools (temporary for superadmin actions)" ON public.schools FOR ALL TO anon USING (true) WITH CHECK (true); -- NEEDS REVIEW FOR PRODUCTION
CREATE POLICY "Admins can select their own school" ON public.schools FOR SELECT USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' AND admin_user_id = auth.uid());
CREATE POLICY "Admins can update their own school" ON public.schools FOR UPDATE USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' AND admin_user_id = auth.uid()) WITH CHECK (admin_user_id = auth.uid());
CREATE POLICY "Superadmins have full access to schools" ON public.schools TO service_role USING (true) WITH CHECK (true);

-- Policies for 'academic_years' table
CREATE POLICY "Allow anon to read academic years (e.g. for school delete check)" ON public.academic_years FOR SELECT TO anon USING (true); -- Adjust as needed
CREATE POLICY "Allow anon to mutate academic_years (temporary for admin actions)" ON public.academic_years FOR ALL TO anon USING (true) WITH CHECK (true); -- NEEDS REVIEW FOR PRODUCTION
CREATE POLICY "Admins can manage academic years for their school" ON public.academic_years
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.schools WHERE id = school_id AND admin_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.schools WHERE id = school_id AND admin_user_id = auth.uid()));
CREATE POLICY "Superadmins have full access to academic years" ON public.academic_years TO service_role USING (true) WITH CHECK (true);


-- Policies for 'students' table (Example - expand as needed)
CREATE POLICY "Allow authenticated read access to students" ON public.students FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin/teacher to manage students in their school/class" ON public.students FOR ALL
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' AND school_id = (SELECT school_id FROM public.schools WHERE admin_user_id = auth.uid() LIMIT 1)
    OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'teacher' AND class_id IN (SELECT id FROM public.class_data WHERE teacher_id = (SELECT id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1))
  )
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' AND school_id = (SELECT school_id FROM public.schools WHERE admin_user_id = auth.uid() LIMIT 1)
    OR
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'teacher' AND class_id IN (SELECT id FROM public.class_data WHERE teacher_id = (SELECT id FROM public.teachers WHERE user_id = auth.uid() LIMIT 1))
  );
CREATE POLICY "Students can view their own profile" ON public.students FOR SELECT USING (user_id = auth.uid());


-- Policies for 'teachers' table (Example - expand as needed)
CREATE POLICY "Allow authenticated read access to teachers" ON public.teachers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin to manage teachers in their school" ON public.teachers FOR ALL
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' AND school_id = (SELECT school_id FROM public.schools WHERE admin_user_id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' AND school_id = (SELECT school_id FROM public.schools WHERE admin_user_id = auth.uid() LIMIT 1)
  );
CREATE POLICY "Teachers can view their own profile" ON public.teachers FOR SELECT USING (user_id = auth.uid());

-- Policies for 'employees' table (Example - expand as needed)
CREATE POLICY "Allow authenticated read access to employees" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admin to manage employees in their school" ON public.employees FOR ALL
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' AND school_id = (SELECT school_id FROM public.schools WHERE admin_user_id = auth.uid() LIMIT 1)
  )
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin' AND school_id = (SELECT school_id FROM public.schools WHERE admin_user_id = auth.uid() LIMIT 1)
  );

-- Policies for Class Name/Section Records and Class Data (Example - expand as needed)
CREATE POLICY "Allow authenticated read access to class structures" ON public.class_name_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access to section structures" ON public.section_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read access to active classes" ON public.class_data FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage class structures for their school" ON public.class_name_records
  FOR ALL USING (EXISTS (SELECT 1 FROM public.schools WHERE id = school_id AND admin_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.schools WHERE id = school_id AND admin_user_id = auth.uid()));
CREATE POLICY "Admins can manage section structures for their school" ON public.section_records
  FOR ALL USING (EXISTS (SELECT 1 FROM public.schools WHERE id = school_id AND admin_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.schools WHERE id = school_id AND admin_user_id = auth.uid()));
CREATE POLICY "Admins can manage active classes for their school" ON public.class_data
  FOR ALL USING (EXISTS (SELECT 1 FROM public.schools WHERE id = school_id AND admin_user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.schools WHERE id = school_id AND admin_user_id = auth.uid()));


-- IMPORTANT: The `anon` policies above that grant broad mutation access are for initial setup convenience
-- with the current Server Action implementation.
-- In a production environment, these should be REMOVED or SEVERELY RESTRICTED.
-- Mutations should ideally be performed by authenticated users with specific roles
-- or by backend functions using the `service_role` key which bypasses RLS.

-- Placeholder for other tables and their RLS (to be defined as features are built)
-- Examples:
-- CREATE TABLE public.subjects ...
-- ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow authenticated users to read subjects" ON public.subjects FOR SELECT TO authenticated USING (true);
-- ... etc.

SELECT extensions.grant_pg_net();
ALTER publication supabase_realtime add table users, schools, academic_years, students, teachers, employees, class_name_records, section_records, class_data;


DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'users') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'schools') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.schools;
  END IF;
   IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'academic_years') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.academic_years;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'students') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
  END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'teachers') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.teachers;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'employees') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.employees;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'class_name_records') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_name_records;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'section_records') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.section_records;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'class_data') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.class_data;
  END IF;
  -- Add other tables here as needed
END $$;

-- Ensure `auth.uid()` is available for RLS policies.
-- This is usually available by default in Supabase but good to be aware of.

-- You might need to grant usage on the public schema to the anon and authenticated roles if not already done.
-- GRANT USAGE ON SCHEMA public TO anon;
-- GRANT USAGE ON SCHEMA public TO authenticated;
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon; -- Example, be more specific
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated; -- Example, be more specific
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
-- GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres;

