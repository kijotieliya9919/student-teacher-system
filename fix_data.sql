-- Fix 1: Assign the class to the correct teacher
UPDATE classes 
SET teacher_id = (SELECT id FROM users WHERE email = 'teacher@forestry.edu') 
WHERE id = 1;

-- Fix 2: Migrate old assignments to new table
INSERT INTO assignments_new (title, description, file_path, file_name, file_type, teacher_id, class_id, deadline, created_at)
SELECT a.title, a.description, a.file_path, a.file_name, a.file_type, a.instructor_id, 1, a.deadline, a.created_at
FROM assignments a
WHERE a.instructor_id = (SELECT id FROM users WHERE email = 'teacher@forestry.edu')
ON CONFLICT DO NOTHING;
