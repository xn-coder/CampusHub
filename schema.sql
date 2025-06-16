
-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing ENUM types if they exist to redefine them
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
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'leave_request_status_enum') THEN
        DROP TYPE leave_request_status_enum;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status_enum') THEN
        DROP TYPE payment_status_enum;
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

-- ENUM Definitions
CREATE TYPE user_role_enum AS ENUM ('superadmin', 'admin', 'teacher', 'student');
CREATE TYPE school_status_enum AS ENUM ('Active', 'Inactive');
CREATE TYPE attendance_status_enum AS ENUM ('Present', 'Absent', 'Late', 'Excused');
CREATE TYPE leave_request_status_enum AS ENUM ('Pending AI Review', 'Approved', 'Rejected');
CREATE TYPE payment_status_enum AS ENUM ('Pending', 'Paid', 'Partially Paid', 'Overdue', 'Failed');
CREATE TYPE day_of_week_enum AS ENUM ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
CREATE TYPE course_resource_type_enum AS ENUM ('ebook', 'video', 'note', 'webinar');
CREATE TYPE admission_status_enum AS ENUM ('Pending Review', 'Admitted', 'Enrolled', 'Rejected');


-- Function to update 'updated_at' timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Tables
CREATE TABLE schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    admin_email TEXT NOT NULL UNIQUE, -- Used for initial setup, might be denormalized
    admin_name TEXT NOT NULL,    -- Used for initial setup
    admin_user_id UUID UNIQUE,   -- FK to users table, link established after admin user is created
    status school_status_enum NOT NULL DEFAULT 'Active',
    contact_phone TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER trigger_schools_updated_at BEFORE UPDATE ON schools FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role user_role_enum NOT NULL,
    password_hash TEXT, -- Can be NULL if using OAuth or other auth methods not storing password here
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL, -- If user is directly tied to one school
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER trigger_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- Add FK constraint for schools.admin_user_id after users table is created
ALTER TABLE schools ADD CONSTRAINT fk_admin_user FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL;


