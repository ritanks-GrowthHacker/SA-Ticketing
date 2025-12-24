-- =====================================================
-- Migration: Add First Time Login Tracking
-- Purpose: Track when a user logs in for the first time after completing onboarding
-- Date: December 24, 2025
-- =====================================================

-- Step 1: Add the column to users table
ALTER TABLE public.users 
ADD COLUMN has_seen_dashboard_welcome BOOLEAN DEFAULT FALSE;

-- Step 2: Add a comment to explain the column
COMMENT ON COLUMN public.users.has_seen_dashboard_welcome 
IS 'Tracks if user has seen the welcome assistant modal on their first dashboard load after completing onboarding. Set to FALSE initially, set to TRUE after viewing welcome modal.';

-- Step 3: Create an index for faster queries (optional but recommended for performance)
CREATE INDEX idx_users_dashboard_welcome ON public.users(has_seen_dashboard_welcome) 
WHERE has_seen_dashboard_welcome = FALSE;

-- =====================================================
-- To run this migration in PGAdmin:
-- 1. Copy all the SQL above
-- 2. Open PGAdmin and connect to your database
-- 3. Open Query Tool (Tools > Query Tool)
-- 4. Paste the SQL
-- 5. Execute (F5 or click Execute button)
-- =====================================================

-- Verification Query (run this after migration to verify)
-- SELECT column_name, data_type, column_default, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'users' 
-- AND column_name = 'has_seen_dashboard_welcome';
