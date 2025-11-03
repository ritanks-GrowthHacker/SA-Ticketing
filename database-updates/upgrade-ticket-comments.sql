-- =============================================
-- UPGRADE EXISTING TICKET_COMMENTS TO FULL NESTED COMMENTS
-- =============================================
-- This script enhances your existing ticket_comments table with advanced features
-- without losing any existing data.

-- 1. Add missing organization_id to users table (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' AND column_name = 'organization_id') THEN
        ALTER TABLE public.users ADD COLUMN organization_id uuid;
        
        -- Add foreign key constraint
        ALTER TABLE public.users 
        ADD CONSTRAINT users_organization_id_fkey 
        FOREIGN KEY (organization_id) REFERENCES public.organizations(id);
        
        -- Add index for performance
        CREATE INDEX IF NOT EXISTS idx_users_organization_id ON public.users(organization_id);
        
        RAISE NOTICE 'Added organization_id to users table';
    ELSE
        RAISE NOTICE 'organization_id already exists in users table';
    END IF;
END $$;

-- 2. Enhance ticket_comments table with advanced features
-- Add new columns to existing table

-- Add organization_id for security isolation
ALTER TABLE public.ticket_comments 
ADD COLUMN IF NOT EXISTS organization_id uuid;

-- Add content type support (text, markdown, html)
ALTER TABLE public.ticket_comments 
ADD COLUMN IF NOT EXISTS content_type varchar(20) DEFAULT 'text';

-- Rename 'comment' to 'content' for consistency (if you want, or keep both)
ALTER TABLE public.ticket_comments 
ADD COLUMN IF NOT EXISTS content text;

-- Copy existing comment data to content field
UPDATE public.ticket_comments 
SET content = comment 
WHERE content IS NULL AND comment IS NOT NULL;

-- Add edit tracking
ALTER TABLE public.ticket_comments 
ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false;

ALTER TABLE public.ticket_comments 
ADD COLUMN IF NOT EXISTS edited_at timestamp with time zone;

-- Add soft delete functionality
ALTER TABLE public.ticket_comments 
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;

ALTER TABLE public.ticket_comments 
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

-- Add reply count for performance
ALTER TABLE public.ticket_comments 
ADD COLUMN IF NOT EXISTS reply_count integer DEFAULT 0;

-- Add updated_at for consistency
ALTER TABLE public.ticket_comments 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT NOW();

-- Add mention and attachment support
ALTER TABLE public.ticket_comments 
ADD COLUMN IF NOT EXISTS mention_user_ids uuid[];

ALTER TABLE public.ticket_comments 
ADD COLUMN IF NOT EXISTS attachment_urls text[];

-- 3. Populate organization_id from ticket's project
UPDATE public.ticket_comments tc
SET organization_id = p.organization_id
FROM public.tickets t
JOIN public.projects p ON t.project_id = p.id
WHERE tc.ticket_id = t.id 
AND tc.organization_id IS NULL;

-- 4. Add foreign key constraint for organization_id
ALTER TABLE public.ticket_comments 
ADD CONSTRAINT IF NOT EXISTS ticket_comments_organization_id_fkey 
FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- 5. Add constraints for data integrity
-- Ensure parent comment belongs to same ticket
ALTER TABLE public.ticket_comments 
ADD CONSTRAINT IF NOT EXISTS check_parent_same_ticket CHECK (
    parent_comment_id IS NULL OR 
    EXISTS (
        SELECT 1 FROM ticket_comments pc 
        WHERE pc.id = parent_comment_id 
        AND pc.ticket_id = ticket_comments.ticket_id
    )
);

-- Prevent self-referencing
ALTER TABLE public.ticket_comments 
ADD CONSTRAINT IF NOT EXISTS check_no_self_reference 
CHECK (id != parent_comment_id);

-- Ensure content is not empty
ALTER TABLE public.ticket_comments 
ADD CONSTRAINT IF NOT EXISTS check_content_not_empty 
CHECK (
    (content IS NOT NULL AND length(trim(content)) > 0) OR
    (comment IS NOT NULL AND length(trim(comment)) > 0)
);

-- 6. Create comment edit history table
CREATE TABLE IF NOT EXISTS public.ticket_comment_edits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id uuid NOT NULL REFERENCES public.ticket_comments(id) ON DELETE CASCADE,
    previous_content text NOT NULL,
    edited_by uuid NOT NULL REFERENCES public.users(id),
    edited_at timestamp with time zone DEFAULT NOW(),
    edit_reason varchar(255)
);

