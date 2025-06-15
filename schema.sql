-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing ENUM types if they exist to avoid conflicts during re-creation (be cautious in production)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
        DROP TYPE user_role_enum;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'school_status_enum') THEN
        DROP TYPE school_status_enum;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attendance_status_enum') THEN
        DROP TYPE attendance_status_enum;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_status_enum') THEN
        DROP TYPE leave_status_enum;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_enum') THEN
        DROP TYPE payment_status_enum;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payroll_status_enum') THEN
        DROP TYPE payroll_status_enum;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'day_of_week_enum') THEN
        DROP TYPE day_of_week_enum;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'course_resource_type_enum') THEN
        DROP TYPE course_resource_type_enum;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admission_status_enum') THEN
        DROP TYPE admission_status_enum;
    END IF;
END$$;


-- ENUM Types
CREATE TYPE user_role_enum AS ENUM ('superadmin', 'admin', 'teacher', 'student', 'staff');
CREATE TYPE school_status_enum AS ENUM ('Active', 'Inactive');
CREATE TYPE attendance_status_enum AS ENUM ('Present', 'Absent', 'Late', 'Excused');
CREATE TYPE leave_status_enum AS ENUM ('Pending AI Review', 'Approved', 'Rejected');
CREATE TYPE payment_status_enum AS ENUM ('Pending', 'Paid', 'Partially Paid', 'Overdue', 'Failed');
CREATE TYPE payroll_status_enum AS ENUM ('Pending', 'Paid', 'Processing');
CREATE TYPE day_of_week_enum AS ENUM ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
CREATE TYPE course_resource_type_enum AS ENUM ('ebook', 'video', 'note', 'webinar');
CREATE TYPE admission_status_enum AS ENUM ('Pending Review', 'Admitted', 'Enrolled', 'Rejected');


-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Users Table (Central Authentication Table)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role_enum NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS set_timestamp_users ON users;
CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Schools Table
CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    admin_email TEXT UNIQUE NOT NULL,
    admin_name TEXT NOT NULL,
    admin_user_id UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL, -- Admin user linked here
    status school_status_enum DEFAULT 'Active',
    contact_phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS set_timestamp_schools ON schools;
CREATE TRIGGER set_timestamp_schools
BEFORE UPDATE ON schools
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


-- Student Profiles Table
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- This can be the same as users.id if 1-to-1
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Links to the user login
    name TEXT NOT NULL, -- Redundant with users.name but often kept in profile tables
    email TEXT UNIQUE NOT NULL, -- Redundant with users.email
    class_id UUID, -- FK added later after 'classes' table
    profile_picture_url TEXT,
    date_of_birth DATE,
    guardian_name TEXT,
    contact_number TEXT,
    address TEXT,
    admission_date DATE,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE, -- Each student belongs to a school
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS set_timestamp_students ON students;
CREATE TRIGGER set_timestamp_students
BEFORE UPDATE ON students
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


-- Teacher Profiles Table
CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- This can be the same as users.id
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Links to the user login
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    subject TEXT, -- Primary subject, can be more complex if teachers teach multiple
    profile_picture_url TEXT,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE, -- Each teacher belongs to a school
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS set_timestamp_teachers ON teachers;
CREATE TRIGGER set_timestamp_teachers
BEFORE UPDATE ON teachers
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Employee Profiles Table (for non-teaching staff)
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role_title TEXT NOT NULL, -- e.g., Accountant, Librarian
    department TEXT,
    joining_date DATE,
    profile_picture_url TEXT,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS set_timestamp_employees ON employees;
CREATE TRIGGER set_timestamp_employees
BEFORE UPDATE ON employees
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


