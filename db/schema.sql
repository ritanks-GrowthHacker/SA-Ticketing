-- SA-Ticketing System Database Schema
-- Complete database structure for the ticketing system
-- Date: July 31, 2025

-- Enable RLS (Row Level Security) and UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ORGANIZATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    domain TEXT UNIQUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    username CHARACTER VARYING UNIQUE,
    password_hash TEXT,
    org_email CHARACTER VARYING UNIQUE,
    is_active BOOLEAN DEFAULT false,
    onboarded_at TIMESTAMP WITH TIME ZONE,
    mobile_number CHARACTER VARYING CHECK (mobile_number IS NULL OR mobile_number::text ~ '^[\+]?[1-9][\d\-\(\)\s]{7,18}$'::text),
    otp CHARACTER VARYING,
    otp_expires_at TIMESTAMP WITH TIME ZONE,
    otp_verified BOOLEAN DEFAULT false,
    mobile_verified BOOLEAN DEFAULT false,
    associated_departments UUID[]
);

-- Enable RLS for organizations
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- =============================================
-- USERS TABLE  
-- =============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    profile_image TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    otp CHARACTER VARYING,
    otp_expires_at TIMESTAMP WITHOUT TIME ZONE,
    otp_verified BOOLEAN DEFAULT false,
    profile_picture_url TEXT,
    about TEXT,
    phone CHARACTER VARYING,
    location CHARACTER VARYING,
    job_title CHARACTER VARYING,
    department CHARACTER VARYING,
    date_of_birth DATE,
    profile_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    email_notifications_enabled BOOLEAN DEFAULT true,
    dark_mode_enabled BOOLEAN DEFAULT false
);

-- Enable RLS for users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- =============================================
-- ROLES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, organization_id)
);

-- Enable RLS for roles
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- USER_ROLES TABLE (Many-to-Many)
-- =============================================
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role_id)
);

-- Enable RLS for user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROJECT_STATUSES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS project_statuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color_code VARCHAR(7) NOT NULL, -- Hex color code
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, organization_id)
);

-- Enable RLS for project_statuses
ALTER TABLE project_statuses ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROJECTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status_id UUID REFERENCES project_statuses(id),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for projects
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- =============================================
-- USER_PROJECT TABLE (Many-to-Many with Roles)
-- =============================================
CREATE TABLE IF NOT EXISTS user_project (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    UNIQUE(user_id, project_id)
);

-- Enable RLS for user_project
ALTER TABLE user_project ENABLE ROW LEVEL SECURITY;

-- =============================================
-- STATUSES TABLE (For Tickets)
-- =============================================
CREATE TABLE IF NOT EXISTS statuses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color_code VARCHAR(7) NOT NULL, -- Hex color code
    type VARCHAR(50) DEFAULT 'ticket', -- ticket, project, etc.
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, organization_id, type)
);

-- Enable RLS for statuses
ALTER TABLE statuses ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PRIORITIES TABLE (For Tickets)
-- =============================================
CREATE TABLE IF NOT EXISTS priorities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color_code VARCHAR(7) NOT NULL,
    level INTEGER NOT NULL DEFAULT 1, -- 1=Low, 2=Medium, 3=High, 4=Critical
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(name, organization_id)
);

-- Enable RLS for priorities
ALTER TABLE priorities ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TICKETS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    status_id UUID REFERENCES statuses(id),
    priority_id UUID REFERENCES priorities(id),
    assigned_to UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    due_date TIMESTAMP WITH TIME ZONE,
    estimated_hours INTEGER,
    actual_hours INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for tickets
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROJECT_DOCUMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS project_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    file_url TEXT,
    file_type VARCHAR(100),
    file_size INTEGER,
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for project_documents
ALTER TABLE project_documents ENABLE ROW LEVEL SECURITY;

