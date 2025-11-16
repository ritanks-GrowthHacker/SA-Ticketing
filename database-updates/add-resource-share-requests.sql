-- Create resource_share_requests table for cross-department project access requests
-- Employees from other departments can request access to projects
-- Department admins can approve/reject these requests

CREATE TABLE IF NOT EXISTS resource_share_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    requesting_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requesting_department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    target_department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(project_id, requesting_user_id)
);

-- Disable RLS to match the system's API-level authorization pattern
ALTER TABLE resource_share_requests DISABLE ROW LEVEL SECURITY;

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_resource_share_requests_project_id ON resource_share_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_resource_share_requests_requesting_user_id ON resource_share_requests(requesting_user_id);
CREATE INDEX IF NOT EXISTS idx_resource_share_requests_target_dept_id ON resource_share_requests(target_department_id);
CREATE INDEX IF NOT EXISTS idx_resource_share_requests_status ON resource_share_requests(status);

-- Add comments for documentation
COMMENT ON TABLE resource_share_requests IS 'Stores employee requests to access projects from other departments';
COMMENT ON COLUMN resource_share_requests.requesting_user_id IS 'Employee requesting access to the project';
COMMENT ON COLUMN resource_share_requests.requesting_department_id IS 'Department of the requesting employee';
COMMENT ON COLUMN resource_share_requests.target_department_id IS 'Department that owns the project';
COMMENT ON COLUMN resource_share_requests.status IS 'pending, approved, or rejected';

-- Create trigger function to send notifications when request is created or updated
CREATE OR REPLACE FUNCTION notify_on_share_request_change()
RETURNS TRIGGER AS $$
DECLARE
    admin_id UUID;
    project_name TEXT;
    user_name TEXT;
    dept_name TEXT;
BEGIN
    -- Get project and user details
    SELECT p.name INTO project_name FROM projects p WHERE p.id = NEW.project_id;
    SELECT u.name INTO user_name FROM users u WHERE u.id = NEW.requesting_user_id;
    SELECT d.name INTO dept_name FROM departments d WHERE d.id = NEW.requesting_department_id;

    IF (TG_OP = 'INSERT') THEN
        -- Notify department admins when new request is created
        FOR admin_id IN
            SELECT DISTINCT udr.user_id
            FROM user_department_roles udr
            JOIN global_roles gr ON udr.role_id = gr.id
            WHERE udr.department_id = NEW.target_department_id
              AND gr.name = 'Admin'
              AND udr.user_id != NEW.requesting_user_id
        LOOP
            INSERT INTO notifications (user_id, entity_type, entity_id, title, message, type)
            VALUES (
                admin_id,
                'resource_share_request',
                NEW.id,
                'New Resource Access Request',
                user_name || ' from ' || dept_name || ' department requested access to project: ' || project_name,
                'request'
            );
        END LOOP;
    ELSIF (TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected')) THEN
        -- Notify requesting employee when their request is approved/rejected
        INSERT INTO notifications (user_id, entity_type, entity_id, title, message, type)
        VALUES (
            NEW.requesting_user_id,
            'resource_share_request',
            NEW.id,
            CASE 
                WHEN NEW.status = 'approved' THEN 'Access Request Approved'
                ELSE 'Access Request Rejected'
            END,
            'Your request to access project "' || project_name || '" has been ' || NEW.status,
            CASE 
                WHEN NEW.status = 'approved' THEN 'success'
                ELSE 'info'
            END
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_notify_share_request ON resource_share_requests;
CREATE TRIGGER trigger_notify_share_request
    AFTER INSERT OR UPDATE ON resource_share_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_share_request_change();
