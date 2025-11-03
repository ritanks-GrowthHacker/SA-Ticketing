-- =============================================
-- STEP 2: ENHANCE TICKET_COMMENTS TABLE
-- =============================================
-- Add new columns to existing ticket_comments table

-- Add organization_id for security isolation
ALTER TABLE public.ticket_comments 
ADD COLUMN IF NOT EXISTS organization_id uuid;

-- Add content type support (text, markdown, html)
ALTER TABLE public.ticket_comments 
ADD COLUMN IF NOT EXISTS content_type varchar(20) DEFAULT 'text';

-- Add new content field (keep old 'comment' field for compatibility)
ALTER TABLE public.ticket_comments 
ADD COLUMN IF NOT EXISTS content text;

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