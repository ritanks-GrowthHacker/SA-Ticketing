-- =============================================
-- NOTIFICATIONS SYSTEM
-- =============================================
-- This SQL creates the notifications table and trigger for real-time notifications
-- Run this in your Supabase SQL Editor

-- Add missing columns to existing notifications table
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS type VARCHAR DEFAULT 'info',
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITHOUT TIME ZONE;

-- Add constraint for type column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'notifications_type_check'
  ) THEN
    ALTER TABLE notifications 
    ADD CONSTRAINT notifications_type_check 
    CHECK (type IN ('info', 'success', 'warning', 'error', 'resource_request'));
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Create function to get department admins
CREATE OR REPLACE FUNCTION get_department_admins(dept_id UUID, org_id UUID)
RETURNS TABLE (admin_user_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT udr.user_id
  FROM user_department_roles udr
  JOIN global_roles gr ON udr.role_id = gr.id
  WHERE udr.department_id = dept_id
    AND udr.organization_id = org_id
    AND gr.name = 'Admin';
END;
$$ LANGUAGE plpgsql;

-- Create function to notify department admins when resource request is created
CREATE OR REPLACE FUNCTION notify_department_admin_on_resource_request()
RETURNS TRIGGER AS $$
DECLARE
  admin_id UUID;
  requester_name TEXT;
  requested_user_name TEXT;
  department_name TEXT;
BEGIN
  -- Get requester name
  SELECT name INTO requester_name FROM users WHERE id = NEW.requested_by;
  
  -- Get requested user name
  SELECT name INTO requested_user_name FROM users WHERE id = NEW.requested_user_id;
  
  -- Get department name
  SELECT name INTO department_name FROM departments WHERE id = NEW.user_department_id;
  
  -- Create notification for each admin of the department (exclude the requester)
  FOR admin_id IN 
    SELECT * FROM get_department_admins(NEW.user_department_id, (SELECT organization_id FROM projects WHERE id = NEW.project_id))
  LOOP
    -- Only send notification if admin is not the requester
    IF admin_id != NEW.requested_by THEN
      INSERT INTO notifications (
        user_id,
        entity_type,
        entity_id,
        title,
        message,
        type,
        is_read,
        created_at
      ) VALUES (
        admin_id,
        'resource_request',
        NEW.id,
        'New Resource Request',
        requester_name || ' has requested ' || requested_user_name || ' from your department (' || department_name || ')',
        'resource_request',
        false,
        NOW()
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on resource_requests table
DROP TRIGGER IF EXISTS resource_request_notification_trigger ON resource_requests;
CREATE TRIGGER resource_request_notification_trigger
  AFTER INSERT ON resource_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_department_admin_on_resource_request();

-- Disable RLS on notifications table (to match other tables)
ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE notifications IS 'User notifications for various events including resource requests';
COMMENT ON FUNCTION get_department_admins IS 'Returns all admin users for a given department in an organization';
COMMENT ON FUNCTION notify_department_admin_on_resource_request IS 'Automatically creates notifications for department admins when resource request is submitted';