CREATE TABLE academic_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (name, school_id),
    CONSTRAINT check_start_end_dates CHECK (start_date < end_date)
);
CREATE TRIGGER trigger_academic_years_updated_at BEFORE UPDATE ON academic_years FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE class_names (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(name, school_id)
);
CREATE TRIGGER trigger_class_names_updated_at BEFORE UPDATE ON class_names FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE section_names (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(name, school_id)
);
CREATE TRIGGER trigger_section_names_updated_at BEFORE UPDATE ON section_names FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Teacher Profile ID
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- Denormalized from users
    email TEXT NOT NULL, -- Denormalized from users
    subject TEXT,
    profile_picture_url TEXT,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER trigger_teachers_updated_at BEFORE UPDATE ON teachers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE classes ( -- Represents active class-sections
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL, -- Denormalized: e.g., "Grade 10"
    division TEXT NOT NULL, -- Denormalized: e.g., "A"
    class_name_id UUID NOT NULL REFERENCES class_names(id) ON DELETE RESTRICT,
    section_name_id UUID NOT NULL REFERENCES section_names(id) ON DELETE RESTRICT,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL, -- Teacher's Profile ID
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (class_name_id, section_name_id, school_id, academic_year_id)
);
CREATE TRIGGER trigger_classes_updated_at BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE students ( -- Student Profiles
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Student Profile ID
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- Denormalized
    email TEXT NOT NULL, -- Denormalized
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    profile_picture_url TEXT,
    date_of_birth DATE,
    guardian_name TEXT,
    contact_number TEXT,
    address TEXT,
    admission_date DATE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER trigger_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(code, school_id, academic_year_id)
);
CREATE TRIGGER trigger_subjects_updated_at BEFORE UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL, -- Optional: for class-specific exams
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    max_marks NUMERIC(5,2),
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER trigger_exams_updated_at BEFORE UPDATE ON exams FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE student_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, -- Denormalized from exam for easier query
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE, -- Class at time of exam
    score TEXT NOT NULL, -- Can be numeric or grade
    max_marks NUMERIC(5,2), -- Max marks for this specific part if exam has multiple parts, or same as exam.max_marks
    recorded_by_teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT, -- Teacher Profile ID
    date_recorded DATE NOT NULL,
    comments TEXT,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, exam_id, class_id) -- Student can only have one score for a given exam in a class
);
CREATE TRIGGER trigger_student_scores_updated_at BEFORE UPDATE ON student_scores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE, -- Teacher Profile ID
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER trigger_assignments_updated_at BEFORE UPDATE ON assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE leave_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_profile_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    student_name TEXT NOT NULL, -- Name of student this leave is for (denormalized)
    reason TEXT NOT NULL,
    medical_notes_data_uri TEXT,
    submission_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    status leave_request_status_enum NOT NULL DEFAULT 'Pending AI Review',
    ai_reasoning TEXT,
    applicant_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    applicant_role user_role_enum NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER trigger_leave_applications_updated_at BEFORE UPDATE ON leave_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    author_name TEXT NOT NULL,
    posted_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    posted_by_role user_role_enum NOT NULL,
    target_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER trigger_announcements_updated_at BEFORE UPDATE ON announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE calendar_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    is_all_day BOOLEAN NOT NULL DEFAULT false,
    posted_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER trigger_calendar_events_updated_at BEFORE UPDATE ON calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE fee_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    amount NUMERIC(10, 2), -- Optional default amount
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(name, school_id)
);
CREATE TRIGGER trigger_fee_categories_updated_at BEFORE UPDATE ON fee_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE student_fee_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    fee_category_id UUID NOT NULL REFERENCES fee_categories(id) ON DELETE RESTRICT,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE SET NULL,
    assigned_amount NUMERIC(10, 2) NOT NULL,
    paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    due_date DATE,
    payment_date DATE, -- Date of last payment
    status payment_status_enum NOT NULL DEFAULT 'Pending',
    notes TEXT,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER trigger_student_fee_payments_updated_at BEFORE UPDATE ON student_fee_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE class_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE, -- Teacher Profile ID
    day_of_week day_of_week_enum NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(class_id, day_of_week, start_time, school_id),
    CONSTRAINT check_start_end_time_schedule CHECK (start_time < end_time)
);
CREATE TRIGGER trigger_class_schedules_updated_at BEFORE UPDATE ON class_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    status attendance_status_enum NOT NULL,
    remarks TEXT,
    taken_by_teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE RESTRICT, -- Teacher Profile ID
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, class_id, date)
);
CREATE TRIGGER trigger_attendance_records_updated_at BEFORE UPDATE ON attendance_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE admission_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    date_of_birth DATE,
    guardian_name TEXT,
    contact_number TEXT,
    address TEXT,
    admission_date DATE NOT NULL,
    status admission_status_enum NOT NULL,
    class_id UUID REFERENCES classes(id) ON DELETE SET NULL, -- Target class for admission
    student_profile_id UUID UNIQUE REFERENCES students(id) ON DELETE SET NULL, -- Link to student profile once enrolled
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER trigger_admission_records_updated_at BEFORE UPDATE ON admission_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- LMS Tables
CREATE TABLE lms_courses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    is_paid BOOLEAN NOT NULL DEFAULT false,
    price NUMERIC(10, 2) CHECK (is_paid = false OR price IS NOT NULL AND price > 0),
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL, -- Can be global (NULL school_id)
    created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL, -- Creator of the course
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER trigger_lms_courses_updated_at BEFORE UPDATE ON lms_courses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE lms_course_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    type course_resource_type_enum NOT NULL,
    url_or_content TEXT NOT NULL,
    file_name TEXT, -- If it's an uploaded file, store original name
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER trigger_lms_course_resources_updated_at BEFORE UPDATE ON lms_course_resources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE lms_course_activation_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    is_used BOOLEAN NOT NULL DEFAULT false,
    used_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    generated_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    expiry_date TIMESTAMPTZ,
    school_id UUID REFERENCES schools(id) ON DELETE SET NULL, -- For school-specific codes for a global course
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TRIGGER trigger_lms_course_activation_codes_updated_at BEFORE UPDATE ON lms_course_activation_codes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE lms_student_course_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE, -- Student Profile ID
    course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE, -- School of the student
    enrolled_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(student_id, course_id)
);
CREATE TRIGGER trigger_lms_student_course_enrollments_updated_at BEFORE UPDATE ON lms_student_course_enrollments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE lms_teacher_course_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE, -- Teacher Profile ID
    course_id UUID NOT NULL REFERENCES lms_courses(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE, -- School of the teacher
    assigned_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(teacher_id, course_id)
);
CREATE TRIGGER trigger_lms_teacher_course_enrollments_updated_at BEFORE UPDATE ON lms_teacher_course_enrollments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- RLS Policies --
-- Note: These are basic policies. Production environments need more granular security.
-- Service role key bypasses RLS, so server actions using it will work.
-- Anon key (client-side) access needs to be carefully managed.

