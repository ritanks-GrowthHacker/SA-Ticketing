-- =============================================
-- TICKET COMMENTS TABLE - Nested Comments Support
-- =============================================
-- This creates a ticket comments system that supports:
-- 1. Nested/threaded comments (replies to comments)
-- 2. Rich text content
-- 3. Edit history tracking
-- 4. Soft delete functionality
-- 5. Organization-level isolation

CREATE TABLE IF NOT EXISTS ticket_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES ticket_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Content fields
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text', -- 'text', 'markdown', 'html'
    
    -- Metadata
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    reply_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    edited_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    -- Additional fields for rich functionality
    mention_user_ids UUID[], -- Array of user IDs mentioned in comment
    attachment_urls TEXT[], -- Array of attachment URLs if any
    
    -- Ensure parent comment belongs to same ticket
    CONSTRAINT check_parent_same_ticket CHECK (
        parent_comment_id IS NULL OR 
        EXISTS (
            SELECT 1 FROM ticket_comments pc 
            WHERE pc.id = parent_comment_id 
            AND pc.ticket_id = ticket_comments.ticket_id
        )
    ),
    
    -- Prevent self-referencing
    CONSTRAINT check_no_self_reference CHECK (id != parent_comment_id)
);

-- =============================================
-- COMMENT EDIT HISTORY TABLE
-- =============================================
-- Track edit history for comments
CREATE TABLE IF NOT EXISTS ticket_comment_edits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES ticket_comments(id) ON DELETE CASCADE,
    previous_content TEXT NOT NULL,
    edited_by UUID NOT NULL REFERENCES users(id),
    edited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    edit_reason VARCHAR(255) -- Optional reason for edit
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
-- Essential indexes for comment queries
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_parent_id ON ticket_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_user_id ON ticket_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_organization_id ON ticket_comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON ticket_comments(created_at);

-- Composite index for fetching ticket comments with replies
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_parent ON ticket_comments(ticket_id, parent_comment_id);

-- Index for soft-deleted comments (to exclude them efficiently)
CREATE INDEX IF NOT EXISTS idx_ticket_comments_not_deleted ON ticket_comments(ticket_id, created_at) WHERE is_deleted = FALSE;

-- Index for comment edit history
CREATE INDEX IF NOT EXISTS idx_comment_edits_comment_id ON ticket_comment_edits(comment_id, edited_at);

-- =============================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================
-- Enable RLS
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comment_edits ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see comments from their organization
DROP POLICY IF EXISTS "Users can view comments in their organization" ON ticket_comments;
CREATE POLICY "Users can view comments in their organization" ON ticket_comments
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
    );

-- Policy: Users can insert comments in their organization's tickets
DROP POLICY IF EXISTS "Users can create comments in their organization" ON ticket_comments;
CREATE POLICY "Users can create comments in their organization" ON ticket_comments
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM users WHERE id = auth.uid()
        )
        AND user_id = auth.uid()
    );

-- Policy: Users can only update their own comments
DROP POLICY IF EXISTS "Users can update their own comments" ON ticket_comments;
CREATE POLICY "Users can update their own comments" ON ticket_comments
    FOR UPDATE USING (user_id = auth.uid());

-- Policy: Users can soft-delete their own comments
DROP POLICY IF EXISTS "Users can delete their own comments" ON ticket_comments;
CREATE POLICY "Users can delete their own comments" ON ticket_comments
    FOR UPDATE USING (user_id = auth.uid());

-- =============================================
-- FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update reply count when comments are added/removed
CREATE OR REPLACE FUNCTION update_comment_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.parent_comment_id IS NOT NULL THEN
        -- Increment reply count for parent comment
        UPDATE ticket_comments 
        SET reply_count = reply_count + 1 
        WHERE id = NEW.parent_comment_id;
    ELSIF TG_OP = 'DELETE' AND OLD.parent_comment_id IS NOT NULL THEN
        -- Decrement reply count for parent comment
        UPDATE ticket_comments 
        SET reply_count = GREATEST(reply_count - 1, 0)
        WHERE id = OLD.parent_comment_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.is_deleted != NEW.is_deleted AND NEW.parent_comment_id IS NOT NULL THEN
        -- Handle soft delete/restore
        IF NEW.is_deleted THEN
            UPDATE ticket_comments 
            SET reply_count = GREATEST(reply_count - 1, 0)
            WHERE id = NEW.parent_comment_id;
        ELSE
            UPDATE ticket_comments 
            SET reply_count = reply_count + 1
            WHERE id = NEW.parent_comment_id;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for reply count updates
