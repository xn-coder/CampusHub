-- Update lms_courses table for new pricing model
-- This renames the existing 'price' column and adds a new one for bundled pricing.
-- It also removes the no-longer-used 'max_users_allowed' column.

-- Add a subscription_plan column if it doesn't exist
-- This is safe to run multiple times.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'lms_courses' AND column_name = 'subscription_plan'
    ) THEN
        ALTER TABLE public.lms_courses ADD COLUMN subscription_plan TEXT;
    END IF;
END
$$;

-- Add a base_price column for the initial course cost
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'lms_courses' AND column_name = 'base_price'
    ) THEN
        ALTER TABLE public.lms_courses ADD COLUMN base_price NUMERIC(10, 2);
    END IF;
END
$$;

-- Add a price_per_10_users column for scalable pricing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'lms_courses' AND column_name = 'price_per_10_users'
    ) THEN
        ALTER TABLE public.lms_courses ADD COLUMN price_per_10_users NUMERIC(10, 2);
    END IF;
END
$$;

-- Drop the old 'price' and 'max_users_allowed' columns if they exist
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'lms_courses' AND column_name = 'price'
    ) THEN
        -- If you need to migrate data from 'price' to 'base_price' before dropping, do it here.
        -- UPDATE public.lms_courses SET base_price = price WHERE base_price IS NULL;
        ALTER TABLE public.lms_courses DROP COLUMN price;
    END IF;
    
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'lms_courses' AND column_name = 'max_users_allowed'
    ) THEN
        ALTER TABLE public.lms_courses DROP COLUMN max_users_allowed;
    END IF;
END
$$;


-- Update lms_school_subscriptions table to track user counts
-- This column will store how many users a school's subscription covers for a specific course.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'lms_school_subscriptions' AND column_name = 'subscribed_users_count'
    ) THEN
        ALTER TABLE public.lms_school_subscriptions ADD COLUMN subscribed_users_count INTEGER DEFAULT 10;
    END IF;
END
$$;


COMMENT ON COLUMN public.lms_courses.base_price IS 'The initial, one-time cost for a school to subscribe to the course.';
COMMENT ON COLUMN public.lms_courses.price_per_10_users IS 'The cost for each additional bundle of 10 users for this course.';
COMMENT ON COLUMN public.lms_school_subscriptions.subscribed_users_count IS 'The total number of user seats this school has purchased for this course.';

-- Run this script to apply the necessary database schema changes for the updated LMS pricing model.
-- After running, refresh your Supabase API schema in Project Settings -> API.
