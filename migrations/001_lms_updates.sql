-- LMS Schema Updates for Subscription and School Availability

-- Create the subscription plan ENUM type if it doesn't already exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_plan') THEN
        CREATE TYPE subscription_plan AS ENUM ('one_time', 'monthly', 'yearly');
    END IF;
END$$;


-- 1. Modify the existing lms_courses table
-- Adds columns for subscription plans and user limits.
ALTER TABLE public.lms_courses
    ADD COLUMN IF NOT EXISTS subscription_plan subscription_plan DEFAULT 'one_time',
    ADD COLUMN IF NOT EXISTS max_users_allowed INTEGER;

-- Comment on the new columns for clarity
COMMENT ON COLUMN public.lms_courses.subscription_plan IS 'Defines the billing cycle for the course.';
COMMENT ON COLUMN public.lms_courses.max_users_allowed IS 'Maximum number of users that can be enrolled in this course.';


-- 2. Create a new table to link courses to schools
-- This table manages which schools have access to which global courses and for what audience.
CREATE TABLE IF NOT EXISTS public.lms_course_school_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    course_id UUID NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    target_audience_in_school VARCHAR(20) CHECK (target_audience_in_school IN ('student', 'teacher', 'both')) NOT NULL DEFAULT 'both',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure a course can only be assigned to a school once
    UNIQUE(course_id, school_id)
);

-- Add comments for clarity
COMMENT ON TABLE public.lms_course_school_availability IS 'Manages which courses are available to which schools.';
COMMENT ON COLUMN public.lms_course_school_availability.target_audience_in_school IS 'Defines who can see the course within the assigned school (student, teacher, or both).';

-- Enable Row Level Security
ALTER TABLE public.lms_course_school_availability ENABLE ROW LEVEL SECURITY;

-- Create policies for access
-- Superadmins and admins should be able to see these records.
CREATE POLICY "Allow read access to admins and superadmins"
ON public.lms_course_school_availability
FOR SELECT
USING (
    (get_user_role() = 'superadmin'::text) OR
    (get_user_role() = 'admin'::text AND auth.uid() = (SELECT admin_user_id FROM schools WHERE id = school_id))
);

-- Only superadmins can create/delete/update these assignments
CREATE POLICY "Allow all access for superadmins"
ON public.lms_course_school_availability
FOR ALL
USING (get_user_role() = 'superadmin'::text)
WITH CHECK (get_user_role() = 'superadmin'::text);


-- Housekeeping: It's good practice to ensure foreign key indexes exist
CREATE INDEX IF NOT EXISTS idx_lms_course_school_availability_course_id ON public.lms_course_school_availability(course_id);
CREATE INDEX IF NOT EXISTS idx_lms_course_school_availability_school_id ON public.lms_course_school_availability(school_id);


-- =================================================================
-- Note: The functions `get_user_role()` used in policies are assumed
-- to exist from the initial CampusHub setup. If not, they would need
-- to be created.
-- Example:
/*
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text AS $$
DECLARE
    user_role text;
BEGIN
    SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
*/
-- =================================================================

