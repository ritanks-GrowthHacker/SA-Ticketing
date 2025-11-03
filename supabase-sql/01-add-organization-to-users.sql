-- =============================================
-- STEP 1: ADD ORGANIZATION_ID TO USERS TABLE
-- =============================================
-- Run this first if organization_id doesn't exist in users table

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS organization_id uuid;

-- Add foreign key constraint
ALTER TABLE public.users 
ADD CONSTRAINT users_organization_id_fkey 
FOREIGN KEY (organization_id) REFERENCES public.organizations(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON public.users(organization_id);