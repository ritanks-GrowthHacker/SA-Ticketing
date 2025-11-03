-- =============================================
-- STEP 7: CREATE FUNCTIONS AND TRIGGERS
-- =============================================
-- Create functions for reply count and edit tracking

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

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';