-- Academic Years Table
CREATE TABLE IF NOT EXISTS academic_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, name)
);
DROP TRIGGER IF EXISTS set_timestamp_academic_years ON academic_years;
CREATE TRIGGER set_timestamp_academic_years
BEFORE UPDATE ON academic_years
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Class Names Table (Standards, e.g., Grade 1, Grade 10)
CREATE TABLE IF NOT EXISTS class_names (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, name)
);
DROP TRIGGER IF EXISTS set_timestamp_class_names ON class_names;
CREATE TRIGGER set_timestamp_class_names
BEFORE UPDATE ON class_names
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Section Names Table (Divisions, e.g., A, B, Blue)
CREATE TABLE IF NOT EXISTS section_names (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, name)
);
DROP TRIGGER IF EXISTS set_timestamp_section_names ON section_names;
CREATE TRIGGER set_timestamp_section_names
BEFORE UPDATE ON section_names
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Classes Table (Activated Class-Sections)
CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_name_id UUID NOT NULL REFERENCES class_names(id) ON DELETE RESTRICT, -- Derived from class_names
    section_name_id UUID NOT NULL REFERENCES section_names(id) ON DELETE RESTRICT, -- Derived from section_names
    name TEXT NOT NULL, -- e.g., "Grade 10" (denormalized for convenience)
    division TEXT NOT NULL, -- e.g., "A" (denormalized for convenience)
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL, -- Class teacher
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, class_name_id, section_name_id, academic_year_id) -- Ensures unique class-section per year
);
DROP TRIGGER IF EXISTS set_timestamp_classes ON classes;
CREATE TRIGGER set_timestamp_classes
BEFORE UPDATE ON classes
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Add FK constraint from students to classes (after classes table is created)
ALTER TABLE students
ADD CONSTRAINT fk_students_class_id
FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE SET NULL;

-- Student-Class Enrollment (Many-to-Many Join Table if a student can be in multiple conceptual groups within a class, otherwise student.class_id is enough)
-- For simplicity, assuming a student belongs to one 'class' (class-section) at a time via students.class_id.
-- If more granular enrollment (e.g. student in multiple subject groups within a class) is needed, a join table is better.

-- Subjects Table
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, code, academic_year_id)
);
DROP TRIGGER IF EXISTS set_timestamp_subjects ON subjects;
CREATE TRIGGER set_timestamp_subjects
BEFORE UPDATE ON subjects
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Exams Table
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL, -- Optional: if exam is for a specific class
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    max_marks NUMERIC,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS set_timestamp_exams ON exams;
CREATE TRIGGER set_timestamp_exams
BEFORE UPDATE ON exams
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Student Scores Table
CREATE TABLE IF NOT EXISTS student_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, -- Denormalized for easier querying
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE, -- Class student was in at time of exam
    score TEXT NOT NULL, -- Can be numeric or grade (e.g., "A+")
    max_marks NUMERIC, -- Denormalized from exam for context
    recorded_by_teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
    date_recorded DATE NOT NULL,
    comments TEXT,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, exam_id)
);
DROP TRIGGER IF EXISTS set_timestamp_student_scores ON student_scores;
CREATE TRIGGER set_timestamp_student_scores
BEFORE UPDATE ON student_scores
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


-- Assignments Table
CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE, -- Target class-section
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE, -- Teacher who posted
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL, -- Optional: link to subject
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS set_timestamp_assignments ON assignments;
CREATE TRIGGER set_timestamp_assignments
BEFORE UPDATE ON assignments
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Leave Applications Table
CREATE TABLE IF NOT EXISTS leave_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_profile_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE, -- The student for whom leave is applied
    student_name TEXT NOT NULL, -- Name of the student (can be from form)
    reason TEXT NOT NULL,
    medical_notes_data_uri TEXT,
    submission_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status leave_status_enum NOT NULL DEFAULT 'Pending AI Review',
    ai_reasoning TEXT,
    applicant_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- User who submitted (student, teacher, admin)
    applicant_role user_role_enum NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS set_timestamp_leave_applications ON leave_applications;
CREATE TRIGGER set_timestamp_leave_applications
BEFORE UPDATE ON leave_applications
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Announcements Table
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    author_name TEXT NOT NULL,
    posted_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    posted_by_role user_role_enum NOT NULL,
    target_class_id UUID REFERENCES classes(id) ON DELETE SET NULL, -- Optional: for class-specific announcements
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS set_timestamp_announcements ON announcements;
CREATE TRIGGER set_timestamp_announcements
BEFORE UPDATE ON announcements
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Calendar Events Table
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    is_all_day BOOLEAN DEFAULT FALSE,
    posted_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS set_timestamp_calendar_events ON calendar_events;
