-- Create project_department junction table to associate projects with departments
-- This enables department-scoped project visibility for department admins

CREATE TABLE IF NOT EXISTS project_department (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, department_id)
);

-- Disable RLS to match the system's API-level authorization pattern
ALTER TABLE project_department DISABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_department_project_id ON project_department(project_id);
CREATE INDEX IF NOT EXISTS idx_project_department_department_id ON project_department(department_id);

-- Add comment for documentation
COMMENT ON TABLE project_department IS 'Junction table associating projects with departments for scoped visibility';
