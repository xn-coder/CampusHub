-- Run these queries on your Supabase SQL Editor to update your schema for the new LMS features.
-- Note: Running these multiple times is safe.

-- 1. Add `subscription_plan` to `lms_courses` if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'lms_courses'
    AND column_name = 'subscription_plan'
  ) THEN
    ALTER TABLE public.lms_courses
    ADD COLUMN subscription_plan TEXT;
    
    -- You might want to add a CHECK constraint if you have a specific list of plans
    -- ALTER TABLE public.lms_courses
    -- ADD CONSTRAINT lms_courses_subscription_plan_check CHECK (subscription_plan = ANY (ARRAY['free', 'monthly', 'yearly', 'one_time']));
  END IF;
END $$;


-- 2. Add `price_per_10_users` to `lms_courses` if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'lms_courses'
    AND column_name = 'price_per_10_users'
  ) THEN
    ALTER TABLE public.lms_courses
    ADD COLUMN price_per_10_users NUMERIC(10, 2);
  END IF;
END $$;


-- 3. Add `subscribed_users_count` to `lms_school_subscriptions` if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'lms_school_subscriptions'
    AND column_name = 'subscribed_users_count'
  ) THEN
    ALTER TABLE public.lms_school_subscriptions
    ADD COLUMN subscribed_users_count INTEGER DEFAULT 0;
  END IF;
END $$;


-- 4. Rename `price` to `base_price` in `lms_courses` if `price` exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'lms_courses'
    AND column_name = 'price'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'lms_courses'
    AND column_name = 'base_price'
  ) THEN
    ALTER TABLE public.lms_courses
    RENAME COLUMN price TO base_price;
  END IF;
END $$;

-- 5. Add `max_users_allowed` to `lms_courses` if it doesn't exist
-- This column now represents the initial seats included in the base price.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'lms_courses'
    AND column_name = 'max_users_allowed'
  ) THEN
    ALTER TABLE public.lms_courses
    ADD COLUMN max_users_allowed INTEGER;
  END IF;
END $$;
