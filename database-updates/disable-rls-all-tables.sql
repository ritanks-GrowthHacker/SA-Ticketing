-- =============================================
-- DISABLE RLS ON ALL TABLES
-- =============================================
-- This SQL disables Row-Level Security (RLS) on all tables in the database
-- to match the application's security model which uses API-level authentication
-- Run this in your Supabase SQL Editor

-- Disable RLS on all user-related tables
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_organization_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_department_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_project DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_department DISABLE ROW LEVEL SECURITY;

-- Disable RLS on organization and department tables
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE departments DISABLE ROW LEVEL SECURITY;
ALTER TABLE global_roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE invitations DISABLE ROW LEVEL SECURITY;

-- Disable RLS on project-related tables
ALTER TABLE projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_statuses DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_department DISABLE ROW LEVEL SECURITY;
ALTER TABLE project_docs DISABLE ROW LEVEL SECURITY;

-- Disable RLS on ticket-related tables
ALTER TABLE tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments DISABLE ROW LEVEL SECURITY;
ALTER TABLE statuses DISABLE ROW LEVEL SECURITY;

-- Disable RLS on notification and activity tables
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE attachments DISABLE ROW LEVEL SECURITY;

-- Disable RLS on resource request tables
ALTER TABLE resource_requests DISABLE ROW LEVEL SECURITY;

-- Disable RLS on meeting-related tables
ALTER TABLE meetings DISABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_moms DISABLE ROW LEVEL SECURITY;

-- Disable RLS on tag-related tables
ALTER TABLE tags DISABLE ROW LEVEL SECURITY;
ALTER TABLE entity_tags DISABLE ROW LEVEL SECURITY;

-- Drop all existing RLS policies (clean up)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT schemaname, tablename, policyname 
              FROM pg_policies 
              WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Verify RLS is disabled on all tables
SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN rowsecurity THEN 'ENABLED ⚠️' 
        ELSE 'DISABLED ✓' 
    END as rls_status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

COMMENT ON SCHEMA public IS 'RLS disabled on all tables - using API-level authentication';
