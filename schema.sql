-- Enum Types
DROP TYPE IF EXISTS user_role_enum CASCADE;
CREATE TYPE user_role_enum AS ENUM ('superadmin', 'admin', 'teacher', 'student');

DROP TYPE IF EXISTS school_status_enum CASCADE;
CREATE TYPE school_status_enum AS ENUM ('Active', 'Inactive');

DROP TYPE IF EXISTS attendance_status_enum CASCADE;
CREATE TYPE attendance_status_enum AS ENUM ('Present', 'Absent', 'Late', 'Excused');

DROP TYPE IF EXISTS leave_request_status_enum CASCADE;
CREATE TYPE leave_request_status_enum AS ENUM ('Pending AI Review', 'Approved', 'Rejected');

DROP TYPE IF EXISTS payment_status_enum CASCADE;
CREATE TYPE payment_status_enum AS ENUM ('Pending', 'Paid', 'Partially Paid', 'Overdue', 'Failed');

DROP TYPE IF EXISTS day_of_week_enum CASCADE;
CREATE TYPE day_of_week_enum AS ENUM ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');

DROP TYPE IF EXISTS course_resource_type_enum CASCADE;
CREATE TYPE course_resource_type_enum AS ENUM ('ebook', 'video', 'note', 'webinar');

DROP TYPE IF EXISTS admission_status_enum CASCADE;
CREATE TYPE admission_status_enum AS ENUM ('Pending Review', 'Admitted', 'Enrolled', 'Rejected');


-- Trigger function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Schools Table
DROP TABLE IF EXISTS schools CASCADE;
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    admin_email VARCHAR(255) UNIQUE NOT NULL,
    admin_name VARCHAR(255) NOT NULL,
    admin_user_id UUID UNIQUE, -- Can be null initially, linked later
    status school_status_enum NOT NULL DEFAULT 'Active',
    contact_phone VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TRIGGER set_timestamp_schools
BEFORE UPDATE ON schools
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Users Table
DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role_enum NOT NULL,
    school_id UUID, -- Optional, can be null for superadmin or if user is not school-specific
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_school FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE SET NULL
);
CREATE TRIGGER set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Add foreign key from schools to users for admin_user_id
ALTER TABLE schools
ADD CONSTRAINT fk_admin_user FOREIGN KEY(admin_user_id) REFERENCES users(id) ON DELETE SET NULL;


