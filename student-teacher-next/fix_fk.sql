-- Fix: Drop old FK constraint and recreate it pointing to assignments_new
ALTER TABLE submissions DROP CONSTRAINT IF EXISTS submissions_assignment_id_fkey;

ALTER TABLE submissions ADD CONSTRAINT submissions_assignment_id_fkey
  FOREIGN KEY (assignment_id) REFERENCES assignments_new(id) ON DELETE CASCADE;
