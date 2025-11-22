-- Add role_id column to resource_requests table
-- This allows specifying what role the user should have when added to the project

ALTER TABLE resource_requests 
ADD COLUMN IF NOT EXISTS requested_role_id UUID REFERENCES global_roles(id);

-- Set default to Member role for existing records
UPDATE resource_requests 
SET requested_role_id = (SELECT id FROM global_roles WHERE name = 'Member' LIMIT 1)
WHERE requested_role_id IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_resource_requests_requested_role_id 
ON resource_requests(requested_role_id);

COMMENT ON COLUMN resource_requests.requested_role_id IS 'Role to assign when request is approved';
