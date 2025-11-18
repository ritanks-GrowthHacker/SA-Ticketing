-- Fix foreign key constraints to allow user deletion
-- This script updates the tickets table foreign keys to handle user deletion properly
-- Date: November 18, 2025

-- Drop existing foreign key constraints
ALTER TABLE tickets 
DROP CONSTRAINT IF EXISTS tickets_assigned_to_fkey,
DROP CONSTRAINT IF EXISTS tickets_created_by_fkey;

-- Recreate with ON DELETE SET NULL for assigned_to (preserve ticket, just remove assignment)
ALTER TABLE tickets
ADD CONSTRAINT tickets_assigned_to_fkey 
FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

-- Recreate with ON DELETE SET NULL for created_by (preserve ticket history)
ALTER TABLE tickets
ADD CONSTRAINT tickets_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- Similarly fix other tables that reference users

-- PROJECT_DOCUMENTS
ALTER TABLE project_documents 
DROP CONSTRAINT IF EXISTS project_documents_created_by_fkey,
DROP CONSTRAINT IF EXISTS project_documents_updated_by_fkey;

ALTER TABLE project_documents
ADD CONSTRAINT project_documents_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT project_documents_updated_by_fkey 
FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- PROJECTS
ALTER TABLE projects 
DROP CONSTRAINT IF EXISTS projects_created_by_fkey;

ALTER TABLE projects
ADD CONSTRAINT projects_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- DEPARTMENTS
ALTER TABLE departments 
DROP CONSTRAINT IF EXISTS departments_created_by_fkey;

ALTER TABLE departments
ADD CONSTRAINT departments_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- USER_ASSIGNMENTS (this one should cascade - if user deleted, remove their assignments)
ALTER TABLE user_assignments 
DROP CONSTRAINT IF EXISTS user_assignments_user_id_fkey,
DROP CONSTRAINT IF EXISTS user_assignments_assigned_by_fkey;

ALTER TABLE user_assignments
ADD CONSTRAINT user_assignments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
ADD CONSTRAINT user_assignments_assigned_by_fkey 
FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL;

-- TICKET_COMMENTS
ALTER TABLE ticket_comments 
DROP CONSTRAINT IF EXISTS ticket_comments_user_id_fkey;

ALTER TABLE ticket_comments
ADD CONSTRAINT ticket_comments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- RESOURCE_REQUESTS
ALTER TABLE resource_requests 
DROP CONSTRAINT IF EXISTS resource_requests_requested_by_fkey,
DROP CONSTRAINT IF EXISTS resource_requests_requested_user_id_fkey,
DROP CONSTRAINT IF EXISTS resource_requests_reviewed_by_fkey;

ALTER TABLE resource_requests
ADD CONSTRAINT resource_requests_requested_by_fkey 
FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT resource_requests_requested_user_id_fkey 
FOREIGN KEY (requested_user_id) REFERENCES users(id) ON DELETE SET NULL,
ADD CONSTRAINT resource_requests_reviewed_by_fkey 
FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL;

-- Note: user_roles and user_department_roles already have ON DELETE CASCADE which is correct
-- These should be deleted when the user is deleted

COMMENT ON TABLE tickets IS 'Updated foreign keys to SET NULL on user deletion to preserve ticket history';