-- schools table
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Schools are publicly viewable." ON schools FOR SELECT USING (true);
-- Mutations typically done by superadmin via service_role.

-- users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own user record." ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own user record." ON users FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
-- Superadmin (via service_role) can manage all users.
-- Allow anon to attempt to read user for login, but not list all users.
CREATE POLICY "Anon can read specific user for login by email (limited columns)." ON users FOR SELECT TO anon USING (true); -- This is broad, be careful. In a real app, you might use a security definer function.
-- Allow anon to insert for superadmin creation script
CREATE POLICY "Anon can insert new users (for superadmin script only)." ON users FOR INSERT TO anon WITH CHECK (true);


-- academic_years table
ALTER TABLE academic_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Academic years are publicly viewable." ON academic_years FOR SELECT USING (true);
-- Mutations by admin via service_role.

-- class_names table
ALTER TABLE class_names ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Class names are publicly viewable." ON class_names FOR SELECT USING (true);
-- Mutations by admin via service_role.

-- section_names table
ALTER TABLE section_names ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Section names are publicly viewable." ON section_names FOR SELECT USING (true);
-- Mutations by admin via service_role.

-- teachers table
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teacher profiles are publicly viewable." ON teachers FOR SELECT USING (true);
CREATE POLICY "Teachers can update their own profile." ON teachers FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Creation/deletion by admin via service_role.

-- classes table
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active classes are publicly viewable." ON classes FOR SELECT USING (true);
-- Mutations by admin via service_role.

-- students table
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view their own profile." ON students FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Students can update limited fields of their own profile." ON students FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id); -- Specify columns if needed
-- Teachers and admins can view students in their school/classes (complex RLS, often handled by server logic).
CREATE POLICY "Admins/Teachers can view students of their school (simplified)." ON students FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.school_id = students.school_id AND (u.role = 'admin' OR u.role = 'teacher'))
    OR students.school_id IS NULL -- Or global students if any (unlikely for this app)
);
-- Creation/deletion by admin/teacher via service_role or specific actions.

-- subjects table
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Subjects are publicly viewable." ON subjects FOR SELECT USING (true);
-- Mutations by admin via service_role.

-- exams table
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Exams are publicly viewable." ON exams FOR SELECT USING (true);
-- Mutations by admin via service_role.

-- student_scores table
ALTER TABLE student_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view their own scores." ON student_scores FOR SELECT USING (EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.user_id = auth.uid()));
CREATE POLICY "Teachers can manage scores for students in their school." ON student_scores FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.school_id = student_scores.school_id AND u.role = 'teacher')
);
-- Admins can also manage all scores via service_role.

