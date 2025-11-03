-- =============================================
-- MINIMAL NESTED COMMENTS SETUP - FINAL FIXED VERSION
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

-- 3. Copy existing data from comment to content field
UPDATE public.ticket_comments 
SET content = comment 
WHERE content IS NULL AND comment IS NOT NULL;

-- 4. Populate organization_id from tickets (if tickets and projects exist)
DO $$
BEGIN
    -- Check if we can populate organization_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' AND column_name = 'organization_id'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tickets' AND column_name = 'project_id'
    ) THEN
        UPDATE public.ticket_comments tc
        SET organization_id = p.organization_id
        FROM public.tickets t
        JOIN public.projects p ON t.project_id = p.id
        WHERE tc.ticket_id = t.id 
        AND tc.organization_id IS NULL;
        
        RAISE NOTICE 'Successfully populated organization_id for existing comments';
    ELSE
        RAISE NOTICE 'Skipped organization_id population - missing required tables/columns';
    END IF;
END $$;

-- 5. Add foreign key constraint (with proper error handling)
DO $$
BEGIN
    -- Check if organizations table exists and constraint doesn't already exist
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'organizations'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ticket_comments_organization_id_fkey'
        AND table_name = 'ticket_comments'
    ) THEN
        -- Add foreign key constraint
        ALTER TABLE public.ticket_comments 
        ADD CONSTRAINT ticket_comments_organization_id_fkey 
        FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Added foreign key constraint for organization_id';
    ELSE
        RAISE NOTICE 'Skipped foreign key constraint - organizations table missing or constraint exists';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not add foreign key constraint: %', SQLERRM;
END $$;

-- 6. Create indexes for better performance (with error handling)
DO $$
BEGIN
    CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_id ON public.ticket_comments(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_comments_parent_id ON public.ticket_comments(parent_comment_id);
    CREATE INDEX IF NOT EXISTS idx_ticket_comments_organization_id ON public.ticket_comments(organization_id);
    RAISE NOTICE 'Created performance indexes';
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Some indexes may already exist: %', SQLERRM;
END $$;

-- DONE! Your nested comments are now ready to use.