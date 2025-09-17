-- This script contains the necessary SQL commands to update your database schema
-- for the enhanced Learning Management System (LMS) features.
-- Run these commands in your Supabase SQL Editor.

-- 1. Add subscription plan tracking to the main courses table.
-- This allows superadmins to define how a course is paid for (free, one-time, etc.).
ALTER TABLE public.lms_courses
ADD COLUMN IF NOT EXISTS subscription_plan TEXT CHECK (subscription_plan IN ('free', 'one_time', 'monthly', 'yearly')) DEFAULT 'free';

-- 2. Add a column to track the number of subscribed users for a school's course subscription.
-- This is crucial for the "pay-per-seat" upgrade functionality.
ALTER TABLE public.lms_school_subscriptions
ADD COLUMN IF NOT EXISTS subscribed_users_count INTEGER NOT NULL DEFAULT 1;

-- 3. Remove the 'max_users_allowed' column from the lms_courses table.
-- This field is now redundant, as user limits are managed per school via the new 'subscribed_users_count'
-- column in the lms_school_subscriptions table, providing more flexibility.
ALTER TABLE public.lms_courses
DROP COLUMN IF EXISTS max_users_allowed;

-- --- Verification ---
-- You can run the following commands to verify the changes have been applied.

-- \d lms_courses
-- Should show the 'subscription_plan' column and 'max_users_allowed' should be gone.

-- \d lms_school_subscriptions
-- Should show the 'subscribed_users_count' column.
