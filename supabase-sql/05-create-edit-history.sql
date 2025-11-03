-- =============================================
-- STEP 5: CREATE COMMENT EDIT HISTORY TABLE
-- =============================================
-- Create table to track comment edit history

CREATE TABLE IF NOT EXISTS public.ticket_comment_edits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id uuid NOT NULL REFERENCES public.ticket_comments(id) ON DELETE CASCADE,
    previous_content text NOT NULL,
    edited_by uuid NOT NULL REFERENCES public.users(id),
    edited_at timestamp with time zone DEFAULT NOW(),
    edit_reason varchar(255)
);