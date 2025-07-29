-- Drop the type if it exists to avoid errors on re-run in development
-- In production, you would use a more robust migration strategy.
DROP TYPE IF EXISTS user_role;

-- Create the ENUM type for user roles
CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'teacher', 'student');

-- Drop the type if it exists to avoid errors on re-run
DROP TYPE IF EXISTS announcement_audience;

-- Create ENUM type for target audience
CREATE TYPE announcement_audience AS ENUM ('all', 'students', 'teachers');

-- Create the announcements table
CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT now(),
    author_name TEXT NOT NULL,
    posted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    posted_by_role user_role NOT NULL,
    target_audience announcement_audience NOT NULL DEFAULT 'all',
    target_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
    linked_exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_announcements_school_id ON announcements(school_id);
CREATE INDEX idx_announcements_target_class_id ON announcements(target_class_id);
CREATE INDEX idx_announcements_date ON announcements(date DESC);

-- RLS Policies (Example - adjust as needed)
-- Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Allow public read access (or authenticated) based on roles and targeting
CREATE POLICY "Allow public read access" ON announcements
FOR SELECT USING (true);

-- Allow superadmins and admins to manage all announcements in their scope
CREATE POLICY "Allow admin full access" ON announcements
FOR ALL USING (
    (SELECT auth.jwt() ->> 'role') = 'superadmin' OR
    ((SELECT auth.jwt() ->> 'role') = 'admin' AND school_id = (SELECT school_id FROM users WHERE id = auth.uid()))
);

-- Allow teachers to create announcements for their classes
CREATE POLICY "Allow teachers to create for their classes" ON announcements
FOR INSERT WITH CHECK (
    (SELECT auth.jwt() ->> 'role') = 'teacher' AND
    target_class_id IN (SELECT id FROM classes WHERE teacher_id = (SELECT id FROM teachers WHERE user_id = auth.uid()))
);

-- Note: The SELECT policy is broad. For a production system, you'd want to refine it to match the logic in getAnnouncementsAction,
-- ensuring users can only read announcements targeted to them.
-- For example:
-- CREATE POLICY "Allow users to read relevant announcements" ON announcements
-- FOR SELECT USING (
--   -- Global announcements for admins
--   (school_id IS NULL AND (SELECT auth.jwt() ->> 'role') IN ('superadmin', 'admin')) OR
--   -- School-specific announcements
--   (school_id = (SELECT school_id FROM users WHERE id = auth.uid()))
-- );
