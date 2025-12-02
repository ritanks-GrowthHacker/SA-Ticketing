-- Clear All Users and Related Data
-- WARNING: This will delete ALL users and their associated data!

BEGIN;

-- 1. Delete all tickets
TRUNCATE TABLE tickets CASCADE;

-- 2. Delete all comments
TRUNCATE TABLE comments CASCADE;

-- 3. Delete all ticket assignments
TRUNCATE TABLE ticket_assignments CASCADE;

-- 4. Delete all activity logs
TRUNCATE TABLE activity_logs CASCADE;

-- 5. Delete all project user relations
TRUNCATE TABLE project_user_relation CASCADE;

-- 6. Delete all user preferences
TRUNCATE TABLE user_preferences CASCADE;

-- 7. Delete attendance records (run on HRM database - port 5433)
-- TRUNCATE TABLE attendance CASCADE;

-- 8. Finally, clear users table
TRUNCATE TABLE users CASCADE;

COMMIT;

-- To rollback if something goes wrong:
-- ROLLBACK;
