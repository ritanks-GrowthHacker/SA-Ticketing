-- ========================================
-- MAIN DATABASE PERFORMANCE INDEXES
-- Run this in your Main Supabase database
-- ========================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_org_dept ON users(organization_id, department_id);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Notifications table indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_entity_type ON notifications(entity_type);
CREATE INDEX IF NOT EXISTS idx_notifications_entity_id ON notifications(entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Tickets table indexes
CREATE INDEX IF NOT EXISTS idx_tickets_project_id ON tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_updated_by ON tickets(updated_by);
CREATE INDEX IF NOT EXISTS idx_tickets_status_id ON tickets(status_id);
CREATE INDEX IF NOT EXISTS idx_tickets_priority_id ON tickets(priority_id);
CREATE INDEX IF NOT EXISTS idx_tickets_updated_at ON tickets(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_project_status ON tickets(project_id, status_id);
CREATE INDEX IF NOT EXISTS idx_tickets_project_assigned ON tickets(project_id, assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_expected_closing ON tickets(expected_closing_date);

-- Ticket comments indexes
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_user_id ON ticket_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_organization_id ON ticket_comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_parent_id ON ticket_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON ticket_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_not_deleted ON ticket_comments(ticket_id, is_deleted) WHERE is_deleted = false;

-- Projects table indexes
CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_updated_by ON projects(updated_by);
CREATE INDEX IF NOT EXISTS idx_projects_status_id ON projects(status_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_org_created ON projects(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_org_status ON projects(organization_id, status_id);

-- Project docs indexes
CREATE INDEX IF NOT EXISTS idx_project_docs_project_id ON project_docs(project_id);
CREATE INDEX IF NOT EXISTS idx_project_docs_author_id ON project_docs(author_id);
CREATE INDEX IF NOT EXISTS idx_project_docs_updated_by ON project_docs(updated_by);
CREATE INDEX IF NOT EXISTS idx_project_docs_visibility ON project_docs(visibility);
CREATE INDEX IF NOT EXISTS idx_project_docs_is_public ON project_docs(is_public);
CREATE INDEX IF NOT EXISTS idx_project_docs_created_at ON project_docs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_docs_updated_at ON project_docs(updated_at DESC);

-- Organizations table indexes
CREATE INDEX IF NOT EXISTS idx_organizations_domain ON organizations(domain);
CREATE INDEX IF NOT EXISTS idx_organizations_username ON organizations(username);
CREATE INDEX IF NOT EXISTS idx_organizations_org_email ON organizations(org_email);
CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations(is_active);
CREATE INDEX IF NOT EXISTS idx_organizations_created_at ON organizations(created_at DESC);

-- Departments table indexes
CREATE INDEX IF NOT EXISTS idx_departments_name ON departments(name);
CREATE INDEX IF NOT EXISTS idx_departments_is_active ON departments(is_active);
CREATE INDEX IF NOT EXISTS idx_departments_sort_order ON departments(sort_order);

-- User department indexes
CREATE INDEX IF NOT EXISTS idx_user_department_user_id ON user_department(user_id);
CREATE INDEX IF NOT EXISTS idx_user_department_dept_id ON user_department(department_id);

-- User department roles indexes
CREATE INDEX IF NOT EXISTS idx_user_dept_roles_user_id ON user_department_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_dept_roles_dept_id ON user_department_roles(department_id);
CREATE INDEX IF NOT EXISTS idx_user_dept_roles_org_id ON user_department_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_dept_roles_role_id ON user_department_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_dept_roles_lookup ON user_department_roles(user_id, organization_id, department_id);

-- User organization roles indexes
CREATE INDEX IF NOT EXISTS idx_user_org_roles_user_id ON user_organization_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_org_roles_org_id ON user_organization_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_org_roles_role_id ON user_organization_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_org_roles_lookup ON user_organization_roles(user_id, organization_id);

-- User project indexes
CREATE INDEX IF NOT EXISTS idx_user_project_user_id ON user_project(user_id);
CREATE INDEX IF NOT EXISTS idx_user_project_project_id ON user_project(project_id);
CREATE INDEX IF NOT EXISTS idx_user_project_role_id ON user_project(role_id);

-- Project department indexes
CREATE INDEX IF NOT EXISTS idx_project_department_project_id ON project_department(project_id);
CREATE INDEX IF NOT EXISTS idx_project_department_dept_id ON project_department(department_id);

-- Shared projects indexes
CREATE INDEX IF NOT EXISTS idx_shared_projects_project_id ON shared_projects(project_id);
CREATE INDEX IF NOT EXISTS idx_shared_projects_dept_id ON shared_projects(department_id);
CREATE INDEX IF NOT EXISTS idx_shared_projects_shared_by ON shared_projects(shared_by);
CREATE INDEX IF NOT EXISTS idx_shared_projects_shared_at ON shared_projects(shared_at DESC);

-- Invitations table indexes
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_org_id ON invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_invitations_dept_id ON invitations(department_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_invitations_org_status ON invitations(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON invitations(expires_at);

-- Statuses table indexes
CREATE INDEX IF NOT EXISTS idx_statuses_organization_id ON statuses(organization_id);
CREATE INDEX IF NOT EXISTS idx_statuses_type ON statuses(type);
CREATE INDEX IF NOT EXISTS idx_statuses_is_active ON statuses(is_active);
CREATE INDEX IF NOT EXISTS idx_statuses_sort_order ON statuses(sort_order);

-- Priorities table indexes
CREATE INDEX IF NOT EXISTS idx_priorities_organization_id ON priorities(organization_id);
CREATE INDEX IF NOT EXISTS idx_priorities_is_active ON priorities(is_active);
CREATE INDEX IF NOT EXISTS idx_priorities_sort_order ON priorities(sort_order);

-- Project statuses indexes
CREATE INDEX IF NOT EXISTS idx_project_statuses_organization_id ON project_statuses(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_statuses_created_by ON project_statuses(created_by);
CREATE INDEX IF NOT EXISTS idx_project_statuses_is_active ON project_statuses(is_active);
CREATE INDEX IF NOT EXISTS idx_project_statuses_sort_order ON project_statuses(sort_order);

-- Global roles indexes
CREATE INDEX IF NOT EXISTS idx_global_roles_name ON global_roles(name);

-- Resource requests indexes
CREATE INDEX IF NOT EXISTS idx_resource_requests_project_id ON resource_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_resource_requests_requested_by ON resource_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_resource_requests_requested_user_id ON resource_requests(requested_user_id);
CREATE INDEX IF NOT EXISTS idx_resource_requests_user_dept_id ON resource_requests(user_department_id);
CREATE INDEX IF NOT EXISTS idx_resource_requests_status ON resource_requests(status);
CREATE INDEX IF NOT EXISTS idx_resource_requests_reviewed_by ON resource_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_resource_requests_requested_role_id ON resource_requests(requested_role_id);
CREATE INDEX IF NOT EXISTS idx_resource_requests_created_at ON resource_requests(created_at DESC);

-- Activity logs indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_type ON activity_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_id ON activity_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_lookup ON activity_logs(entity_type, entity_id);

-- Attachments indexes
CREATE INDEX IF NOT EXISTS idx_attachments_entity_type ON attachments(entity_type);
CREATE INDEX IF NOT EXISTS idx_attachments_entity_id ON attachments(entity_id);
CREATE INDEX IF NOT EXISTS idx_attachments_uploaded_by ON attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_attachments_created_at ON attachments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attachments_entity_lookup ON attachments(entity_type, entity_id);

-- Tags indexes
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

-- Entity tags indexes
CREATE INDEX IF NOT EXISTS idx_entity_tags_entity_type ON entity_tags(entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_tags_entity_id ON entity_tags(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_tag_id ON entity_tags(tag_id);

-- Meetings indexes
CREATE INDEX IF NOT EXISTS idx_meetings_project_id ON meetings(project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by ON meetings(created_by);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled_at ON meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meetings_created_at ON meetings(created_at DESC);

-- Meeting participants indexes
CREATE INDEX IF NOT EXISTS idx_meeting_participants_meeting_id ON meeting_participants(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_participants_user_id ON meeting_participants(user_id);

-- Meeting MOMs indexes
CREATE INDEX IF NOT EXISTS idx_meeting_moms_meeting_id ON meeting_moms(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_moms_created_at ON meeting_moms(created_at DESC);

-- Analyze tables to update statistics
ANALYZE users;
ANALYZE notifications;
ANALYZE tickets;
ANALYZE ticket_comments;
ANALYZE projects;
ANALYZE project_docs;
ANALYZE organizations;
ANALYZE departments;
ANALYZE user_department;
ANALYZE user_department_roles;
ANALYZE user_organization_roles;
ANALYZE user_project;
ANALYZE project_department;
ANALYZE shared_projects;
ANALYZE invitations;
ANALYZE statuses;
ANALYZE priorities;
ANALYZE project_statuses;
ANALYZE global_roles;
ANALYZE resource_requests;
ANALYZE activity_logs;
ANALYZE attachments;
ANALYZE tags;
ANALYZE entity_tags;
ANALYZE meetings;
ANALYZE meeting_participants;
ANALYZE meeting_moms;

-- Verify indexes were created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN (
    'users', 'notifications', 'tickets', 'ticket_comments', 'projects', 'project_docs',
    'organizations', 'departments', 'user_department', 'user_department_roles',
    'user_organization_roles', 'user_project', 'project_department', 'shared_projects',
    'invitations', 'statuses', 'priorities', 'project_statuses', 'global_roles',
    'resource_requests', 'activity_logs', 'attachments', 'tags', 'entity_tags',
    'meetings', 'meeting_participants', 'meeting_moms'
)
ORDER BY tablename, indexname;
