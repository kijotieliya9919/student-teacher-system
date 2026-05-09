-- Supabase Migration: Student-Teacher System
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/jajfahyuglhbftphsktk/sql/new)

-- 1. Create tables
CREATE TABLE IF NOT EXISTS users (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'student' CHECK (role IN ('admin', 'teacher', 'student')),
  is_active BOOLEAN DEFAULT TRUE,
  must_change_password BOOLEAN DEFAULT FALSE,
  class_name TEXT,
  program_id BIGINT,
  course_id BIGINT,
  student_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS programs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  department TEXT,
  duration_months INTEGER DEFAULT 12
);

CREATE TABLE IF NOT EXISTS courses (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  program_id BIGINT REFERENCES programs(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  credits INTEGER DEFAULT 3
);

CREATE TABLE IF NOT EXISTS enrollments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  course_id BIGINT REFERENCES courses(id) ON DELETE CASCADE,
  enrollment_date TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
  UNIQUE(student_id, course_id)
);

CREATE TABLE IF NOT EXISTS assignments (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id BIGINT REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  instructor_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS submissions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  assignment_id BIGINT REFERENCES assignments(id) ON DELETE CASCADE,
  file_path TEXT,
  grade TEXT,
  feedback TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies (anon key can read/write based on role)
-- Users: can read own data, admin can read all
CREATE POLICY "users_select_own" ON users FOR SELECT USING (auth.uid()::text = id::text OR role = 'admin');
CREATE POLICY "users_insert_admin" ON users FOR INSERT WITH CHECK (role = 'admin');
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid()::text = id::text OR role = 'admin');

-- Programs: public read, admin write
CREATE POLICY "programs_select_all" ON programs FOR SELECT USING (true);
CREATE POLICY "programs_insert_admin" ON programs FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));

-- Courses: public read, admin/teacher write
CREATE POLICY "courses_select_all" ON courses FOR SELECT USING (true);
CREATE POLICY "courses_insert_admin" ON courses FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role IN ('admin', 'teacher')));

-- Enrollments: own only, admin all
CREATE POLICY "enrollments_select_own" ON enrollments FOR SELECT USING (student_id::text = auth.uid()::text OR EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));
CREATE POLICY "enrollments_insert_own" ON enrollments FOR INSERT WITH CHECK (student_id::text = auth.uid()::text);

-- Assignments: students see their class, teachers see own, admin all
CREATE POLICY "assignments_select" ON assignments FOR SELECT USING (
  EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
  OR instructor_id::text = auth.uid()::text
  OR EXISTS (
    SELECT 1 FROM users u JOIN courses c ON c.title = u.class_name
    WHERE u.id::text = auth.uid()::text AND c.id = course_id
  )
  OR EXISTS (
    SELECT 1 FROM enrollments e WHERE e.student_id::text = auth.uid()::text AND e.course_id = course_id
  )
);
CREATE POLICY "assignments_insert_teacher" ON assignments FOR INSERT WITH CHECK (instructor_id::text = auth.uid()::text AND EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'teacher'));

-- Submissions: own + teacher of assignment
CREATE POLICY "submissions_select" ON submissions FOR SELECT USING (
  student_id::text = auth.uid()::text
  OR EXISTS (SELECT 1 FROM assignments a WHERE a.id = assignment_id AND a.instructor_id::text = auth.uid()::text)
  OR EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
);
CREATE POLICY "submissions_insert_student" ON submissions FOR INSERT WITH CHECK (student_id::text = auth.uid()::text);

-- Notifications: own only
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT USING (user_id::text = auth.uid()::text);
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE USING (user_id::text = auth.uid()::text);

-- Audit logs: admin only
CREATE POLICY "audit_logs_select_admin" ON audit_logs FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin'));

-- 4. Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 5. Seed default programs
INSERT INTO programs (name, code, department, duration_months) VALUES
  ('Basic Certificate in Forestry', 'BCF', 'Forestry', 6),
  ('Technician Certificate in Forestry', 'TCF', 'Forestry Technology', 12),
  ('Ordinary Diploma in Forest', 'ODF', 'Forestry', 24)
ON CONFLICT (code) DO NOTHING;

-- 6. Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('assignments', 'assignments', true),
  ('submissions', 'submissions', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read on storage
CREATE POLICY "storage_read_public" ON storage.objects FOR SELECT USING (bucket_id IN ('assignments', 'submissions'));
CREATE POLICY "storage_insert_teachers" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id IN ('assignments', 'submissions')
  AND EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role IN ('teacher', 'admin'))
);
