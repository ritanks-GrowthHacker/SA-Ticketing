-- =============================================
-- STEP 6: ADD PERFORMANCE INDEXES
-- =============================================
-- Create indexes for fast comment queries

-- Essential indexes for comment queries
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