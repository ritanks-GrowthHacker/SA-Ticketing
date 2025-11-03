-- =============================================
-- STEP 4: ADD CONSTRAINTS
-- =============================================
-- Add foreign key and check constraints

-- Add foreign key constraint for organization_id
ALTER TABLE public.ticket_comments 
ADD CONSTRAINT ticket_comments_organization_id_fkey 
FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Ensure parent comment belongs to same ticket
ALTER TABLE public.ticket_comments 
ADD CONSTRAINT check_parent_same_ticket CHECK (
    parent_comment_id IS NULL OR 
    EXISTS (
        SELECT 1 FROM ticket_comments pc 
        WHERE pc.id = parent_comment_id 
        AND pc.ticket_id = ticket_comments.ticket_id
    )
);

-- Prevent self-referencing
ALTER TABLE public.ticket_comments 
ADD CONSTRAINT check_no_self_reference 
CHECK (id != parent_comment_id);

-- Ensure content is not empty
ALTER TABLE public.ticket_comments 
ADD CONSTRAINT check_content_not_empty 
CHECK (
    (content IS NOT NULL AND length(trim(content)) > 0) OR
    (comment IS NOT NULL AND length(trim(comment)) > 0)
);