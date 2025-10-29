# Database Schema Migration for SA-Ticketing

## Current Schema Analysis

Your current schema uses:
- `user_organization` junction table (not direct `users.organization_id`)  
- No `organizations.is_master` column yet
- `projects` table may not exist

## Required SQL Migration Scripts

Run these SQL commands in your Supabase SQL editor:

### 1. Add is_master column to organizations table
```sql
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS is_master BOOLEAN DEFAULT FALSE;

-- Set your main organization as master (replace 'your-domain.com' with actual domain)
UPDATE organizations 
SET is_master = TRUE 
WHERE domain = 'your-domain.com';
```

### 2. Create projects table
```sql
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE,
    end_date DATE,
    status VARCHAR(100) DEFAULT 'Planning',
    priority VARCHAR(100) DEFAULT 'Medium',
    budget DECIMAL(12,2),
    project_manager_id UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id) NOT NULL,
    organization_id UUID REFERENCES organizations(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_project_name_per_org UNIQUE(name, organization_id),
    CONSTRAINT valid_budget CHECK (budget >= 0),
    CONSTRAINT valid_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date > start_date)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_project_manager_id ON projects(project_manager_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_priority ON projects(priority);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
```

### 3. Enable Row Level Security (RLS) for projects table
```sql
-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see projects from their organization
CREATE POLICY "Users can view projects from their organization" 
ON projects FOR SELECT 
TO authenticated 
USING (
    organization_id IN (
        SELECT uo.organization_id 
        FROM user_organization uo 
        WHERE uo.user_id = auth.uid()
    )
);

-- Policy: Admin/Manager can create projects in their organization
CREATE POLICY "Admin and Manager can create projects" 
ON projects FOR INSERT 
TO authenticated 
WITH CHECK (
    organization_id IN (
        SELECT uo.organization_id 
        FROM user_organization uo 
        JOIN roles r ON r.id = uo.role_id 
        WHERE uo.user_id = auth.uid() 
        AND r.name IN ('Admin', 'Manager')
    )
);

-- Policy: Admin/Manager can update projects in their organization
CREATE POLICY "Admin and Manager can update projects" 
ON projects FOR UPDATE 
TO authenticated 
USING (
    organization_id IN (
        SELECT uo.organization_id 
        FROM user_organization uo 
        JOIN roles r ON r.id = uo.role_id 
        WHERE uo.user_id = auth.uid() 
        AND r.name IN ('Admin', 'Manager')
    )
);

-- Policy: Admin can delete projects in their organization
CREATE POLICY "Admin can delete projects" 
ON projects FOR DELETE 
TO authenticated 
USING (
    organization_id IN (
        SELECT uo.organization_id 
        FROM user_organization uo 
        JOIN roles r ON r.id = uo.role_id 
        WHERE uo.user_id = auth.uid() 
        AND r.name = 'Admin'
    )
);
```

### 4. Create updated_at trigger for projects table
```sql
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON projects 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
```

## Quick Setup Instructions

1. **Go to Supabase Dashboard** → Your Project → SQL Editor
2. **Copy and paste** each SQL block above one at a time
3. **Click "Run"** for each block
4. **Update the domain** in step 1 to match your master organization
5. **Test the API** after running all migrations

## Verification Query

After running the migrations, verify with:
```sql
-- Check if projects table exists with correct columns
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'projects' 
ORDER BY ordinal_position;

-- Check if is_master column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'organizations' AND column_name = 'is_master';

-- Check master organizations
SELECT id, name, domain, is_master 
FROM organizations 
WHERE is_master = TRUE;
```