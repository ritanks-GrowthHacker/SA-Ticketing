-- =============================================
-- STEP 8: CREATE TRIGGERS
-- =============================================
-- Create triggers for automatic functionality

-- Trigger for reply count updates
DROP TRIGGER IF EXISTS trigger_update_comment_reply_count ON public.ticket_comments;
CREATE TRIGGER trigger_update_comment_reply_count
    AFTER INSERT OR UPDATE OR DELETE ON public.ticket_comments
    FOR EACH ROW EXECUTE FUNCTION update_comment_reply_count();

-- Trigger for tracking edits
DROP TRIGGER IF EXISTS trigger_track_comment_edits ON public.ticket_comments;
CREATE TRIGGER trigger_track_comment_edits
    BEFORE UPDATE ON public.ticket_comments
    FOR EACH ROW EXECUTE FUNCTION track_comment_edits();

-- Standard updated_at trigger
DROP TRIGGER IF EXISTS update_ticket_comments_updated_at ON public.ticket_comments;
CREATE TRIGGER update_ticket_comments_updated_at 
    BEFORE UPDATE ON public.ticket_comments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();