-- 7. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON public.ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_parent_id ON public.ticket_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_user_id ON public.ticket_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_organization_id ON public.ticket_comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at ON public.ticket_comments(created_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_parent 
ON public.ticket_comments(ticket_id, parent_comment_id);

CREATE INDEX IF NOT EXISTS idx_ticket_comments_not_deleted 
ON public.ticket_comments(ticket_id, created_at) WHERE is_deleted = false;

-- Index for comment edit history
CREATE INDEX IF NOT EXISTS idx_comment_edits_comment_id 
ON public.ticket_comment_edits(comment_id, edited_at);

-- 8. Create functions and triggers

-- Function to update reply count when comments are added/removed
CREATE OR REPLACE FUNCTION update_comment_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.parent_comment_id IS NOT NULL THEN
        -- Increment reply count for parent comment
        UPDATE public.ticket_comments 
        SET reply_count = reply_count + 1 
        WHERE id = NEW.parent_comment_id;
    ELSIF TG_OP = 'DELETE' AND OLD.parent_comment_id IS NOT NULL THEN
        -- Decrement reply count for parent comment
        UPDATE public.ticket_comments 
        SET reply_count = GREATEST(reply_count - 1, 0)
        WHERE id = OLD.parent_comment_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.is_deleted != NEW.is_deleted AND NEW.parent_comment_id IS NOT NULL THEN
        -- Handle soft delete/restore
        IF NEW.is_deleted THEN
            UPDATE public.ticket_comments 
            SET reply_count = GREATEST(reply_count - 1, 0)
            WHERE id = NEW.parent_comment_id;
        ELSE
            UPDATE public.ticket_comments 
            SET reply_count = reply_count + 1
            WHERE id = NEW.parent_comment_id;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for reply count updates
DROP TRIGGER IF EXISTS trigger_update_comment_reply_count ON public.ticket_comments;
CREATE TRIGGER trigger_update_comment_reply_count
    AFTER INSERT OR UPDATE OR DELETE ON public.ticket_comments
    FOR EACH ROW EXECUTE FUNCTION update_comment_reply_count();

-- Function to track comment edits
CREATE OR REPLACE FUNCTION track_comment_edits()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if content changed (support both old 'comment' field and new 'content' field)
    IF (OLD.content IS DISTINCT FROM NEW.content) OR 
       (OLD.comment IS DISTINCT FROM NEW.comment AND NEW.content IS NULL) THEN
        
        -- Save the old content to edit history
        INSERT INTO public.ticket_comment_edits (comment_id, previous_content, edited_by)
        VALUES (OLD.id, COALESCE(OLD.content, OLD.comment), NEW.user_id);
        
        -- Update the comment's edit metadata
        NEW.is_edited = TRUE;
        NEW.edited_at = NOW();
        NEW.updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for tracking edits
DROP TRIGGER IF EXISTS trigger_track_comment_edits ON public.ticket_comments;
CREATE TRIGGER trigger_track_comment_edits
    BEFORE UPDATE ON public.ticket_comments
    FOR EACH ROW EXECUTE FUNCTION track_comment_edits();

-- Standard updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_ticket_comments_updated_at ON public.ticket_comments;
CREATE TRIGGER update_ticket_comments_updated_at 
    BEFORE UPDATE ON public.ticket_comments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 9. Enable Row Level Security (RLS)
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comment_edits ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ticket_comments
-- Users can view comments from their organization
DROP POLICY IF EXISTS "Users can view comments in their organization" ON public.ticket_comments;
CREATE POLICY "Users can view comments in their organization" ON public.ticket_comments
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.users WHERE id = auth.uid()
        )
    );

