-- Create custom enum types for roles and statuses to ensure data integrity.

-- User Role Enum
CREATE TYPE public.user_role_enum AS ENUM (
    'superadmin',
    'admin',
    'teacher',
    'student',
    'accountant'
);

-- School Status Enum
CREATE TYPE public.school_status_enum AS ENUM (
    'Active',
    'Inactive'
);

-- Gender Enum
CREATE TYPE public.gender_enum AS ENUM (
    'Male',
    'Female',
    'Other'
);

-- Attendance Status Enum
CREATE TYPE public.attendance_status_enum AS ENUM (
    'Present',
    'Absent',
    'Late',
    'Excused'
);

-- Leave Request Status Enum
CREATE TYPE public.leave_request_status_enum AS ENUM (
    'Pending',
    'Approved',
    'Rejected'
);

-- Payment Status Enum
CREATE TYPE public.payment_status_enum AS ENUM (
    'Pending',
    'Paid',
    'Partially Paid',
    'Overdue',
    'Failed'
);

-- Course Resource Type Enum
CREATE TYPE public.course_resource_type_enum AS ENUM (
    'ebook',
    'video',
    'note',
    'webinar',
    'quiz',
    'ppt'
);

-- Admission Status Enum
CREATE TYPE public.admission_status_enum AS ENUM (
    'Pending Review',
    'Admitted',
    'Enrolled',
    'Rejected'
);

-- TC Request Status Enum
CREATE TYPE public.tc_request_status_enum AS ENUM (
    'Pending',
    'Approved',
    'Rejected'
);


-- =================================================================
-- CORE TABLES
-- =================================================================

