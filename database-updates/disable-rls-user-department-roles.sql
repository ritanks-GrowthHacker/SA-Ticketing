-- Disable RLS on user_department_roles table to match other tables in the system
-- This allows normal database operations without row-level security restrictions

ALTER TABLE user_department_roles DISABLE ROW LEVEL SECURITY;

-- Drop any existing RLS policies on user_department_roles (if any exist)
DROP POLICY IF EXISTS user_department_roles_policy ON user_department_roles;