DROP TRIGGER IF EXISTS trigger_update_comment_reply_count ON ticket_comments;
CREATE TRIGGER trigger_update_comment_reply_count
    AFTER INSERT OR UPDATE OR DELETE ON ticket_comments
    FOR EACH ROW EXECUTE FUNCTION update_comment_reply_count();

-- Function to track comment edits
CREATE OR REPLACE FUNCTION track_comment_edits()
RETURNS TRIGGER AS $$
BEGIN
    -- Only track if content actually changed
    IF OLD.content IS DISTINCT FROM NEW.content THEN
        -- Save the old content to edit history
        INSERT INTO ticket_comment_edits (comment_id, previous_content, edited_by)
        VALUES (OLD.id, OLD.content, NEW.user_id);
        
        -- Update the comment's edit metadata
        NEW.is_edited = TRUE;
        NEW.edited_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for tracking edits
DROP TRIGGER IF EXISTS trigger_track_comment_edits ON ticket_comments;
CREATE TRIGGER trigger_track_comment_edits
    BEFORE UPDATE ON ticket_comments
    FOR EACH ROW EXECUTE FUNCTION track_comment_edits();

-- Standard updated_at trigger
DROP TRIGGER IF EXISTS update_ticket_comments_updated_at ON ticket_comments;
CREATE TRIGGER update_ticket_comments_updated_at 
    BEFORE UPDATE ON ticket_comments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- USEFUL VIEWS FOR COMMENT QUERIES
-- =============================================

-- View for comments with user information
CREATE OR REPLACE VIEW ticket_comments_with_users AS
SELECT 
    tc.id,
    tc.ticket_id,
    tc.parent_comment_id,
    tc.content,
    tc.content_type,
    tc.is_edited,
    tc.is_deleted,
    tc.reply_count,
    tc.created_at,
    tc.updated_at,
    tc.edited_at,
    tc.attachment_urls,
    u.id as user_id,
    u.name as user_name,
    u.email as user_email,
    u.profile_picture_url as user_avatar
FROM ticket_comments tc
JOIN users u ON tc.user_id = u.id
WHERE tc.is_deleted = FALSE;

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================
COMMENT ON TABLE ticket_comments IS 'Threaded comments system for tickets with nested reply support';
COMMENT ON COLUMN ticket_comments.parent_comment_id IS 'NULL for top-level comments, references parent comment for replies';
COMMENT ON COLUMN ticket_comments.reply_count IS 'Cached count of direct replies to this comment';
COMMENT ON COLUMN ticket_comments.mention_user_ids IS 'Array of user IDs mentioned in this comment (for notifications)';
COMMENT ON COLUMN ticket_comments.is_deleted IS 'Soft delete flag - deleted comments remain for reply context';
COMMENT ON TABLE ticket_comment_edits IS 'Edit history tracking for comment modifications';

-- =============================================
-- SAMPLE QUERIES FOR NESTED COMMENTS
-- =============================================
/*
-- Get all comments for a ticket with nested structure
WITH RECURSIVE comment_tree AS (
    -- Root comments (no parent)
    SELECT 
        id, ticket_id, parent_comment_id, content, user_id, created_at,
        0 as depth,
        ARRAY[created_at, id::text] as path
    FROM ticket_comments 
    WHERE ticket_id = 'your-ticket-id' 
    AND parent_comment_id IS NULL 
    AND is_deleted = FALSE
    
    UNION ALL
    
    -- Child comments
    SELECT 
        tc.id, tc.ticket_id, tc.parent_comment_id, tc.content, tc.user_id, tc.created_at,
        ct.depth + 1,
        ct.path || ARRAY[tc.created_at, tc.id::text]
    FROM ticket_comments tc
    JOIN comment_tree ct ON tc.parent_comment_id = ct.id
    WHERE tc.is_deleted = FALSE
)
SELECT * FROM comment_tree 
ORDER BY path;

-- Get comment count for a ticket
SELECT COUNT(*) FROM ticket_comments 
WHERE ticket_id = 'your-ticket-id' AND is_deleted = FALSE;

-- Get recent comments across all tickets in a project
SELECT tc.*, u.name as user_name
FROM ticket_comments tc
JOIN users u ON tc.user_id = u.id
JOIN tickets t ON tc.ticket_id = t.id
WHERE t.project_id = 'your-project-id'
AND tc.is_deleted = FALSE
ORDER BY tc.created_at DESC
LIMIT 10;
*/