-- Table for schools
CREATE TABLE public.schools (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name character varying NOT NULL,
    address character varying,
    admin_email character varying NOT NULL,
    admin_name character varying NOT NULL,
    admin_user_id uuid,
    status public.school_status_enum NOT NULL DEFAULT 'Active'::school_status_enum,
    contact_email character varying,
    contact_phone character varying,
    logo_url character varying,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT schools_pkey PRIMARY KEY (id),
    CONSTRAINT schools_admin_email_key UNIQUE (admin_email)
);
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- Table for all users
CREATE TABLE public.users (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    email character varying NOT NULL,
    name character varying NOT NULL,
    role public.user_role_enum NOT NULL,
    password_hash character varying NOT NULL,
    school_id uuid,
    status public.school_status_enum NOT NULL DEFAULT 'Active'::school_status_enum,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE SET NULL
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ADD CONSTRAINT schools_admin_user_id_fkey FOREIGN KEY (admin_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


-- =================================================================
-- PROFILE TABLES
-- =================================================================

-- Students table
CREATE TABLE public.students (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL,
    school_id uuid NOT NULL,
    class_id uuid,
    academic_year_id uuid,
    name character varying NOT NULL,
    email character varying NOT NULL,
    roll_number character varying,
    profile_picture_url character varying,
    date_of_birth date,
    gender public.gender_enum,
    nationality character varying,
    blood_group character varying,
    category character varying,
    guardian_name character varying,
    father_name character varying,
    father_occupation character varying,
    mother_name character varying,
    mother_occupation character varying,
    annual_family_income numeric,
    parent_contact_number character varying,
    contact_number character varying,
    address text,
    admission_date date,
    status public.school_status_enum NOT NULL DEFAULT 'Active'::school_status_enum,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT students_pkey PRIMARY KEY (id),
    CONSTRAINT students_user_id_key UNIQUE (user_id),
    CONSTRAINT students_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT students_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Teachers table
CREATE TABLE public.teachers (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL,
    school_id uuid NOT NULL,
    name character varying NOT NULL,
    email character varying NOT NULL,
    subject character varying,
    profile_picture_url character varying,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT teachers_pkey PRIMARY KEY (id),
    CONSTRAINT teachers_user_id_key UNIQUE (user_id),
    CONSTRAINT teachers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT teachers_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE
);
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- Accountants table
CREATE TABLE public.accountants (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL,
    school_id uuid NOT NULL,
    name character varying NOT NULL,
    email character varying NOT NULL,
    profile_picture_url character varying,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT accountants_pkey PRIMARY KEY (id),
    CONSTRAINT accountants_user_id_key UNIQUE (user_id),
    CONSTRAINT accountants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT accountants_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE
);
ALTER TABLE public.accountants ENABLE ROW LEVEL SECURITY;


-- =================================================================
-- ACADEMIC STRUCTURE TABLES
-- =================================================================

-- Academic Years table
CREATE TABLE public.academic_years (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name character varying NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    school_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT academic_years_pkey PRIMARY KEY (id),
    CONSTRAINT academic_years_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE,
    CONSTRAINT academic_years_school_id_name_key UNIQUE (school_id, name)
);
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

-- Class Names (Standards) table
CREATE TABLE public.class_names (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name character varying NOT NULL,
    school_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT class_names_pkey PRIMARY KEY (id),
    CONSTRAINT class_names_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE,
    CONSTRAINT class_names_school_id_name_key UNIQUE (school_id, name)
);
ALTER TABLE public.class_names ENABLE ROW LEVEL SECURITY;

-- Section Names (Divisions) table
CREATE TABLE public.section_names (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name character varying NOT NULL,
    school_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT section_names_pkey PRIMARY KEY (id),
    CONSTRAINT section_names_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE,
    CONSTRAINT section_names_school_id_name_key UNIQUE (school_id, name)
);
ALTER TABLE public.section_names ENABLE ROW LEVEL SECURITY;

-- Classes (Activated Class-Sections) table
CREATE TABLE public.classes (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name character varying NOT NULL,
    division character varying NOT NULL,
    class_name_id uuid NOT NULL,
    section_name_id uuid NOT NULL,
    teacher_id uuid,
    academic_year_id uuid,
    school_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT classes_pkey PRIMARY KEY (id),
    CONSTRAINT classes_class_name_id_fkey FOREIGN KEY (class_name_id) REFERENCES public.class_names(id) ON DELETE RESTRICT,
    CONSTRAINT classes_section_name_id_fkey FOREIGN KEY (section_name_id) REFERENCES public.section_names(id) ON DELETE RESTRICT,
    CONSTRAINT classes_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL,
    CONSTRAINT classes_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL,
    CONSTRAINT classes_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ADD CONSTRAINT students_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD CONSTRAINT students_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL;


-- Subjects table
CREATE TABLE public.subjects (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name character varying NOT NULL,
    code character varying NOT NULL,
    academic_year_id uuid,
    school_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT subjects_pkey PRIMARY KEY (id),
    CONSTRAINT subjects_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE,
    CONSTRAINT subjects_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL,
    CONSTRAINT subjects_school_id_code_key UNIQUE (school_id, code)
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

-- Class Subjects join table
CREATE TABLE public.class_subjects (
    class_id uuid NOT NULL,
    subject_id uuid NOT NULL,
    school_id uuid NOT NULL,
    CONSTRAINT class_subjects_pkey PRIMARY KEY (class_id, subject_id),
    CONSTRAINT class_subjects_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE,
    CONSTRAINT class_subjects_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE,
    CONSTRAINT class_subjects_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE
);
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;


-- =================================================================
-- LMS TABLES
-- =================================================================

-- LMS Courses table (Global)
CREATE TABLE public.lms_courses (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    title character varying NOT NULL,
    description text,
    feature_image_url character varying,
    is_paid boolean NOT NULL DEFAULT false,
    price numeric,
    currency character varying,
    discount_percentage numeric,
    school_id uuid, -- Null for global courses
    target_audience public.user_role_enum,
    target_class_id uuid,
    created_by_user_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT lms_courses_pkey PRIMARY KEY (id),
    CONSTRAINT lms_courses_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE,
    CONSTRAINT lms_courses_target_class_id_fkey FOREIGN KEY (target_class_id) REFERENCES public.classes(id) ON DELETE SET NULL,
    CONSTRAINT lms_courses_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
ALTER TABLE public.lms_courses ENABLE ROW LEVEL SECURITY;

-- Course School Availability join table
CREATE TABLE public.lms_course_school_availability (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    course_id uuid NOT NULL,
    school_id uuid NOT NULL,
    target_audience_in_school character varying NOT NULL DEFAULT 'both'::character varying,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT lms_course_school_availability_pkey PRIMARY KEY (id),
    CONSTRAINT lms_course_school_availability_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.lms_courses(id) ON DELETE CASCADE,
    CONSTRAINT lms_course_school_availability_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE,
    CONSTRAINT lms_course_school_availability_course_id_school_id_key UNIQUE (course_id, school_id)
);
ALTER TABLE public.lms_course_school_availability ENABLE ROW LEVEL SECURITY;

-- Course Resources table
CREATE TABLE public.lms_course_resources (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    course_id uuid NOT NULL,
    type public.course_resource_type_enum NOT NULL,
    title character varying NOT NULL,
    url_or_content text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT lms_course_resources_pkey PRIMARY KEY (id),
    CONSTRAINT lms_course_resources_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.lms_courses(id) ON DELETE CASCADE
);
ALTER TABLE public.lms_course_resources ENABLE ROW LEVEL SECURITY;

-- Student Course Enrollments table
CREATE TABLE public.lms_student_course_enrollments (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    student_id uuid NOT NULL,
    course_id uuid NOT NULL,
    school_id uuid NOT NULL,
    enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT lms_student_course_enrollments_pkey PRIMARY KEY (id),
    CONSTRAINT lms_student_course_enrollments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE,
    CONSTRAINT lms_student_course_enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.lms_courses(id) ON DELETE CASCADE,
    CONSTRAINT lms_student_course_enrollments_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE,
    CONSTRAINT lms_student_course_enrollments_student_id_course_id_key UNIQUE (student_id, course_id)
);
ALTER TABLE public.lms_student_course_enrollments ENABLE ROW LEVEL SECURITY;

-- Teacher Course Enrollments table
CREATE TABLE public.lms_teacher_course_enrollments (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    teacher_id uuid NOT NULL,
    course_id uuid NOT NULL,
    school_id uuid NOT NULL,
    assigned_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT lms_teacher_course_enrollments_pkey PRIMARY KEY (id),
    CONSTRAINT lms_teacher_course_enrollments_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE,
    CONSTRAINT lms_teacher_course_enrollments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.lms_courses(id) ON DELETE CASCADE,
    CONSTRAINT lms_teacher_course_enrollments_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE,
    CONSTRAINT lms_teacher_course_enrollments_teacher_id_course_id_key UNIQUE (teacher_id, course_id)
);
ALTER TABLE public.lms_teacher_course_enrollments ENABLE ROW LEVEL SECURITY;

-- Course Activation Codes table
CREATE TABLE public.lms_course_activation_codes (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    course_id uuid NOT NULL,
    code character varying NOT NULL,
    is_used boolean NOT NULL DEFAULT false,
    used_by_user_id uuid,
    used_at timestamp with time zone,
    generated_date timestamp with time zone NOT NULL,
    expiry_date timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT lms_course_activation_codes_pkey PRIMARY KEY (id),
    CONSTRAINT lms_course_activation_codes_code_key UNIQUE (code),
    CONSTRAINT lms_course_activation_codes_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.lms_courses(id) ON DELETE CASCADE,
    CONSTRAINT lms_course_activation_codes_used_by_user_id_fkey FOREIGN KEY (used_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL
);
ALTER TABLE public.lms_course_activation_codes ENABLE ROW LEVEL SECURITY;


-- =================================================================
-- ACTIVITY & RECORDS TABLES
-- =================================================================

-- Assignments table
CREATE TABLE public.assignments (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    title character varying NOT NULL,
    description text,
    due_date date NOT NULL,
    class_id uuid NOT NULL,
    teacher_id uuid NOT NULL,
    subject_id uuid,
    school_id uuid NOT NULL,
    attachment_url character varying,
    attachment_name character varying,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT assignments_pkey PRIMARY KEY (id),
    CONSTRAINT assignments_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE,
    CONSTRAINT assignments_teacher_id_fkey FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE,
    CONSTRAINT assignments_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL,
    CONSTRAINT assignments_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE
);
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Assignment Submissions table
CREATE TABLE public.lms_assignment_submissions (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    assignment_id uuid NOT NULL,
    student_id uuid NOT NULL,
    school_id uuid NOT NULL,
    submission_date timestamp with time zone NOT NULL,
    file_path character varying NOT NULL,
    file_name character varying NOT NULL,
    notes text,
    grade character varying,
    feedback text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT lms_assignment_submissions_pkey PRIMARY KEY (id),
    CONSTRAINT lms_assignment_submissions_assignment_id_student_id_key UNIQUE (assignment_id, student_id),
    CONSTRAINT lms_assignment_submissions_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE,
    CONSTRAINT lms_assignment_submissions_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE,
    CONSTRAINT lms_assignment_submissions_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE
);
ALTER TABLE public.lms_assignment_submissions ENABLE ROW LEVEL SECURITY;

-- Attendance Records table
CREATE TABLE public.attendance_records (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    student_id uuid NOT NULL,
    class_id uuid NOT NULL,
    date date NOT NULL,
    status public.attendance_status_enum NOT NULL,
    remarks text,
    taken_by_teacher_id uuid NOT NULL,
    school_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT attendance_records_pkey PRIMARY KEY (id),
    CONSTRAINT attendance_records_student_id_date_key UNIQUE (student_id, date),
    CONSTRAINT attendance_records_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE,
    CONSTRAINT attendance_records_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE,
    CONSTRAINT attendance_records_taken_by_teacher_id_fkey FOREIGN KEY (taken_by_teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE,
    CONSTRAINT attendance_records_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE
);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;


-- =================================================================
-- FINANCE TABLES
-- =================================================================

-- Fee Categories table
CREATE TABLE public.fee_categories (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    name character varying NOT NULL,
    description text,
    amount numeric,
    school_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT fee_categories_pkey PRIMARY KEY (id),
    CONSTRAINT fee_categories_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE
);
ALTER TABLE public.fee_categories ENABLE ROW LEVEL SECURITY;

-- Student Fee Payments table
CREATE TABLE public.student_fee_payments (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    student_id uuid NOT NULL,
    fee_category_id uuid NOT NULL,
    academic_year_id uuid,
    assigned_amount numeric NOT NULL,
    paid_amount numeric NOT NULL DEFAULT 0,
    due_date date,
    payment_date date,
    status public.payment_status_enum NOT NULL,
    notes text,
    school_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT student_fee_payments_pkey PRIMARY KEY (id),
    CONSTRAINT student_fee_payments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE,
    CONSTRAINT student_fee_payments_fee_category_id_fkey FOREIGN KEY (fee_category_id) REFERENCES public.fee_categories(id) ON DELETE RESTRICT,
    CONSTRAINT student_fee_payments_academic_year_id_fkey FOREIGN KEY (academic_year_id) REFERENCES public.academic_years(id) ON DELETE SET NULL,
    CONSTRAINT student_fee_payments_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE
);
ALTER TABLE public.student_fee_payments ENABLE ROW LEVEL SECURITY;


-- =================================================================
-- MISCELLANEOUS TABLES
-- =================================================================

-- Leave Applications table
CREATE TABLE public.leave_applications (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    student_profile_id uuid,
    student_name character varying NOT NULL,
    reason text NOT NULL,
    medical_notes_data_uri text,
    submission_date timestamp with time zone NOT NULL,
    status public.leave_request_status_enum NOT NULL,
    applicant_user_id uuid NOT NULL,
    applicant_role public.user_role_enum NOT NULL,
    school_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT leave_applications_pkey PRIMARY KEY (id),
    CONSTRAINT leave_applications_student_profile_id_fkey FOREIGN KEY (student_profile_id) REFERENCES public.students(id) ON DELETE SET NULL,
    CONSTRAINT leave_applications_applicant_user_id_fkey FOREIGN KEY (applicant_user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT leave_applications_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE
);
ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;

-- Announcements table
CREATE TABLE public.announcements (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    title character varying NOT NULL,
    content text NOT NULL,
    date timestamp with time zone NOT NULL,
    author_name character varying NOT NULL,
    posted_by_user_id uuid NOT NULL,
    posted_by_role public.user_role_enum NOT NULL,
    target_audience character varying NOT NULL,
    target_class_id uuid,
    school_id uuid,
    linked_exam_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT announcements_pkey PRIMARY KEY (id),
    CONSTRAINT announcements_posted_by_user_id_fkey FOREIGN KEY (posted_by_user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT announcements_target_class_id_fkey FOREIGN KEY (target_class_id) REFERENCES public.classes(id) ON DELETE SET NULL,
    CONSTRAINT announcements_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Calendar Events table
CREATE TABLE public.calendar_events (
    id uuid NOT NULL DEFAULT uuid_generate_v4(),
    title character varying NOT NULL,
    description text,
    date date NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    is_all_day boolean NOT NULL,
    school_id uuid NOT NULL,
    posted_by_user_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT calendar_events_pkey PRIMARY KEY (id),
    CONSTRAINT calendar_events_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE,
    CONSTRAINT calendar_events_posted_by_user_id_fkey FOREIGN KEY (posted_by_user_id) REFERENCES public.users(id) ON DELETE CASCADE
);
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;


-- =================================================================
-- RLS POLICIES
-- NOTE: Policies are basic and should be reviewed for production security needs.
-- =================================================================

-- Schools Table Policies
CREATE POLICY "Enable read access for all users" ON public.schools FOR SELECT USING (true);
CREATE POLICY "Enable insert for superadmins" ON public.schools FOR INSERT WITH CHECK ((SELECT role::text FROM public.users WHERE id = auth.uid()) = 'superadmin');
CREATE POLICY "Enable update for superadmins" ON public.schools FOR UPDATE USING ((SELECT role::text FROM public.users WHERE id = auth.uid()) = 'superadmin');
CREATE POLICY "Enable delete for superadmins" ON public.schools FOR DELETE USING ((SELECT role::text FROM public.users WHERE id = auth.uid()) = 'superadmin');

-- Users Table Policies
CREATE POLICY "Users can view their own user" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view users in their school" ON public.users FOR SELECT USING ((SELECT role::text FROM public.users WHERE id = auth.uid()) = 'admin' AND school_id = (SELECT school_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "Users can update their own user" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Superadmins can manage all users" ON public.users FOR ALL USING ((SELECT role::text FROM public.users WHERE id = auth.uid()) = 'superadmin');

-- Policies for other tables should be similarly structured, scoping access to the user's role and school.
-- Example for a school-specific table:
CREATE POLICY "Enable full access for school members" ON public.subjects FOR ALL USING (school_id = (SELECT school_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "Enable full access for superadmins" ON public.subjects FOR ALL USING ((SELECT role::text FROM public.users WHERE id = auth.uid()) = 'superadmin');

-- Enable RLS for all relevant tables (add as needed)
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_fee_payments ENABLE ROW LEVEL SECURITY;
-- ... and so on for all tables containing sensitive or school-specific data.

-- LMS Policies from previous steps are included here for completeness
DROP POLICY IF EXISTS "Allow admin full access for own school" ON public.lms_course_school_availability;
DROP POLICY IF EXISTS "Allow superadmin full access" ON public.lms_course_school_availability;
DROP POLICY IF EXISTS "Allow enrolled users to view" ON public.lms_course_school_availability;

CREATE POLICY "Allow admin full access for own school" ON public.lms_course_school_availability FOR ALL TO authenticated USING (((SELECT school_id FROM public.users WHERE (users.id = auth.uid())) = lms_course_school_availability.school_id) AND ((SELECT users.role FROM public.users WHERE (users.id = auth.uid())) = 'admin'::user_role_enum)) WITH CHECK (((SELECT school_id FROM public.users WHERE (users.id = auth.uid())) = lms_course_school_availability.school_id) AND ((SELECT users.role FROM public.users WHERE (users.id = auth.uid())) = 'admin'::user_role_enum));
CREATE POLICY "Allow superadmin full access" ON public.lms_course_school_availability FOR ALL TO authenticated USING (((SELECT users.role FROM public.users WHERE (users.id = auth.uid())) = 'superadmin'::user_role_enum)) WITH CHECK (((SELECT users.role FROM public.users WHERE (users.id = auth.uid())) = 'superadmin'::user_role_enum));
CREATE POLICY "Allow enrolled users to view" ON public.lms_course_school_availability FOR SELECT TO authenticated USING (true);


