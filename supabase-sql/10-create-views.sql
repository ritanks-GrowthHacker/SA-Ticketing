-- =============================================
-- STEP 10: CREATE USEFUL VIEWS
-- =============================================
-- Create views for easier querying

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