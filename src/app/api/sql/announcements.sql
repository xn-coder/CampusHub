-- First, ensure the user_role ENUM type exists.
-- This command will only create the type if it doesn't already exist.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'teacher', 'student');
    END IF;
END$$;


-- Then, create the announcements table.
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    author_name TEXT NOT NULL,
    posted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    posted_by_role user_role NOT NULL,
    target_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    linked_exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_announcements_school_id ON announcements(school_id);
CREATE INDEX IF NOT EXISTS idx_announcements_target_class_id ON announcements(target_class_id);
CREATE INDEX IF NOT EXISTS idx_announcements_date ON announcements(date DESC);

-- Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Policies for announcements
-- Superadmins can manage global announcements (where school_id is NULL)
CREATE POLICY "Superadmins can manage global announcements" ON announcements
FOR ALL TO authenticated
USING (
  (SELECT role FROM users WHERE id = auth.uid()) = 'superadmin' AND
  school_id IS NULL
)
WITH CHECK (
  (SELECT role FROM users WHERE id = auth.uid()) = 'superadmin' AND
  school_id IS NULL
);

-- Admins can manage announcements for their own school
CREATE POLICY "Admins can manage their school's announcements" ON announcements
FOR ALL TO authenticated
USING (
  school_id = (SELECT school_id FROM users WHERE id = auth.uid()) AND
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  school_id = (SELECT school_id FROM users WHERE id = auth.uid()) AND
  (SELECT role FROM users WHERE id = auth.uid()) = 'admin'
);

-- Teachers can create announcements for their classes
CREATE POLICY "Teachers can create announcements for their classes" ON announcements
FOR INSERT TO authenticated
WITH CHECK (
  (SELECT role FROM users WHERE id = auth.uid()) = 'teacher' AND
  school_id = (SELECT school_id FROM users WHERE id = auth.uid()) AND
  target_class_id IN (SELECT id FROM classes WHERE teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid()))
);

-- Allow authenticated users to read announcements based on their context
CREATE POLICY "Users can view relevant announcements" ON announcements
FOR SELECT TO authenticated
USING (
  -- Global announcements are visible to superadmins and admins
  (school_id IS NULL AND (SELECT role FROM users WHERE id = auth.uid()) IN ('superadmin', 'admin')) OR
  -- School-specific announcements
  (school_id = (SELECT school_id FROM users WHERE id = auth.uid()) AND (
    -- Admins see all school announcements
    (SELECT role FROM users WHERE id = auth.uid()) = 'admin' OR
    -- Teachers see announcements for their classes or school-wide
    ((SELECT role FROM users WHERE id = auth.uid()) = 'teacher' AND (target_class_id IS NULL OR target_class_id IN (SELECT id FROM classes WHERE teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid())))) OR
    -- Students see announcements for their class or school-wide
    ((SELECT role FROM users WHERE id = auth.uid()) = 'student' AND (target_class_id IS NULL OR target_class_id = (SELECT class_id FROM students WHERE user_id = auth.uid())))
  ))
);
