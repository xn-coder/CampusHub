-- First, ensure the user_role type is defined.
-- This might already exist in your database from other scripts.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'teacher', 'student');
    END IF;
END$$;


-- Create the announcements table
CREATE TABLE IF NOT EXISTS announcements (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_name TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    posted_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    posted_by_role user_role NOT NULL,
    school_id uuid REFERENCES schools(id) ON DELETE SET NULL, -- This can be NULL for global announcements
    target_class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
    linked_exam_id uuid REFERENCES exams(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_announcements_school_id ON announcements(school_id);
CREATE INDEX IF NOT EXISTS idx_announcements_target_class_id ON announcements(target_class_id);
CREATE INDEX IF NOT EXISTS idx_announcements_date ON announcements(date DESC);

-- RLS Policies
-- Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Allow public read access based on role and school/class context
-- This is a simplified example. You should adjust it to your exact needs.
DROP POLICY IF EXISTS "Allow read access to relevant users" ON announcements;
CREATE POLICY "Allow read access to relevant users"
ON announcements
FOR SELECT
USING (
  -- Superadmins can see global announcements
  (
    (SELECT role FROM users WHERE id = auth.uid()) = 'superadmin' AND school_id IS NULL
  ) OR
  -- Admins can see their school's announcements and global announcements
  (
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin' AND (school_id = (SELECT school_id FROM users WHERE id = auth.uid()) OR school_id IS NULL)
  ) OR
  -- Teachers and Students can see announcements for their school (either school-wide or for their specific class)
  (
    school_id = (SELECT school_id FROM users WHERE id = auth.uid())
    AND
    (
        target_class_id IS NULL -- School-wide
        OR
        -- Students see their class's announcements
        ((SELECT role FROM users WHERE id = auth.uid()) = 'student' AND target_class_id = (SELECT class_id FROM students WHERE user_id = auth.uid()))
        OR
        -- Teachers see announcements for any class they are assigned to
        ((SELECT role FROM users WHERE id = auth.uid()) = 'teacher' AND target_class_id IN (SELECT id FROM classes WHERE teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())))
    )
  )
);

-- Allow authorized users to insert announcements
DROP POLICY IF EXISTS "Allow insert for authorized roles" ON announcements;
CREATE POLICY "Allow insert for authorized roles"
ON announcements
FOR INSERT
WITH CHECK (
  (
    -- Superadmin can insert global announcements
    (SELECT role FROM users WHERE id = auth.uid()) = 'superadmin' AND posted_by_user_id = auth.uid()
  ) OR
  (
    -- Admins and Teachers can insert announcements for their own school
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'teacher')
    AND school_id = (SELECT school_id FROM users WHERE id = auth.uid())
    AND posted_by_user_id = auth.uid()
  )
);