-- Users can insert comments in their organization's tickets
DROP POLICY IF EXISTS "Users can create comments in their organization" ON public.ticket_comments;
CREATE POLICY "Users can create comments in their organization" ON public.ticket_comments
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.users WHERE id = auth.uid()
        )
        AND user_id = auth.uid()
    );

-- Users can only update their own comments
DROP POLICY IF EXISTS "Users can update their own comments" ON public.ticket_comments;
CREATE POLICY "Users can update their own comments" ON public.ticket_comments
    FOR UPDATE USING (user_id = auth.uid());

-- 10. Create useful views

-- View for comments with user information (backward compatible)
CREATE OR REPLACE VIEW ticket_comments_with_users AS
SELECT 
    tc.id,
    tc.ticket_id,
    tc.parent_comment_id,
    COALESCE(tc.content, tc.comment) as content,  -- Support both old and new fields
    tc.content_type,
    tc.is_edited,
    tc.is_deleted,
    tc.reply_count,
    tc.created_at,
    tc.updated_at,
    tc.edited_at,
    tc.attachment_urls,
    tc.mention_user_ids,
    u.id as user_id,
    u.name as user_name,
    u.email as user_email,
    u.profile_picture_url as user_avatar
FROM public.ticket_comments tc
JOIN public.users u ON tc.user_id = u.id
WHERE tc.is_deleted = false;

-- 11. Calculate and update existing reply counts
WITH reply_counts AS (
    SELECT 
        parent_comment_id, 
        COUNT(*) as count
    FROM public.ticket_comments 
    WHERE parent_comment_id IS NOT NULL 
    AND is_deleted = false
    GROUP BY parent_comment_id
)
UPDATE public.ticket_comments tc
SET reply_count = rc.count
FROM reply_counts rc
WHERE tc.id = rc.parent_comment_id;

-- 12. Add helpful comments for documentation
COMMENT ON TABLE public.ticket_comments IS 'Enhanced threaded comments system for tickets with nested reply support';
COMMENT ON COLUMN public.ticket_comments.parent_comment_id IS 'NULL for top-level comments, references parent comment for replies';
COMMENT ON COLUMN public.ticket_comments.content IS 'Comment content (new field for enhanced features)';
COMMENT ON COLUMN public.ticket_comments.comment IS 'Legacy comment field (kept for backward compatibility)';
COMMENT ON COLUMN public.ticket_comments.reply_count IS 'Cached count of direct replies to this comment';
COMMENT ON COLUMN public.ticket_comments.mention_user_ids IS 'Array of user IDs mentioned in this comment (for notifications)';
COMMENT ON COLUMN public.ticket_comments.is_deleted IS 'Soft delete flag - deleted comments remain for reply context';
COMMENT ON TABLE public.ticket_comment_edits IS 'Edit history tracking for comment modifications';

-- 13. Output summary
DO $$ 
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'TICKET COMMENTS UPGRADE COMPLETED';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Enhanced Features Added:';
    RAISE NOTICE '✅ Organization isolation';
    RAISE NOTICE '✅ Content types (text/markdown/html)';
    RAISE NOTICE '✅ Edit tracking with history';
    RAISE NOTICE '✅ Soft delete functionality';
    RAISE NOTICE '✅ Reply count optimization';
    RAISE NOTICE '✅ Mentions and attachments support';
    RAISE NOTICE '✅ Performance indexes';
    RAISE NOTICE '✅ Row Level Security';
    RAISE NOTICE '✅ Automatic triggers';
    RAISE NOTICE '============================================';
    RAISE NOTICE 'Your existing comment data is preserved!';
    RAISE NOTICE 'Use the new React component and API endpoints for full features.';
    RAISE NOTICE '============================================';
END $$;