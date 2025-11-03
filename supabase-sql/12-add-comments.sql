-- =============================================
-- STEP 12: ADD DOCUMENTATION COMMENTS
-- =============================================
-- Add helpful comments for documentation

COMMENT ON TABLE public.ticket_comments IS 'Enhanced threaded comments system for tickets with nested reply support';
COMMENT ON COLUMN public.ticket_comments.parent_comment_id IS 'NULL for top-level comments, references parent comment for replies';
COMMENT ON COLUMN public.ticket_comments.content IS 'Comment content (new field for enhanced features)';
COMMENT ON COLUMN public.ticket_comments.comment IS 'Legacy comment field (kept for backward compatibility)';
COMMENT ON COLUMN public.ticket_comments.reply_count IS 'Cached count of direct replies to this comment';
COMMENT ON COLUMN public.ticket_comments.mention_user_ids IS 'Array of user IDs mentioned in this comment (for notifications)';
COMMENT ON COLUMN public.ticket_comments.is_deleted IS 'Soft delete flag - deleted comments remain for reply context';
COMMENT ON TABLE public.ticket_comment_edits IS 'Edit history tracking for comment modifications';