-- Students Table (Student Profiles)
DROP TABLE IF EXISTS students CASCADE;
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL, -- Denormalized for easier access from student profile
    email VARCHAR(255) UNIQUE NOT NULL, -- Denormalized
    class_id UUID, -- FK to classes table
    profile_picture_url TEXT,
    date_of_birth DATE,
    guardian_name VARCHAR(255),
    contact_number VARCHAR(50),
    address TEXT,
    admission_date DATE,
    school_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_school FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
    -- FK for class_id will be added after classes table
);
CREATE TRIGGER set_timestamp_students
BEFORE UPDATE ON students
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Teachers Table (Teacher Profiles)
DROP TABLE IF EXISTS teachers CASCADE;
CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL, -- Denormalized
    email VARCHAR(255) UNIQUE NOT NULL, -- Denormalized
    subject VARCHAR(255),
    profile_picture_url TEXT,
    school_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_school FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
);
CREATE TRIGGER set_timestamp_teachers
BEFORE UPDATE ON teachers
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Academic Years Table
DROP TABLE IF EXISTS academic_years CASCADE;
CREATE TABLE academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    school_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_school FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
    CONSTRAINT unique_academic_year_name_per_school UNIQUE (name, school_id),
    CONSTRAINT check_dates CHECK (start_date < end_date)
);
CREATE TRIGGER set_timestamp_academic_years
BEFORE UPDATE ON academic_years
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Class Names Table (Standards, e.g., Grade 1, Grade 10)
DROP TABLE IF EXISTS class_names CASCADE;
CREATE TABLE class_names (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    school_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_school FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
    CONSTRAINT unique_class_name_per_school UNIQUE (name, school_id)
);
CREATE TRIGGER set_timestamp_class_names
BEFORE UPDATE ON class_names
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Section Names Table (Divisions, e.g., A, B, Blue)
DROP TABLE IF EXISTS section_names CASCADE;
CREATE TABLE section_names (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    school_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_school FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
    CONSTRAINT unique_section_name_per_school UNIQUE (name, school_id)
);
CREATE TRIGGER set_timestamp_section_names
BEFORE UPDATE ON section_names
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Classes Table (Activated Class-Sections)
DROP TABLE IF EXISTS classes CASCADE;
CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL, -- Denormalized, e.g., "Grade 10 - A"
    division VARCHAR(100) NOT NULL, -- Denormalized, e.g., "A"
    class_name_id UUID NOT NULL,
    section_name_id UUID NOT NULL,
    teacher_id UUID, -- FK to teachers table (teacher's profile ID)
    academic_year_id UUID,
    school_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_class_name FOREIGN KEY(class_name_id) REFERENCES class_names(id) ON DELETE CASCADE,
    CONSTRAINT fk_section_name FOREIGN KEY(section_name_id) REFERENCES section_names(id) ON DELETE CASCADE,
    CONSTRAINT fk_teacher FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE SET NULL,
    CONSTRAINT fk_academic_year FOREIGN KEY(academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
    CONSTRAINT fk_school FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
    CONSTRAINT unique_class_section_year_school UNIQUE (class_name_id, section_name_id, academic_year_id, school_id)
);
CREATE TRIGGER set_timestamp_classes
BEFORE UPDATE ON classes
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Add FK from students to classes
ALTER TABLE students
ADD CONSTRAINT fk_class FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE SET NULL;

-- Subjects Table
DROP TABLE IF EXISTS subjects CASCADE;
CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NOT NULL,
    academic_year_id UUID,
    school_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_academic_year FOREIGN KEY(academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
    CONSTRAINT fk_school FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
    CONSTRAINT unique_subject_code_school UNIQUE (code, school_id)
);
CREATE TRIGGER set_timestamp_subjects
BEFORE UPDATE ON subjects
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Exams Table
DROP TABLE IF EXISTS exams CASCADE;
CREATE TABLE exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subject_id UUID NOT NULL,
    class_id UUID, -- Optional: if exam is specific to a class-section
    academic_year_id UUID,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    max_marks NUMERIC,
    school_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_subject FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    CONSTRAINT fk_class FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE SET NULL,
    CONSTRAINT fk_academic_year FOREIGN KEY(academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
    CONSTRAINT fk_school FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
);
CREATE TRIGGER set_timestamp_exams
BEFORE UPDATE ON exams
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Student Scores Table
DROP TABLE IF EXISTS student_scores CASCADE;
CREATE TABLE student_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    exam_id UUID NOT NULL,
    subject_id UUID NOT NULL, -- Denormalized from exam for easier querying
    class_id UUID NOT NULL, -- Class of student at time of exam
    score TEXT NOT NULL, -- Can be numeric or grade like 'A+'
    max_marks NUMERIC, -- Denormalized from exam
    recorded_by_teacher_id UUID NOT NULL, -- Teacher's profile ID
    date_recorded DATE NOT NULL,
    comments TEXT,
    school_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_student FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT fk_exam FOREIGN KEY(exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    CONSTRAINT fk_subject FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    CONSTRAINT fk_class FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_teacher FOREIGN KEY(recorded_by_teacher_id) REFERENCES teachers(id) ON DELETE RESTRICT,
    CONSTRAINT fk_school FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
    CONSTRAINT unique_student_exam_score UNIQUE (student_id, exam_id, class_id, school_id)
);
CREATE TRIGGER set_timestamp_student_scores
BEFORE UPDATE ON student_scores
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Assignments Table
DROP TABLE IF EXISTS assignments CASCADE;
CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    class_id UUID NOT NULL,
    teacher_id UUID NOT NULL, -- Teacher's profile ID
    subject_id UUID,
    school_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_class FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_teacher FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    CONSTRAINT fk_subject FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE SET NULL,
    CONSTRAINT fk_school FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
);
CREATE TRIGGER set_timestamp_assignments
BEFORE UPDATE ON assignments
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Leave Applications Table
DROP TABLE IF EXISTS leave_applications CASCADE;
CREATE TABLE leave_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_profile_id UUID NOT NULL,
    student_name VARCHAR(255) NOT NULL, -- Name from form, may not match user name if applied by parent/teacher
    reason TEXT NOT NULL,
    medical_notes_data_uri TEXT,
    submission_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status leave_request_status_enum NOT NULL DEFAULT 'Pending AI Review',
    ai_reasoning TEXT,
    applicant_user_id UUID NOT NULL, -- User who submitted the application
    applicant_role user_role_enum NOT NULL,
    school_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_student_profile FOREIGN KEY(student_profile_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT fk_applicant_user FOREIGN KEY(applicant_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_school FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
);
CREATE TRIGGER set_timestamp_leave_applications
BEFORE UPDATE ON leave_applications
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Announcements Table
DROP TABLE IF EXISTS announcements CASCADE;
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    author_name VARCHAR(255) NOT NULL,
    posted_by_user_id UUID NOT NULL,
    posted_by_role user_role_enum NOT NULL,
    target_class_id UUID,
    school_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_posted_by_user FOREIGN KEY(posted_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_target_class FOREIGN KEY(target_class_id) REFERENCES classes(id) ON DELETE SET NULL,
    CONSTRAINT fk_school FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
);
CREATE TRIGGER set_timestamp_announcements
BEFORE UPDATE ON announcements
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Calendar Events Table
DROP TABLE IF EXISTS calendar_events CASCADE;
CREATE TABLE calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
    posted_by_user_id UUID NOT NULL,
    school_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_posted_by_user FOREIGN KEY(posted_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_school FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
);
CREATE TRIGGER set_timestamp_calendar_events
BEFORE UPDATE ON calendar_events
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Admission Records Table
DROP TABLE IF EXISTS admission_records CASCADE;
CREATE TABLE admission_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    date_of_birth DATE,
    guardian_name VARCHAR(255),
    contact_number VARCHAR(50),
    address TEXT,
    admission_date DATE NOT NULL,
    status admission_status_enum NOT NULL,
    class_id UUID, -- Target class
    student_profile_id UUID UNIQUE, -- Link to student profile once created
    school_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_class FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE SET NULL,
    CONSTRAINT fk_student_profile FOREIGN KEY(student_profile_id) REFERENCES students(id) ON DELETE SET NULL,
    CONSTRAINT fk_school FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
);
CREATE TRIGGER set_timestamp_admission_records
BEFORE UPDATE ON admission_records
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Class Schedules Table
DROP TABLE IF EXISTS class_schedules CASCADE;
CREATE TABLE class_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL,
    subject_id UUID NOT NULL,
    teacher_id UUID NOT NULL, -- Teacher's profile ID
    day_of_week day_of_week_enum NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    school_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_class FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_subject FOREIGN KEY(subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    CONSTRAINT fk_teacher FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    CONSTRAINT fk_school FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
    CONSTRAINT check_schedule_time CHECK (start_time < end_time)
);
CREATE TRIGGER set_timestamp_class_schedules
BEFORE UPDATE ON class_schedules
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Attendance Records Table
DROP TABLE IF EXISTS attendance_records CASCADE;
CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    class_id UUID NOT NULL,
    date DATE NOT NULL,
    status attendance_status_enum NOT NULL,
    remarks TEXT,
    taken_by_teacher_id UUID NOT NULL, -- Teacher's profile ID
    school_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_student FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT fk_class FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_teacher FOREIGN KEY(taken_by_teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    CONSTRAINT fk_school FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
    CONSTRAINT unique_student_attendance_date UNIQUE (student_id, class_id, date, school_id)
);
CREATE TRIGGER set_timestamp_attendance_records
BEFORE UPDATE ON attendance_records
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Fee Categories Table
DROP TABLE IF EXISTS fee_categories CASCADE;
CREATE TABLE fee_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    amount NUMERIC,
    school_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_school FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE,
    CONSTRAINT unique_fee_category_name_school UNIQUE (name, school_id)
);
CREATE TRIGGER set_timestamp_fee_categories
BEFORE UPDATE ON fee_categories
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Student Fee Payments Table
DROP TABLE IF EXISTS student_fee_payments CASCADE;
CREATE TABLE student_fee_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL,
    fee_category_id UUID NOT NULL,
    academic_year_id UUID,
    assigned_amount NUMERIC NOT NULL,
    paid_amount NUMERIC NOT NULL DEFAULT 0,
    due_date DATE,
    payment_date DATE,
    status payment_status_enum NOT NULL DEFAULT 'Pending',
    notes TEXT,
    school_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_student FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT fk_fee_category FOREIGN KEY(fee_category_id) REFERENCES fee_categories(id) ON DELETE CASCADE,
    CONSTRAINT fk_academic_year FOREIGN KEY(academic_year_id) REFERENCES academic_years(id) ON DELETE SET NULL,
    CONSTRAINT fk_school FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
);
CREATE TRIGGER set_timestamp_student_fee_payments
BEFORE UPDATE ON student_fee_payments
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- LMS Courses Table
DROP TABLE IF EXISTS lms_courses CASCADE;
CREATE TABLE lms_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    is_paid BOOLEAN NOT NULL DEFAULT FALSE,
    price NUMERIC,
    school_id UUID, -- Optional: if course is school-specific
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_school FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE SET NULL
);
CREATE TRIGGER set_timestamp_lms_courses
BEFORE UPDATE ON lms_courses
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- LMS Course Resources Table
DROP TABLE IF EXISTS lms_course_resources CASCADE;
CREATE TABLE lms_course_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    type course_resource_type_enum NOT NULL,
    url_or_content TEXT NOT NULL,
    file_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_course FOREIGN KEY(course_id) REFERENCES lms_courses(id) ON DELETE CASCADE
);
CREATE TRIGGER set_timestamp_lms_course_resources
BEFORE UPDATE ON lms_course_resources
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- LMS Course Activation Codes Table
DROP TABLE IF EXISTS lms_course_activation_codes CASCADE;
CREATE TABLE lms_course_activation_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL,
    code VARCHAR(255) UNIQUE NOT NULL,
    is_used BOOLEAN NOT NULL DEFAULT FALSE,
    used_by_user_id UUID,
    generated_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiry_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_course FOREIGN KEY(course_id) REFERENCES lms_courses(id) ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY(used_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);
