-- ============================================
-- Copy EVERYTHING below and paste into:
-- https://supabase.com/dashboard/project/jajfahyuglhbftphsktk/sql/new
-- ============================================

-- 1. Create classes table
CREATE TABLE IF NOT EXISTS classes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  teacher_id UUID REFERENCES users(id),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add class_id to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS class_id BIGINT REFERENCES classes(id);

-- 3. Create assignments_new table
CREATE TABLE IF NOT EXISTS assignments_new (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT,
  file_name TEXT,
  file_type TEXT,
  teacher_id UUID REFERENCES users(id) NOT NULL,
  class_id BIGINT REFERENCES classes(id) NOT NULL,
  deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments_new ENABLE ROW LEVEL SECURITY;

-- 5. RLS for classes
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'classes_select_all' AND tablename = 'classes') THEN
    CREATE POLICY "classes_select_all" ON classes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'classes_insert_teacher' AND tablename = 'classes') THEN
    CREATE POLICY "classes_insert_teacher" ON classes FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role IN ('teacher', 'admin')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'classes_update_teacher' AND tablename = 'classes') THEN
    CREATE POLICY "classes_update_teacher" ON classes FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role IN ('teacher', 'admin')));
  END IF;
END $$;

-- 6. RLS for assignments_new
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'assignments_select_student' AND tablename = 'assignments_new') THEN
    CREATE POLICY "assignments_select_student" ON assignments_new FOR SELECT USING (
      class_id IN (SELECT class_id FROM users WHERE id::text = auth.uid()::text)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'assignments_select_teacher' AND tablename = 'assignments_new') THEN
    CREATE POLICY "assignments_select_teacher" ON assignments_new FOR SELECT USING (
      teacher_id::text = auth.uid()::text
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'assignments_select_admin' AND tablename = 'assignments_new') THEN
    CREATE POLICY "assignments_select_admin" ON assignments_new FOR SELECT USING (
      EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'admin')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'assignments_insert_teacher' AND tablename = 'assignments_new') THEN
    CREATE POLICY "assignments_insert_teacher" ON assignments_new FOR INSERT WITH CHECK (
      teacher_id::text = auth.uid()::text AND EXISTS (SELECT 1 FROM users WHERE id::text = auth.uid()::text AND role = 'teacher')
    );
  END IF;
END $$;

-- 7. Seed a default class
INSERT INTO classes (name, code, description) VALUES
  ('Basic Certificate in Forestry Year 1', 'BCF-Y1', 'First year BCF students')
ON CONFLICT (code) DO NOTHING;

-- 8. Set class_id for existing students
UPDATE users SET class_id = 1 WHERE class_name IS NOT NULL AND class_id IS NULL;

-- 9. Assign teacher to class
UPDATE classes SET teacher_id = (SELECT id FROM users WHERE role = 'teacher' LIMIT 1) WHERE teacher_id IS NULL AND id = 1;
