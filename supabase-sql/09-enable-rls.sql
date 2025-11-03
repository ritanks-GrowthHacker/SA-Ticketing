-- =============================================
-- STEP 9: ENABLE ROW LEVEL SECURITY
-- =============================================
-- Enable RLS and create policies for security

-- Enable RLS on tables
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comment_edits ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view comments from their organization
DROP POLICY IF EXISTS "Users can view comments in their organization" ON public.ticket_comments;
CREATE POLICY "Users can view comments in their organization" ON public.ticket_comments
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.users WHERE id = auth.uid()
        )
    );

-- Policy: Users can insert comments in their organization's tickets
DROP POLICY IF EXISTS "Users can create comments in their organization" ON public.ticket_comments;
CREATE POLICY "Users can create comments in their organization" ON public.ticket_comments
    FOR INSERT WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.users WHERE id = auth.uid()
        )
        AND user_id = auth.uid()
    );

-- Policy: Users can only update their own comments
DROP POLICY IF EXISTS "Users can update their own comments" ON public.ticket_comments;
CREATE POLICY "Users can update their own comments" ON public.ticket_comments
    FOR UPDATE USING (user_id = auth.uid());