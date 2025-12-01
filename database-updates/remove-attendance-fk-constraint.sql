-- =====================================================
-- REMOVE FOREIGN KEY CONSTRAINT FROM ATTENDANCE
-- Run this on human_resource_module database (port 5433)
-- =====================================================

-- Drop the foreign key constraint
ALTER TABLE public.attendance 
DROP CONSTRAINT IF EXISTS attendance_employee_id_fkey;

-- Verify constraint is removed
SELECT 
    con.conname as constraint_name,
    con.contype as constraint_type
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'attendance';

-- Now attendance table can accept any employee_id (user_id) without needing employees table!
COMMENT ON TABLE public.attendance IS 'Daily attendance - employee_id is directly user_id from ticketing system (no FK constraint)';