CREATE TRIGGER set_timestamp_lms_course_activation_codes
BEFORE UPDATE ON lms_course_activation_codes
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- LMS Student Course Enrollments Table
DROP TABLE IF EXISTS lms_student_course_enrollments CASCADE;
CREATE TABLE lms_student_course_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL, -- Student's profile ID
    course_id UUID NOT NULL,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_student FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE,
    CONSTRAINT fk_course FOREIGN KEY(course_id) REFERENCES lms_courses(id) ON DELETE CASCADE,
    UNIQUE (student_id, course_id)
);

-- LMS Teacher Course Enrollments Table (Teachers assigned to courses)
DROP TABLE IF EXISTS lms_teacher_course_enrollments CASCADE;
CREATE TABLE lms_teacher_course_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL, -- Teacher's profile ID
    course_id UUID NOT NULL,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_teacher FOREIGN KEY(teacher_id) REFERENCES teachers(id) ON DELETE CASCADE,
    CONSTRAINT fk_course FOREIGN KEY(course_id) REFERENCES lms_courses(id) ON DELETE CASCADE,
    UNIQUE (teacher_id, course_id)
);


-- Enable RLS for all tables
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_names ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_course_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_course_activation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_student_course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lms_teacher_course_enrollments ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies (adjust as needed, these are quite permissive for anon for initial setup)
-- For 'users' table: Allow anon to read for login, and insert for superadmin creation.
DROP POLICY IF EXISTS "Allow anon read for login" ON users;
CREATE POLICY "Allow anon read for login" ON users FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow anon insert for superadmin" ON users;
CREATE POLICY "Allow anon insert for superadmin" ON users FOR INSERT TO anon WITH CHECK (true); -- Reconsider this for production
DROP POLICY IF EXISTS "Allow authenticated users to read their own data" ON users;
CREATE POLICY "Allow authenticated users to read their own data" ON users FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "Allow users to update their own data" ON users;
CREATE POLICY "Allow users to update their own data" ON users FOR UPDATE TO authenticated USING (auth.uid() = id);

