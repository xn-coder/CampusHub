-- Full Application Schema for CampusHub

-- Drop existing tables and types in reverse order of dependency to avoid errors.
DROP TABLE IF EXISTS public.lms_assignment_submissions CASCADE;
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.student_scores CASCADE;
DROP TABLE IF EXISTS public.exams CASCADE;
DROP TABLE IF EXISTS public.class_subjects CASCADE;
DROP TABLE IF EXISTS public.subjects CASCADE;
DROP TABLE IF EXISTS public.class_schedules CASCADE;
DROP TABLE IF EXISTS public.tc_requests CASCADE;
DROP TABLE IF EXISTS public.student_fee_payments CASCADE;
DROP TABLE IF EXISTS public.fee_categories CASCADE;
DROP TABLE IF EXISTS public.attendance_records CASCADE;
DROP TABLE IF EXISTS public.leave_applications CASCADE;
DROP TABLE IF EXISTS public.announcements CASCADE;
DROP TABLE IF EXISTS public.calendar_events CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.expense_categories CASCADE;
DROP TABLE IF EXISTS public.admission_records CASCADE;
DROP TABLE IF EXISTS public.lms_student_course_enrollments CASCADE;
DROP TABLE IF EXISTS public.lms_teacher_course_enrollments CASCADE;
DROP TABLE IF EXISTS public.lms_course_activation_codes CASCADE;
DROP TABLE IF EXISTS public.lms_course_school_availability CASCADE;
DROP TABLE IF EXISTS public.lms_course_resources CASCADE;
DROP TABLE IF EXISTS public.lms_courses CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;
DROP TABLE IF EXISTS public.teachers CASCADE;
DROP TABLE IF EXISTS public.accountants CASCADE;
DROP TABLE IF EXISTS public.class_names CASCADE;
DROP TABLE IF EXISTS public.section_names CASCADE;
DROP TABLE IF EXISTS public.academic_years CASCADE;
DROP TABLE IF EXISTS public.holidays CASCADE;
DROP TABLE IF EXISTS public.schools CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS public.user_role_enum;
DROP TYPE IF EXISTS public.lms_audience_enum;
DROP TYPE IF EXISTS public.school_status_enum;
DROP TYPE IF EXISTS public.attendance_status_enum;
DROP TYPE IF EXISTS public.leave_status_enum;
DROP TYPE IF EXISTS public.payment_status_enum;
DROP TYPE IF EXISTS public.course_resource_type_enum;
DROP TYPE IF EXISTS public.day_of_week_enum;
DROP TYPE IF EXISTS public.admission_status_enum;
DROP TYPE IF EXISTS public.tc_request_status_enum;

-- Create ENUM types
CREATE TYPE public.user_role_enum AS ENUM ('superadmin', 'admin', 'teacher', 'student', 'accountant');
CREATE TYPE public.school_status_enum AS ENUM ('Active', 'Inactive');
CREATE TYPE public.attendance_status_enum AS ENUM ('Present', 'Absent', 'Late', 'Excused');
CREATE TYPE public.leave_status_enum AS ENUM ('Pending', 'Approved', 'Rejected');
CREATE TYPE public.payment_status_enum AS ENUM ('Pending', 'Paid', 'Partially Paid', 'Overdue', 'Failed');
CREATE TYPE public.course_resource_type_enum AS ENUM ('ebook', 'video', 'note', 'webinar', 'quiz', 'ppt');
CREATE TYPE public.day_of_week_enum AS ENUM ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday');
CREATE TYPE public.admission_status_enum AS ENUM ('Pending Review', 'Admitted', 'Enrolled', 'Rejected');
CREATE TYPE public.tc_request_status_enum AS ENUM ('Pending', 'Approved', 'Rejected');
CREATE TYPE public.lms_audience_enum AS ENUM ('student', 'teacher', 'both');

-- Main Tables
CREATE TABLE public.users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text UNIQUE NOT NULL,
    name text NOT NULL,
    role public.user_role_enum NOT NULL,
    password_hash text NOT NULL,
    school_id uuid,
    status text DEFAULT 'Active'::text,
    last_sign_in_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow users to read their own data" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Allow users to update their own data" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Allow public read access to users table" ON public.users FOR SELECT USING (true);


