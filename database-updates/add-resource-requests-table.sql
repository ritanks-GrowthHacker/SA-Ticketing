-- Resource Requests Table
-- Tracks requests for employees from other departments

CREATE TABLE IF NOT EXISTS resource_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requested_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, rejected
    message TEXT,
    review_notes TEXT,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_resource_requests_project_id ON resource_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_resource_requests_requested_by ON resource_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_resource_requests_requested_user_id ON resource_requests(requested_user_id);
CREATE INDEX IF NOT EXISTS idx_resource_requests_user_department_id ON resource_requests(user_department_id);
CREATE INDEX IF NOT EXISTS idx_resource_requests_status ON resource_requests(status);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_resource_requests_updated_at ON resource_requests;
CREATE TRIGGER update_resource_requests_updated_at BEFORE UPDATE ON resource_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE resource_requests IS 'Requests for cross-department resource allocation';
