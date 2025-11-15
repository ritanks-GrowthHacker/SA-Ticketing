-- Disable RLS on resource_requests table to match other tables in the system
-- This allows normal database operations without row-level security restrictions

ALTER TABLE resource_requests DISABLE ROW LEVEL SECURITY;

-- Drop any existing RLS policies on resource_requests (if any exist)
DROP POLICY IF EXISTS resource_requests_policy ON resource_requests;
