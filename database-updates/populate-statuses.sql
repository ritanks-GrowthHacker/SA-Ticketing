-- Populate statuses table with ticket statuses
-- First, get a sample organization_id (replace with your actual org ID)
-- Run: SELECT id FROM organizations LIMIT 1;

-- Insert ticket statuses
INSERT INTO statuses (name, type, color_code, sort_order, is_active, organization_id) VALUES
('Open', 'ticket', '#ef4444', 1, true, NULL),
('In Progress', 'ticket', '#f59e0b', 2, true, NULL),
('Under Review', 'ticket', '#3b82f6', 3, true, NULL),
('Resolved', 'ticket', '#10b981', 4, true, NULL),
('Closed', 'ticket', '#6b7280', 5, true, NULL),
('Blocked', 'ticket', '#dc2626', 6, true, NULL),
('Pending', 'ticket', '#f97316', 7, true, NULL)
ON CONFLICT DO NOTHING;

-- Insert ticket priorities
INSERT INTO statuses (name, type, color_code, sort_order, is_active, organization_id) VALUES
('Low', 'priority', '#10b981', 1, true, NULL),
('Medium', 'priority', '#f59e0b', 2, true, NULL),
('High', 'priority', '#ef4444', 3, true, NULL),
('Critical', 'priority', '#dc2626', 4, true, NULL)
ON CONFLICT DO NOTHING;

-- Verify insertion
SELECT name, type, color_code FROM statuses ORDER BY type, sort_order;