-- For 'schools' table: Allow anon to read for superadmin actions initially.
DROP POLICY IF EXISTS "Allow anon read for superadmin" ON schools;
CREATE POLICY "Allow anon read for superadmin" ON schools FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow anon CUD for superadmin" ON schools;
CREATE POLICY "Allow anon CUD for superadmin" ON schools FOR ALL TO anon USING (true) WITH CHECK (true); -- Reconsider for production

-- For 'academic_years' table:
DROP POLICY IF EXISTS "Allow anon read for academic years" ON academic_years;
CREATE POLICY "Allow anon read for academic years" ON academic_years FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Allow anon CUD for academic years" ON academic_years;
CREATE POLICY "Allow anon CUD for academic years" ON academic_years FOR ALL TO anon USING (true) WITH CHECK (true); -- Reconsider

-- Example for other tables (student can read their own scores, teacher can manage scores for their classes, admin can manage all in school)
-- Student Scores
DROP POLICY IF EXISTS "Students can view their own scores" ON student_scores;
-- CREATE POLICY "Students can view their own scores" ON student_scores
-- FOR SELECT USING (
--   EXISTS (
--     SELECT 1 FROM students
--     WHERE students.id = student_scores.student_id AND students.user_id = auth.uid()
--   )
-- );
-- Teachers can manage scores for students in their classes (simplified, assumes teacher_id on classes matches auth.uid via a join or subquery)
DROP POLICY IF EXISTS "Teachers can manage scores for their classes" ON student_scores;
-- CREATE POLICY "Teachers can manage scores for their classes" ON student_scores
-- FOR ALL USING (
--   EXISTS (
--     SELECT 1 FROM classes c JOIN teachers t ON c.teacher_id = t.id
--     WHERE c.id = student_scores.class_id AND t.user_id = auth.uid()
--   )
-- );
-- Admins can manage scores for their school
DROP POLICY IF EXISTS "Admins can manage scores for their school" ON student_scores;
-- CREATE POLICY "Admins can manage scores for their school" ON student_scores
-- FOR ALL USING (
--   EXISTS (
--     SELECT 1 FROM users u
--     WHERE u.id = auth.uid() AND u.role = 'admin' AND u.school_id = student_scores.school_id
--   )
-- );

-- Default deny if no policy matches
-- Default behavior in Supabase if RLS is enabled and no policy allows access is to deny.

-- Note: The RLS policies above are illustrative and need significant refinement for a production environment.
-- The current setup with server actions using the anon key implicitly makes these policies very open.
-- For production:
-- 1. Restrict anon access heavily (mostly to auth-related tables or public data).
-- 2. Use the service_role key for backend operations that need to bypass RLS.
-- 3. Define granular policies based on user roles (auth.role()) and user_id (auth.uid()).
