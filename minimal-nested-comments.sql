-- =============================================
-- MINIMAL NESTED COMMENTS SETUP
-- =============================================
-- Just the essential fields needed for nested comments to work

-- 1. Add organization_id to users table (if missing)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS organization_id uuid;

-- 2. Add essential fields to ticket_comments
ALTER TABLE public.ticket_comments 
ADD COLUMN IF NOT EXISTS organization_id uuid;

ALTER TABLE public.ticket_comments 
ADD COLUMN IF NOT EXISTS content text;

ALTER TABLE public.ticket_comments 
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false;

ALTER TABLE public.ticket_comments 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT NOW();

-- 3. Copy existing data
UPDATE public.ticket_comments 
SET content = comment 
WHERE content IS NULL AND comment IS NOT NULL;

-- 4. Populate organization_id from tickets
UPDATE public.ticket_comments tc
SET organization_id = p.organization_id
FROM public.tickets t
JOIN public.projects p ON t.project_id = p.id
WHERE tc.ticket_id = t.id 
AND tc.organization_id IS NULL;

-- 5. Basic foreign key constraint
ALTER TABLE public.ticket_comments 
ADD CONSTRAINT ticket_comments_organization_id_fkey 
FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

-- DONE! Your nested comments are now ready to use.