CREATE TABLE public.schools (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    address text,
    admin_email text UNIQUE NOT NULL,
    admin_name text NOT NULL,
    contact_email text,
    admin_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
    status public.school_status_enum DEFAULT 'Active'::school_status_enum,
    contact_phone text,
    logo_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ADD CONSTRAINT fk_users_school_id FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE SET NULL;

CREATE POLICY "Allow superadmin full access" ON public.schools FOR ALL USING ((SELECT role::text FROM public.users WHERE id = auth.uid()) = 'superadmin');
CREATE POLICY "Allow admin to read own school data" ON public.schools FOR SELECT USING (id = (SELECT school_id FROM public.users WHERE id = auth.uid()));


CREATE TABLE public.teachers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text NOT NULL,
    subject text,
    profile_picture_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.students (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text NOT NULL,
    roll_number text,
    class_id uuid,
    academic_year_id uuid,
    profile_picture_url text,
    date_of_birth date,
    gender text,
    nationality text,
    blood_group text,
    category text,
    guardian_name text,
    father_name text,
    father_occupation text,
    mother_name text,
    mother_occupation text,
    annual_family_income numeric,
    parent_contact_number text,
    contact_number text,
    address text,
    admission_date date,
    status text DEFAULT 'Active'::text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.accountants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text NOT NULL,
    profile_picture_url text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.accountants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.class_names (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    UNIQUE(name, school_id)
);
ALTER TABLE public.class_names ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.section_names (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    UNIQUE(name, school_id)
);
ALTER TABLE public.section_names ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.academic_years (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    UNIQUE(name, school_id)
);
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;


CREATE TABLE public.classes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    division text NOT NULL,
    class_name_id uuid REFERENCES public.class_names(id),
    section_name_id uuid REFERENCES public.section_names(id),
    teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
    academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(class_name_id, section_name_id, academic_year_id, school_id)
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ADD CONSTRAINT fk_students_class_id FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;

CREATE TABLE public.subjects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    code text NOT NULL,
    academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE RESTRICT,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    UNIQUE(code, school_id)
);
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.class_subjects (
    class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    PRIMARY KEY (class_id, subject_id)
);
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;


CREATE TABLE public.class_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    day_of_week public.day_of_week_enum NOT NULL,
    start_time time NOT NULL,
    end_time time NOT NULL
);
ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.attendance_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    date date NOT NULL,
    status public.attendance_status_enum NOT NULL,
    remarks text,
    taken_by_teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    UNIQUE(student_id, date)
);
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;


CREATE TABLE public.leave_applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_profile_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
    student_name text NOT NULL,
    reason text NOT NULL,
    medical_notes_data_uri text,
    submission_date timestamptz NOT NULL DEFAULT now(),
    status public.leave_status_enum NOT NULL DEFAULT 'Pending'::leave_status_enum,
    ai_reasoning text,
    applicant_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    applicant_role public.user_role_enum NOT NULL,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE
);
ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    content text NOT NULL,
    date timestamptz NOT NULL,
    author_name text NOT NULL,
    posted_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    posted_by_role public.user_role_enum NOT NULL,
    target_audience text DEFAULT 'all',
    target_class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
    school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
    linked_exam_id uuid
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;


CREATE TABLE public.calendar_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    date date NOT NULL,
    start_time time,
    end_time time,
    is_all_day boolean NOT NULL DEFAULT false,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    posted_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE
);
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.holidays (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    date date NOT NULL,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE
);
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;


CREATE TABLE public.fee_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    amount numeric,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    UNIQUE(name, school_id)
);
ALTER TABLE public.fee_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.student_fee_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    fee_category_id uuid NOT NULL REFERENCES public.fee_categories(id) ON DELETE CASCADE,
    academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
    assigned_amount numeric NOT NULL,
    paid_amount numeric NOT NULL DEFAULT 0,
    due_date date,
    payment_date date,
    status public.payment_status_enum NOT NULL DEFAULT 'Pending'::payment_status_enum,
    notes text,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE
);
ALTER TABLE public.student_fee_payments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.expense_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    UNIQUE(name, school_id)
);
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    amount numeric NOT NULL,
    category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
    date date NOT NULL,
    receipt_url text,
    notes text,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    recorded_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;


CREATE TABLE public.receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_no serial UNIQUE,
    narration text,
    payment_date date NOT NULL,
    payment_mode text NOT NULL,
    total_amount numeric NOT NULL,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    created_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.receipt_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
    ledger text NOT NULL,
    description text,
    amount numeric NOT NULL,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE
);
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;