-- =============================================
-- OTP_VERIFICATIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS otp_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    purpose VARCHAR(50) NOT NULL, -- 'registration', 'login', 'password_reset'
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_profile_picture ON users(profile_picture_url) WHERE profile_picture_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_job_title ON users(job_title) WHERE job_title IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department) WHERE department IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_location ON users(location) WHERE location IS NOT NULL;

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_status_id ON projects(status_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

-- Tickets indexes
CREATE INDEX IF NOT EXISTS idx_tickets_project_id ON tickets(project_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status_id ON tickets(status_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_organization_id ON tickets(organization_id);

-- User_project indexes
CREATE INDEX IF NOT EXISTS idx_user_project_user_id ON user_project(user_id);
CREATE INDEX IF NOT EXISTS idx_user_project_project_id ON user_project(project_id);

-- Project_documents indexes
CREATE INDEX IF NOT EXISTS idx_project_documents_project_id ON project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_organization_id ON project_documents(organization_id);

-- OTP verifications indexes
CREATE INDEX IF NOT EXISTS idx_otp_verifications_email ON otp_verifications(email);
CREATE INDEX IF NOT EXISTS idx_otp_verifications_expires_at ON otp_verifications(expires_at);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================

-- Organizations policies
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
CREATE POLICY "Users can view their organization" ON organizations
    FOR ALL USING (id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Users policies
DROP POLICY IF EXISTS "Users can view users in their organization" ON users;
CREATE POLICY "Users can view users in their organization" ON users
    FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Projects policies
DROP POLICY IF EXISTS "Users can view projects in their organization" ON projects;
CREATE POLICY "Users can view projects in their organization" ON projects
    FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Tickets policies
DROP POLICY IF EXISTS "Users can view tickets in their organization" ON tickets;
CREATE POLICY "Users can view tickets in their organization" ON tickets
    FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Project statuses policies
DROP POLICY IF EXISTS "Users can view project statuses in their organization" ON project_statuses;
CREATE POLICY "Users can view project statuses in their organization" ON project_statuses
    FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- Statuses policies
DROP POLICY IF EXISTS "Users can view statuses in their organization" ON statuses;
CREATE POLICY "Users can view statuses in their organization" ON statuses
    FOR ALL USING (organization_id IN (SELECT organization_id FROM users WHERE id = auth.uid()));

-- =============================================
-- DEFAULT DATA INSERTIONS
-- =============================================

-- Default roles for organizations (will be inserted via API when org is created)
-- Admin, Manager, Member, Viewer

-- Default project statuses (will be inserted via API when needed)
-- Planning, Active, On Hold, Review, Completed, Cancelled

-- Default ticket statuses (will be inserted via API when needed)  
-- Open, In Progress, Under Review, Closed, Reopened

-- Default priorities (will be inserted via API when needed)
-- Low, Medium, High, Critical

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to update profile_updated_at timestamp for profile changes
CREATE OR REPLACE FUNCTION update_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.profile_updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Profile-specific update trigger
DROP TRIGGER IF EXISTS trigger_update_profile_updated_at ON users;
CREATE TRIGGER trigger_update_profile_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    WHEN (OLD.name IS DISTINCT FROM NEW.name OR 
          OLD.email IS DISTINCT FROM NEW.email OR
          OLD.profile_picture_url IS DISTINCT FROM NEW.profile_picture_url OR
          OLD.about IS DISTINCT FROM NEW.about OR
          OLD.phone IS DISTINCT FROM NEW.phone OR
          OLD.location IS DISTINCT FROM NEW.location OR
          OLD.job_title IS DISTINCT FROM NEW.job_title OR
          OLD.department IS DISTINCT FROM NEW.department OR
          OLD.date_of_birth IS DISTINCT FROM NEW.date_of_birth)
    EXECUTE FUNCTION update_profile_updated_at();

DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_documents_updated_at ON project_documents;
CREATE TRIGGER update_project_documents_updated_at BEFORE UPDATE ON project_documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_project_statuses_updated_at ON project_statuses;
CREATE TRIGGER update_project_statuses_updated_at BEFORE UPDATE ON project_statuses 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_statuses_updated_at ON statuses;
CREATE TRIGGER update_statuses_updated_at BEFORE UPDATE ON statuses 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE organizations IS 'Organizations/companies using the ticketing system';
COMMENT ON TABLE users IS 'System users with organization association';
COMMENT ON TABLE roles IS 'User roles within organizations (Admin, Manager, Member, Viewer)';
COMMENT ON TABLE user_roles IS 'Many-to-many relationship between users and roles';
COMMENT ON TABLE project_statuses IS 'Status options for projects (Planning, Active, Completed, etc.)';
COMMENT ON TABLE projects IS 'Projects within organizations';
COMMENT ON TABLE user_project IS 'Project team membership with roles';
COMMENT ON TABLE statuses IS 'Status options for tickets (Open, In Progress, Closed, etc.)';
COMMENT ON TABLE priorities IS 'Priority levels for tickets (Low, Medium, High, Critical)';
COMMENT ON TABLE tickets IS 'Support/task tickets within projects';
COMMENT ON TABLE project_documents IS 'Documents and files associated with projects';
COMMENT ON TABLE otp_verifications IS 'OTP codes for authentication and verification';

-- =============================================
-- TICKET COMMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL,
    user_id UUID NOT NULL,
    parent_comment_id UUID,
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    organization_id UUID,
    content TEXT,
    is_deleted BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT ticket_comments_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    CONSTRAINT ticket_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT ticket_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES ticket_comments(id),
    CONSTRAINT ticket_comments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Enable RLS for ticket_comments
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_parent_id ON ticket_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_organization_id ON ticket_comments(organization_id);

COMMENT ON TABLE ticket_comments IS 'Comments on tickets with nested reply support';

-- =============================================
-- RESOURCE REQUESTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS resource_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    requested_by UUID NOT NULL,
    requested_user_id UUID NOT NULL,
    user_department_id UUID NOT NULL,
    status CHARACTER VARYING NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    reviewed_by UUID,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_notes TEXT,
    CONSTRAINT resource_requests_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT resource_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES users(id),
    CONSTRAINT resource_requests_requested_user_id_fkey FOREIGN KEY (requested_user_id) REFERENCES users(id),
    CONSTRAINT resource_requests_user_department_id_fkey FOREIGN KEY (user_department_id) REFERENCES departments(id),
    CONSTRAINT resource_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_resource_requests_project_id ON resource_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_resource_requests_requested_by ON resource_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_resource_requests_requested_user_id ON resource_requests(requested_user_id);
CREATE INDEX IF NOT EXISTS idx_resource_requests_status ON resource_requests(status);

COMMENT ON TABLE resource_requests IS 'Cross-department resource allocation requests for projects';

-- =============================================
-- END OF SCHEMA
-- =============================================