CREATE TRIGGER set_timestamp_calendar_events
BEFORE UPDATE ON calendar_events
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Fee Categories Table
CREATE TABLE IF NOT EXISTS fee_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    amount NUMERIC, -- Optional default amount
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, name)
);
DROP TRIGGER IF EXISTS set_timestamp_fee_categories ON fee_categories;
CREATE TRIGGER set_timestamp_fee_categories
BEFORE UPDATE ON fee_categories
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Student Fee Payments Table
CREATE TABLE IF NOT EXISTS student_fee_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    fee_category_id UUID NOT NULL REFERENCES fee_categories(id) ON DELETE RESTRICT,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    assigned_amount NUMERIC NOT NULL,
    paid_amount NUMERIC DEFAULT 0,
    due_date DATE,
    payment_date DATE,
    status payment_status_enum NOT NULL DEFAULT 'Pending',
    notes TEXT,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS set_timestamp_student_fee_payments ON student_fee_payments;
CREATE TRIGGER set_timestamp_student_fee_payments
BEFORE UPDATE ON student_fee_payments
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Payroll Entries Table
CREATE TABLE IF NOT EXISTS payroll_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    designation TEXT NOT NULL, -- Denormalized from employee's role_title for historical record
    basic_salary NUMERIC NOT NULL,
    payment_date DATE,
    status payroll_status_enum NOT NULL DEFAULT 'Pending',
    month INT, -- e.g., 1 for Jan, 12 for Dec
    year INT,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS set_timestamp_payroll_entries ON payroll_entries;
CREATE TRIGGER set_timestamp_payroll_entries
BEFORE UPDATE ON payroll_entries
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Class Schedules Table
CREATE TABLE IF NOT EXISTS class_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE, -- Teacher taking this specific period
    day_of_week day_of_week_enum NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_id, day_of_week, start_time) -- Prevent overlapping schedules for same class
);
DROP TRIGGER IF EXISTS set_timestamp_class_schedules ON class_schedules;
CREATE TRIGGER set_timestamp_class_schedules
BEFORE UPDATE ON class_schedules
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- LMS Courses Table
CREATE TABLE IF NOT EXISTS lms_courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    is_paid BOOLEAN DEFAULT FALSE,
    price NUMERIC,
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL, -- Optional: if courses can be school-specific
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS set_timestamp_lms_courses ON lms_courses;
CREATE TRIGGER set_timestamp_lms_courses
BEFORE UPDATE ON lms_courses
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- LMS Course Resources Table
CREATE TABLE IF NOT EXISTS lms_course_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type course_resource_type_enum NOT NULL,
    url_or_content TEXT NOT NULL,
    file_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS set_timestamp_lms_course_resources ON lms_course_resources;
CREATE TRIGGER set_timestamp_lms_course_resources
BEFORE UPDATE ON lms_course_resources
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- LMS Course Activation Codes Table
CREATE TABLE IF NOT EXISTS lms_course_activation_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    code TEXT UNIQUE NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    generated_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiry_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
DROP TRIGGER IF EXISTS set_timestamp_lms_course_activation_codes ON lms_course_activation_codes;
CREATE TRIGGER set_timestamp_lms_course_activation_codes
BEFORE UPDATE ON lms_course_activation_codes
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- LMS Student Course Enrollments (Join Table)
CREATE TABLE IF NOT EXISTS lms_student_course_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, course_id)
);
DROP TRIGGER IF EXISTS set_timestamp_lms_student_course_enrollments ON lms_student_course_enrollments;
CREATE TRIGGER set_timestamp_lms_student_course_enrollments
BEFORE UPDATE ON lms_student_course_enrollments
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- LMS Teacher Course Enrollments (Join Table)
CREATE TABLE IF NOT EXISTS lms_teacher_course_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(teacher_id, course_id)
);
DROP TRIGGER IF EXISTS set_timestamp_lms_teacher_course_enrollments ON lms_teacher_course_enrollments;
CREATE TRIGGER set_timestamp_lms_teacher_course_enrollments
BEFORE UPDATE ON lms_teacher_course_enrollments
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

-- Admission Records Table
CREATE TABLE IF NOT EXISTS admission_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    date_of_birth DATE,
    guardian_name TEXT,
    contact_number TEXT,
    address TEXT,
    admission_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status admission_status_enum NOT NULL DEFAULT 'Pending Review',
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL, -- Target class for admission
    student_profile_id UUID UNIQUE REFERENCES students(id) ON DELETE SET NULL, -- Link to student profile once created
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(email, school_id, class_id) -- Assuming email unique per school and target class for an admission cycle
);
DROP TRIGGER IF EXISTS set_timestamp_admission_records ON admission_records;
CREATE TRIGGER set_timestamp_admission_records
BEFORE UPDATE ON admission_records
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


