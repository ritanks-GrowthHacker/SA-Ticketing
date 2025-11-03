-- =============================================
-- STEP 11: CALCULATE EXISTING REPLY COUNTS
-- =============================================
-- Update reply counts for existing comments

-- Calculate and update existing reply counts
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