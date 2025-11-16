# Department-Scoped Projects with Sharing Feature

## Summary of Changes

### Issue 1: Multiple Department Entries
**Problem**: When creating a project, multiple entries were being created in `project_department` table (one for each department the user is admin of).

**Solution**: Modified `create-project` API to only use the user's PRIMARY department (from `users.department_id` field) instead of all departments they have admin rights to.

### Issue 2: Cross-Department Project Sharing
**Problem**: Projects couldn't be shared across departments. If Engineering initiates a project but Design and Administration teams work on it, those department admins couldn't see the project.

**Solution**: Created `shared_projects` table to allow projects to be shared with multiple departments.

## Database Migrations

Run these SQL commands in Supabase SQL Editor:

### 1. Create project_department Table (if not exists)
```sql
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

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_project_department_project_id ON project_department(project_id);
CREATE INDEX IF NOT EXISTS idx_project_department_department_id ON project_department(department_id);

-- Add comment for documentation
COMMENT ON TABLE project_department IS 'Junction table associating projects with departments for scoped visibility';
```

### 2. Create shared_projects Table
```sql
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
```

### 3. Clean Up Existing Duplicate Entries (Optional)
```sql
-- If you want to clean up existing duplicate entries and keep only one per project
-- WARNING: This will delete duplicate entries. Review before running.

-- First, check if there are duplicates
SELECT project_id, COUNT(*) as count
FROM project_department
GROUP BY project_id
HAVING COUNT(*) > 1;

-- Delete duplicates, keeping the oldest entry (earliest created_at)
DELETE FROM project_department pd1
USING project_department pd2
WHERE pd1.project_id = pd2.project_id
  AND pd1.created_at > pd2.created_at;

-- Alternative: If created_at is the same, keep random one using CTID
DELETE FROM project_department
WHERE ctid NOT IN (
  SELECT MIN(ctid)
  FROM project_department
  GROUP BY project_id
);
```

## How It Works

### Project Creation
1. When a department admin creates a project, it's associated with their PRIMARY department only
2. The `users.department_id` field determines which department owns the project
3. One entry is inserted into `project_department` table

### Project Visibility for Department Admins
Department admins see TWO types of projects:

1. **Owned Projects**: Projects created by their department (via `project_department` table)
2. **Shared Projects**: Projects shared with their department (via `shared_projects` table)

### Project Sharing Workflow (Future Implementation)
To share a project with other departments:
1. Create an API endpoint to insert into `shared_projects` table
2. Example: Engineering admin shares project with Design department
   ```sql
   INSERT INTO shared_projects (project_id, department_id, shared_by)
   VALUES ('project-uuid', 'design-dept-uuid', 'current-user-uuid');
   ```
3. Design department admin will now see this project in their dashboard

### Organization-Level Admin
- Org-level admins continue to see ALL projects in the organization
- No filtering by department applied

## API Changes

### Modified Files:
1. `app/api/create-project/route.tsx`
   - Now fetches user's primary `department_id` from `users` table
   - Creates single entry in `project_department` table

2. `app/api/get-all-projects/route.tsx`
   - Department admins now see owned + shared projects
   - Fetches from both `project_department` and `shared_projects` tables
   - Deduplicates results
   - Adds `is_shared` flag to indicate shared projects

## Next Steps

### To Use Shared Projects Feature:
You'll need to create a UI and API for sharing projects:

**API Endpoint Example**: `app/api/share-project/route.tsx`
```typescript
// POST endpoint to share a project with another department
export async function POST(req: Request) {
  const { project_id, department_id } = await req.json();
  
  const { error } = await supabase
    .from("shared_projects")
    .insert({
      project_id,
      department_id,
      shared_by: decodedToken.sub
    });
    
  // Return success/error
}
```

**UI Component**: Add a "Share Project" button in project details/settings that shows a department selector.

## Testing

1. **Test Department Scoping**:
   - Login as Administration department admin
   - Create a project "Project A"
   - Login as Engineering department admin
   - Verify you DON'T see "Project A"

2. **Test Shared Projects**:
   - Manually insert into `shared_projects` table:
     ```sql
     INSERT INTO shared_projects (project_id, department_id, shared_by)
     VALUES ('project-a-uuid', 'engineering-dept-uuid', 'admin-user-uuid');
     ```
   - Login as Engineering department admin
   - Verify you now see "Project A" with `is_shared: true`