-- Attendance Records Table
CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status attendance_status_enum NOT NULL,
    remarks TEXT,
    taken_by_teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, class_id, date)
);
DROP TRIGGER IF EXISTS set_timestamp_attendance_records ON attendance_records;
CREATE TRIGGER set_timestamp_attendance_records
BEFORE UPDATE ON attendance_records
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();


-- RLS Policies (Basic examples, tighten these for production)
-- Ensure RLS is enabled on tables in Supabase UI first.

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read access to users for login" ON users;
CREATE POLICY "Allow anon read access to users for login" ON users FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow anon insert for superadmin creation" ON users;
CREATE POLICY "Allow anon insert for superadmin creation" ON users FOR INSERT TO anon WITH CHECK (role = 'superadmin');
DROP POLICY IF EXISTS "Allow auth users to read their own data" ON users;
CREATE POLICY "Allow auth users to read their own data" ON users FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "Allow auth users to update their own name" ON users;
CREATE POLICY "Allow auth users to update their own name" ON users FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Allow superadmin full access" ON users;
CREATE POLICY "Allow superadmin full access" ON users TO service_role USING (true) WITH CHECK (true); -- For service role full access
-- More specific policies for admin, teacher etc. to manage users within their school needed.


ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read access to schools" ON schools;
CREATE POLICY "Allow anon read access to schools" ON schools FOR SELECT TO anon USING (true); -- Example, adjust as needed
DROP POLICY IF EXISTS "Allow service_role full access to schools" ON schools;
CREATE POLICY "Allow service_role full access to schools" ON schools TO service_role USING (true) WITH CHECK (true);
-- Superadmins should manage schools via service_role. Admins might see their own school.

ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anon read access to academic_years" ON academic_years;
CREATE POLICY "Allow anon read access to academic_years" ON academic_years FOR SELECT TO anon USING (true); -- Example
DROP POLICY IF EXISTS "Allow service_role full access to academic_years" ON academic_years;
CREATE POLICY "Allow service_role full access to academic_years" ON academic_years TO service_role USING (true) WITH CHECK (true);
-- Admins should manage academic years for their school.

ALTER TABLE students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to students" ON students;
CREATE POLICY "Allow public read access to students" ON students FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow teachers to create students" ON students;
CREATE POLICY "Allow teachers to create students" ON students FOR INSERT TO authenticated WITH CHECK (auth.jwt() ->> 'user_role' = 'teacher'); -- Example, role check from JWT
DROP POLICY IF EXISTS "Allow admins/teachers to update students in their school" ON students;
CREATE POLICY "Allow admins/teachers to update students in their school" ON students FOR UPDATE TO authenticated USING (
    school_id IN (
        SELECT s.school_id FROM teachers s WHERE s.user_id = auth.uid() -- teacher's school
        UNION
        SELECT sch.id FROM schools sch WHERE sch.admin_user_id = auth.uid() -- admin's school
    )
);
DROP POLICY IF EXISTS "Allow admins/teachers to delete students in their school" ON students;
CREATE POLICY "Allow admins/teachers to delete students in their school" ON students FOR DELETE TO authenticated USING (
    school_id IN (
        SELECT s.school_id FROM teachers s WHERE s.user_id = auth.uid()
        UNION
        SELECT sch.id FROM schools sch WHERE sch.admin_user_id = auth.uid()
    )
);


ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to teachers" ON teachers;
CREATE POLICY "Allow public read access to teachers" ON teachers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Allow admins to create teachers" ON teachers;
CREATE POLICY "Allow admins to create teachers" ON teachers FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM schools WHERE admin_user_id = auth.uid() AND schools.id = new.school_id) AND
    auth.jwt() ->> 'user_role' = 'admin'
);
DROP POLICY IF EXISTS "Allow admins to update teachers in their school" ON teachers;
CREATE POLICY "Allow admins to update teachers in their school" ON teachers FOR UPDATE TO authenticated USING (
    school_id IN (SELECT id FROM schools WHERE admin_user_id = auth.uid())
);
DROP POLICY IF EXISTS "Allow admins to delete teachers in their school" ON teachers;
CREATE POLICY "Allow admins to delete teachers in their school" ON teachers FOR DELETE TO authenticated USING (
    school_id IN (SELECT id FROM schools WHERE admin_user_id = auth.uid())
);


ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access to classes" ON classes;
CREATE POLICY "Allow public read access to classes" ON classes FOR SELECT TO anon, authenticated USING (true);
-- Add more specific policies for admins/teachers to manage classes within their school

