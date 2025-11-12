-- Create invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  job_title VARCHAR(255),
  phone VARCHAR(20),
  invitation_token VARCHAR(255) UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'base64'),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  completed_at TIMESTAMPTZ,
  UNIQUE(organization_id, email)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_invitations_org_id ON invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_dept_id ON invitations(department_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires ON invitations(expires_at);

-- Enable RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (Allow public access for API operations)
CREATE POLICY "Allow all operations on invitations" ON invitations
  FOR ALL USING (true);

-- Alternative: If you want to restrict later, you can replace with:
-- CREATE POLICY "Organizations can manage their invitations" ON invitations
--   FOR ALL USING (
--     auth.uid() IS NULL OR  -- Allow API calls
--     organization_id IN (
--       SELECT organization_id 
--       FROM users 
--       WHERE id = auth.uid()
--     )
--   );