-- assignments table
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assignments can be viewed by students of the target class or by school staff." ON assignments FOR SELECT USING (
    EXISTS (SELECT 1 FROM students s WHERE s.user_id = auth.uid() AND s.class_id = assignments.class_id) -- Student in class
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.school_id = assignments.school_id AND (u.role = 'admin' OR u.role = 'teacher')) -- School staff
);
CREATE POLICY "Teachers can manage assignments for their school." ON assignments FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.school_id = assignments.school_id AND u.role = 'teacher')
    AND teacher_id = (SELECT t.id FROM teachers t WHERE t.user_id = auth.uid() LIMIT 1) -- Teacher owns assignment
) WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.school_id = assignments.school_id AND u.role = 'teacher')
    AND teacher_id = (SELECT t.id FROM teachers t WHERE t.user_id = auth.uid() LIMIT 1)
);
-- Admins via service_role.


-- leave_applications table
ALTER TABLE leave_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own leave applications (or for their students if teacher/admin)." ON leave_applications FOR ALL USING (auth.uid() = applicant_user_id);
CREATE POLICY "Admins and relevant teachers can view leave applications." ON leave_applications FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.school_id = leave_applications.school_id AND u.role = 'admin')
    OR EXISTS (
        SELECT 1 FROM students s
        JOIN classes c ON s.class_id = c.id
        JOIN users u_teacher ON c.teacher_id = (SELECT t.id from teachers t where t.user_id = u_teacher.id) -- This join needs to be user_id to teachers.id
        WHERE s.id = leave_applications.student_profile_id AND u_teacher.id = auth.uid() AND u_teacher.role = 'teacher'
    )
);
-- More specific teacher RLS would involve joining students to classes to teachers.

-- announcements table
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Announcements are publicly viewable or targeted." ON announcements FOR SELECT USING (
    target_class_id IS NULL -- General announcement
    OR EXISTS (SELECT 1 FROM students s WHERE s.user_id = auth.uid() AND s.class_id = announcements.target_class_id) -- Student in target class
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.school_id = announcements.school_id AND (u.role = 'admin' OR u.role = 'teacher')) -- Staff of school
);
-- Mutations by authorized roles via service_role or specific checks.

-- calendar_events table
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Calendar events are publicly viewable for the school." ON calendar_events FOR SELECT USING (true); -- Simplified, could be school-specific
-- Mutations by authorized roles via service_role.

-- fee_categories table
ALTER TABLE fee_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Fee categories are publicly viewable." ON fee_categories FOR SELECT USING (true);
-- Mutations by admin via service_role.

-- student_fee_payments table
ALTER TABLE student_fee_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view their own fee payments." ON student_fee_payments FOR SELECT USING (EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.user_id = auth.uid()));
-- Admin/staff can view all for their school.
CREATE POLICY "School staff can view all fee payments for their school." ON student_fee_payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.school_id = student_fee_payments.school_id AND (u.role = 'admin' OR u.role = 'teacher')) -- Teacher might need to see too
);
-- Mutations by admin via service_role.

-- class_schedules table
ALTER TABLE class_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Class schedules are publicly viewable." ON class_schedules FOR SELECT USING (true);
-- Mutations by admin via service_role.

-- attendance_records table
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view their own attendance." ON attendance_records FOR SELECT USING (EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.user_id = auth.uid()));
CREATE POLICY "Teachers can manage attendance for their school." ON attendance_records FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.school_id = attendance_records.school_id AND u.role = 'teacher')
);
-- Admin via service_role.

-- admission_records table
ALTER TABLE admission_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage all admission records." ON admission_records FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.school_id = admission_records.school_id AND u.role = 'admin')
);
CREATE POLICY "Teachers can view admission records for their school (limited scope)." ON admission_records FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.school_id = admission_records.school_id AND u.role = 'teacher')
);