ALTER TABLE class_names ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to class_names" ON class_names FOR SELECT TO anon, authenticated USING (true);
ALTER TABLE section_names ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to section_names" ON section_names FOR SELECT TO anon, authenticated USING (true);


ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to subjects" ON subjects FOR SELECT TO anon, authenticated USING (true);
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to exams" ON exams FOR SELECT TO anon, authenticated USING (true);
ALTER TABLE student_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow students to read their own scores" ON student_scores FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM students WHERE students.user_id = auth.uid() AND students.id = student_scores.student_id));
CREATE POLICY "Allow teachers to manage scores for their classes" ON student_scores FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM teachers WHERE teachers.user_id = auth.uid() AND teachers.id = student_scores.recorded_by_teacher_id) -- OR check based on class teacher
) WITH CHECK (
    EXISTS (SELECT 1 FROM teachers WHERE teachers.user_id = auth.uid() AND teachers.id = new.recorded_by_teacher_id)
);


-- Add RLS for other tables similarly, focusing on school_id and user roles.
-- Example for admission_records:
ALTER TABLE admission_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow teachers to create admission records for their school" ON admission_records FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM teachers WHERE user_id = auth.uid() AND teachers.school_id = new.school_id) AND
    auth.jwt() ->> 'user_role' = 'teacher'
);
CREATE POLICY "Allow admins and teachers to view admission records for their school" ON admission_records FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM schools WHERE admin_user_id = auth.uid() AND schools.id = admission_records.school_id) OR -- Admin
    EXISTS (SELECT 1 FROM teachers WHERE user_id = auth.uid() AND teachers.school_id = admission_records.school_id) -- Teacher
);

-- Policies for LMS tables
ALTER TABLE lms_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to LMS courses" ON lms_courses FOR SELECT TO anon, authenticated USING (true);
-- Admins should be able to manage courses, perhaps school-specific ones.

ALTER TABLE lms_course_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow enrolled users to view course resources" ON lms_course_resources FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM lms_student_course_enrollments s_enrl JOIN students s ON s.id = s_enrl.student_id WHERE s.user_id = auth.uid() AND s_enrl.course_id = lms_course_resources.course_id) OR
    EXISTS (SELECT 1 FROM lms_teacher_course_enrollments t_enrl JOIN teachers t ON t.id = t_enrl.teacher_id WHERE t.user_id = auth.uid() AND t_enrl.course_id = lms_course_resources.course_id)
);

ALTER TABLE lms_course_activation_codes ENABLE ROW LEVEL SECURITY;
-- Service role or specific admin role should manage these. Users might use them.

ALTER TABLE lms_student_course_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow students to manage their own LMS enrollments" ON lms_student_course_enrollments FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM students WHERE students.user_id = auth.uid() AND students.id = lms_student_course_enrollments.student_id)
) WITH CHECK (
    EXISTS (SELECT 1 FROM students WHERE students.user_id = auth.uid() AND students.id = new.student_id)
);

ALTER TABLE lms_teacher_course_enrollments ENABLE ROW LEVEL SECURITY;
-- Admins might assign teachers to courses.


-- Remember to enable RLS for each table in the Supabase Dashboard too.
-- These RLS policies are basic and need to be thoroughly reviewed and extended for security.
-- Using auth.jwt()->>'user_role' = 'admin' is a common pattern but ensure your JWT is configured to include user_role.
-- Alternatively, join with the users table to check roles for more complex policies.

-- Final check on column types if uuid-ossp is used for id defaults (it is).
-- Ensure schools.admin_user_id is properly linked after user creation.
-- Ensure students.class_id, teachers.class_id (if any) link to classes.id

-- Add a school_id to users table if users are strictly scoped to one school (other than superadmin)
-- ALTER TABLE users ADD COLUMN school_id UUID REFERENCES schools(id) ON DELETE SET NULL;
-- This would simplify many RLS policies. For now, profiles (students, teachers, employees) link to school.