CREATE TABLE public.exams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
    academic_year_id uuid REFERENCES public.academic_years(id) ON DELETE SET NULL,
    date date NOT NULL,
    start_time time,
    end_time time,
    max_marks numeric,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE
);
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.student_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    score text NOT NULL,
    max_marks numeric,
    recorded_by_teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    date_recorded date NOT NULL,
    comments text,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    UNIQUE(student_id, exam_id, subject_id)
);
ALTER TABLE public.student_scores ENABLE ROW LEVEL SECURITY;


CREATE TABLE public.lms_courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    feature_image_url text,
    is_paid boolean NOT NULL DEFAULT false,
    price numeric,
    currency text,
    discount_percentage numeric,
    school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
    target_audience public.lms_audience_enum,
    target_class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
    created_by_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.lms_courses ENABLE ROW LEVEL SECURITY;


CREATE TABLE public.lms_course_resources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
    type public.course_resource_type_enum NOT NULL,
    title text NOT NULL,
    url_or_content text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.lms_course_resources ENABLE ROW LEVEL SECURITY;


CREATE TABLE public.lms_course_activation_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
    code text UNIQUE NOT NULL,
    is_used boolean NOT NULL DEFAULT false,
    used_by_user_id uuid REFERENCES public.users(id),
    used_at timestamptz,
    generated_date date NOT NULL,
    expiry_date date
);
ALTER TABLE public.lms_course_activation_codes ENABLE ROW LEVEL SECURITY;


CREATE TABLE public.lms_student_course_enrollments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
    enrolled_at timestamptz DEFAULT now(),
    progress numeric DEFAULT 0,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    UNIQUE(student_id, course_id)
);
ALTER TABLE public.lms_student_course_enrollments ENABLE ROW LEVEL SECURITY;


CREATE TABLE public.lms_teacher_course_enrollments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
    assigned_at timestamptz DEFAULT now(),
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    UNIQUE(teacher_id, course_id)
);
ALTER TABLE public.lms_teacher_course_enrollments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.lms_course_school_availability (
    course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    target_audience_in_school public.lms_audience_enum NOT NULL DEFAULT 'both',
    PRIMARY KEY (course_id, school_id)
);
ALTER TABLE public.lms_course_school_availability ENABLE ROW LEVEL SECURITY;


CREATE TABLE public.assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    due_date date NOT NULL,
    class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id uuid NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
    subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    attachment_url text,
    attachment_name text
);
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.lms_assignment_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    submission_date timestamptz NOT NULL DEFAULT now(),
    file_path text NOT NULL,
    file_name text NOT NULL,
    notes text,
    grade text,
    feedback text,
    UNIQUE(assignment_id, student_id)
);
ALTER TABLE public.lms_assignment_submissions ENABLE ROW LEVEL SECURITY;


CREATE TABLE public.admission_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    email text,
    date_of_birth date,
    guardian_name text,
    contact_number text,
    address text,
    admission_date date NOT NULL,
    status public.admission_status_enum NOT NULL,
    class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
    student_profile_id uuid REFERENCES public.students(id) ON DELETE SET NULL,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.admission_records ENABLE ROW LEVEL SECURITY;


CREATE TABLE public.tc_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    request_date timestamptz NOT NULL DEFAULT now(),
    status public.tc_request_status_enum NOT NULL DEFAULT 'Pending'::tc_request_status_enum,
    rejection_reason text,
    approved_date timestamptz,
    UNIQUE (student_id, school_id)
);
ALTER TABLE public.tc_requests ENABLE ROW LEVEL SECURITY;


-- RLS Policies
CREATE POLICY "Allow superadmin full access" ON public.lms_course_school_availability FOR ALL USING ((SELECT role::text FROM public.users WHERE id = auth.uid()) = 'superadmin') WITH CHECK ((SELECT role::text FROM public.users WHERE id = auth.uid()) = 'superadmin');
CREATE POLICY "Allow admin full access for own school" ON public.lms_course_school_availability FOR ALL USING (((SELECT school_id FROM public.users WHERE id = auth.uid()) = school_id) AND ((SELECT role::text FROM public.users WHERE id = auth.uid()) = 'admin')) WITH CHECK (((SELECT school_id FROM public.users WHERE id = auth.uid()) = school_id) AND ((SELECT role::text FROM public.users WHERE id = auth.uid()) = 'admin'));
CREATE POLICY "Allow enrolled users to view" ON public.lms_course_school_availability FOR SELECT USING (true);