-- LMS RLS Policies
ALTER TABLE lms_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "LMS courses are publicly viewable." ON lms_courses FOR SELECT USING (true);
CREATE POLICY "Course creators or admins can manage their courses." ON lms_courses FOR ALL USING (
    auth.uid() = created_by_user_id
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin' AND (u.school_id = lms_courses.school_id OR lms_courses.school_id IS NULL))
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'superadmin')
);


ALTER TABLE lms_course_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enrolled users or course managers can view resources." ON lms_course_resources FOR SELECT USING (
    EXISTS (SELECT 1 FROM lms_student_course_enrollments sce JOIN students s ON sce.student_id = s.id WHERE sce.course_id = lms_course_resources.course_id AND s.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM lms_teacher_course_enrollments tce JOIN teachers t ON tce.teacher_id = t.id WHERE tce.course_id = lms_course_resources.course_id AND t.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM lms_courses lc WHERE lc.id = lms_course_resources.course_id AND lc.created_by_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users u JOIN lms_courses lc ON u.school_id = lc.school_id OR lc.school_id IS NULL WHERE u.id = auth.uid() AND u.role = 'admin' AND lc.id = lms_course_resources.course_id)
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'superadmin')
);
CREATE POLICY "Course managers can manage resources." ON lms_course_resources FOR ALL USING (
    EXISTS (SELECT 1 FROM lms_courses lc WHERE lc.id = lms_course_resources.course_id AND lc.created_by_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users u JOIN lms_courses lc ON u.school_id = lc.school_id OR lc.school_id IS NULL WHERE u.id = auth.uid() AND u.role = 'admin' AND lc.id = lms_course_resources.course_id)
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'superadmin')
);


ALTER TABLE lms_course_activation_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin/Superadmin can manage activation codes." ON lms_course_activation_codes FOR ALL USING (
    EXISTS (SELECT 1 FROM users u JOIN lms_courses lc ON (u.school_id = lc.school_id OR lc.school_id IS NULL) WHERE u.id = auth.uid() AND lc.id = lms_course_activation_codes.course_id AND u.role = 'admin')
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'superadmin')
);
-- Allow specific code lookup if needed, but generally codes are managed by admins.

ALTER TABLE lms_student_course_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view their own enrollments." ON lms_student_course_enrollments FOR SELECT USING (EXISTS (SELECT 1 FROM students s WHERE s.id = student_id AND s.user_id = auth.uid()));
CREATE POLICY "Admins/Teachers can manage student enrollments for their school/courses." ON lms_student_course_enrollments FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.school_id = lms_student_course_enrollments.school_id AND (u.role = 'admin' OR u.role = 'teacher'))
);

ALTER TABLE lms_teacher_course_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Teachers can view their own enrollments." ON lms_teacher_course_enrollments FOR SELECT USING (EXISTS (SELECT 1 FROM teachers t WHERE t.id = teacher_id AND t.user_id = auth.uid()));
CREATE POLICY "Admins can manage teacher enrollments." ON lms_teacher_course_enrollments FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.school_id = lms_teacher_course_enrollments.school_id AND u.role = 'admin')
);

-- Ensure RLS is enforced for public schema by default
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM public;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM public;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM public;

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role; -- Service role bypasses RLS
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Grant basic select for anon/authenticated where RLS policies allow
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
-- For insert/update/delete, RLS policies WITH CHECK or USING auth.uid() will gate access.
-- Specific insert/update/delete grants can be added if anon/authenticated need direct DML (uncommon for anon).
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;


-- Seed Superadmin (if not exists, to be run once or handled by app logic on startup)
-- This should ideally be run by your application startup logic if ensureSuperAdminExists is used.
-- Or run manually once. The app's ensureSuperAdminExists function handles this now.
-- INSERT INTO users (email, name, role, password_hash)
-- SELECT 'superadmin@campushub.com', 'Super Admin', 'superadmin', crypt('password', gen_salt('bf'))
-- WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'superadmin@campushub.com');
```