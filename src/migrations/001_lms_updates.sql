-- This script updates the LMS schema to support subscription plans,
-- user limits, and school-specific course availability.

-- Function to get a user's role by their ID.
-- This is a helper function for the enrollment trigger below.
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  user_role_result TEXT;
BEGIN
  SELECT role INTO user_role_result
  FROM public.users
  WHERE id = user_id;
  
  RETURN user_role_result;
END;
$$ LANGUAGE plpgsql;


-- Add subscription plan and user limit columns to the lms_courses table.
ALTER TABLE public.lms_courses
ADD COLUMN IF NOT EXISTS subscription_plan TEXT,
ADD COLUMN IF NOT EXISTS max_users_allowed INT;

-- Create the join table to manage which schools have access to which courses.
CREATE TABLE IF NOT EXISTS public.lms_course_school_availability (
    course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    target_audience_in_school TEXT NOT NULL DEFAULT 'both', -- 'student', 'teacher', or 'both'
    PRIMARY KEY (course_id, school_id)
);

-- Add school_id to enrollment tables to track per-school enrollment counts.
ALTER TABLE public.lms_student_course_enrollments
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

ALTER TABLE public.lms_teacher_course_enrollments
ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- Function to check enrollment limit before inserting
CREATE OR REPLACE FUNCTION check_lms_enrollment_limit()
RETURNS TRIGGER AS $$
DECLARE
  course_max_users INT;
  current_enrollments INT;
  course_creator_id UUID;
  creator_role TEXT;
BEGIN
  -- Get the course details
  SELECT max_users_allowed, created_by_user_id INTO course_max_users, course_creator_id
  FROM public.lms_courses
  WHERE id = NEW.course_id;

  -- If no limit, allow enrollment
  IF course_max_users IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check the role of the course creator
  SELECT get_user_role(course_creator_id) INTO creator_role;

  -- If the course was created by a superadmin, the limit applies per school
  IF creator_role = 'superadmin' THEN
    SELECT COUNT(*) INTO current_enrollments
    FROM (
      SELECT student_id FROM public.lms_student_course_enrollments WHERE course_id = NEW.course_id AND school_id = NEW.school_id
      UNION ALL
      SELECT teacher_id FROM public.lms_teacher_course_enrollments WHERE course_id = NEW.course_id AND school_id = NEW.school_id
    ) AS all_enrollments;
  ELSE
    -- If created by an admin, the limit is global for that course
    SELECT COUNT(*) INTO current_enrollments
    FROM (
      SELECT student_id FROM public.lms_student_course_enrollments WHERE course_id = NEW.course_id
      UNION ALL
      SELECT teacher_id FROM public.lms_teacher_course_enrollments WHERE course_id = NEW.course_id
    ) AS all_enrollments;
  END IF;

  -- Check if the limit is exceeded
  IF current_enrollments >= course_max_users THEN
    RAISE EXCEPTION 'Enrollment limit for this course has been reached.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- Drop existing triggers if they exist, to prevent errors on re-run
DROP TRIGGER IF EXISTS before_student_enrollment_check_limit ON public.lms_student_course_enrollments;
DROP TRIGGER IF EXISTS before_teacher_enrollment_check_limit ON public.lms_teacher_course_enrollments;


-- Create triggers to run the function before each enrollment insert
CREATE TRIGGER before_student_enrollment_check_limit
BEFORE INSERT ON public.lms_student_course_enrollments
FOR EACH ROW
EXECUTE FUNCTION check_lms_enrollment_limit();

CREATE TRIGGER before_teacher_enrollment_check_limit
BEFORE INSERT ON public.lms_teacher_course_enrollments
FOR EACH ROW
EXECUTE FUNCTION check_lms_enrollment_limit();


-- Add a status column to tc_requests
ALTER TABLE public.tc_requests
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Pending',
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS approved_date TIMESTAMPTZ;

-- Add a status column to students
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active';

-- Add a status column to users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'Active';

-- Add lastLogin to users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;
