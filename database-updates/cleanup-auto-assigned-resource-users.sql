-- Cleanup Script: Remove auto-assigned users from resource requests
-- 
-- Problem: Previously, when a resource request was approved, users were automatically
-- added to user_project table. This was wrong - approval should only grant ACCESS,
-- not automatic project assignment.
--
-- This script removes those auto-assignments so users can be properly assigned
-- via Manage Access with correct roles.

-- Step 1: Identify auto-assigned users from approved resource requests
-- These are users who:
-- 1. Have approved resource requests
-- 2. Are in user_project table for those projects
-- 3. Were assigned with 'Member' role (the default auto-assignment role)

SELECT 
    rr.id as request_id,
    rr.project_id,
    p.name as project_name,
    rr.requested_user_id,
    u.name as user_name,
    u.email as user_email,
    d.name as user_department,
    up.role_id,
    gr.name as assigned_role,
    rr.created_at as request_created,
    rr.reviewed_at as request_approved,
    up.created_at as assignment_created
FROM resource_requests rr
INNER JOIN user_project up ON up.user_id = rr.requested_user_id 
    AND up.project_id = rr.project_id
INNER JOIN users u ON u.id = rr.requested_user_id
INNER JOIN projects p ON p.id = rr.project_id
LEFT JOIN departments d ON d.id = rr.user_department_id
LEFT JOIN global_roles gr ON gr.id = up.role_id
WHERE rr.status = 'approved'
    AND gr.name = 'Member'  -- Auto-assignments were done with Member role
ORDER BY rr.reviewed_at DESC;

-- Step 2: BACKUP - Create a backup table before deletion
CREATE TABLE IF NOT EXISTS user_project_backup_resource_cleanup AS
SELECT up.*, NOW() as backed_up_at
FROM user_project up
INNER JOIN resource_requests rr ON up.user_id = rr.requested_user_id 
    AND up.project_id = rr.project_id
INNER JOIN global_roles gr ON gr.id = up.role_id
WHERE rr.status = 'approved'
    AND gr.name = 'Member';

-- Check backup count
SELECT COUNT(*) as backed_up_assignments FROM user_project_backup_resource_cleanup;

-- Step 3: DELETE auto-assigned users from user_project
-- UNCOMMENT THE BELOW LINES AFTER REVIEWING THE SELECT RESULTS ABOVE

-- DELETE FROM user_project
-- WHERE id IN (
--     SELECT up.id
--     FROM user_project up
--     INNER JOIN resource_requests rr ON up.user_id = rr.requested_user_id 
--         AND up.project_id = rr.project_id
--     INNER JOIN global_roles gr ON gr.id = up.role_id
--     WHERE rr.status = 'approved'
--         AND gr.name = 'Member'
-- );

-- Step 4: Verify deletion
-- SELECT COUNT(*) as remaining_auto_assignments
-- FROM user_project up
-- INNER JOIN resource_requests rr ON up.user_id = rr.requested_user_id 
--     AND up.project_id = rr.project_id
-- INNER JOIN global_roles gr ON gr.id = up.role_id
-- WHERE rr.status = 'approved'
--     AND gr.name = 'Member';

-- Expected result: 0

-- Step 5: Verify users can still be assigned via Manage Access
-- Check that shared_projects entries still exist
SELECT 
    sp.project_id,
    p.name as project_name,
    sp.department_id,
    d.name as shared_with_department,
    sp.shared_by,
    u.name as shared_by_user,
    sp.created_at
FROM shared_projects sp
INNER JOIN projects p ON p.id = sp.project_id
INNER JOIN departments d ON d.id = sp.department_id
INNER JOIN users u ON u.id = sp.shared_by
ORDER BY sp.created_at DESC;

-- Note: After running this cleanup, users from restricted departments (HR/Sales/Admin)
-- who had approved resource requests will need to be manually assigned to projects
-- via Manage Access with appropriate roles.
