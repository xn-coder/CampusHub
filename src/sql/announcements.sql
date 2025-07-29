-- Make sure the user_role ENUM type is created first
-- CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'teacher', 'student');

CREATE TABLE announcements (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    author_name TEXT NOT NULL,
    posted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    posted_by_role user_role NOT NULL,
    target_class_id uuid REFERENCES classes(id) ON DELETE SET NULL,
    school_id uuid REFERENCES schools(id) ON DELETE CASCADE,
    linked_exam_id uuid REFERENCES exams(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for faster lookups
CREATE INDEX idx_announcements_school_id ON announcements(school_id);
CREATE INDEX idx_announcements_target_class_id ON announcements(target_class_id);
CREATE INDEX idx_announcements_date ON announcements(date DESC);

-- Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Policies
-- Allow users to see global announcements (no school_id)
CREATE POLICY "Allow authenticated users to see global announcements" ON announcements
FOR SELECT TO authenticated
USING (school_id IS NULL);

-- Allow users to see announcements for their own school
CREATE POLICY "Allow users to see announcements for their school" ON announcements
FOR SELECT TO authenticated
USING (auth.uid() IN (
  SELECT user_id FROM students WHERE school_id = announcements.school_id
  UNION ALL
  SELECT user_id FROM teachers WHERE school_id = announcements.school_id
  UNION ALL
  SELECT id FROM users WHERE role = 'admin' AND school_id = announcements.school_id
));

-- Allow admin and superadmin to insert announcements
CREATE POLICY "Allow admins to create announcements" ON announcements
FOR INSERT TO authenticated
WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('admin', 'superadmin')
);
