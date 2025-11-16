-- Create shared_projects table for cross-department project visibility
-- This allows projects to be shared with multiple departments
-- Example: Engineering initiates a project, but Design and Administration teams work on it
-- Those departments' admins will also see this project in their dashboard

CREATE TABLE IF NOT EXISTS shared_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    shared_by UUID REFERENCES users(id),
    shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, department_id)
);

-- Disable RLS to match the system's API-level authorization pattern
ALTER TABLE shared_projects DISABLE ROW LEVEL SECURITY;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_shared_projects_project_id ON shared_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_shared_projects_department_id ON shared_projects(department_id);

-- Add comment for documentation
COMMENT ON TABLE shared_projects IS 'Stores cross-department project sharing relationships. Allows projects to be visible to multiple department admins.';
COMMENT ON COLUMN shared_projects.project_id IS 'The project being shared';
COMMENT ON COLUMN shared_projects.department_id IS 'The department with which the project is shared';
COMMENT ON COLUMN shared_projects.shared_by IS 'User who shared the project';
