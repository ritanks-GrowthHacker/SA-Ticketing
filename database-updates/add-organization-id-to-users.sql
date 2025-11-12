-- Add organization_id column to users table if it doesn't exist
-- This allows direct organization association instead of separate junction table

-- Add organization_id column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);

-- Update RLS policies for organization-based access (if they don't already exist)
DROP POLICY IF EXISTS "Users can view users in their organization" ON users;
CREATE POLICY "Users can view users in their organization" ON users
    FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

COMMENT ON COLUMN users.organization_id IS 'Organization that the user belongs to';