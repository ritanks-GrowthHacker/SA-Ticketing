-- ========================================
-- ADD NEW FIELDS TO ORGANIZATIONS TABLE
-- Run this in your Main Supabase database
-- ========================================

-- Add logo URL field
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add complete address field
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS address TEXT;

-- Add tax percentage field
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS tax_percentage NUMERIC(5,2) DEFAULT 0.00 CHECK (tax_percentage >= 0 AND tax_percentage <= 100);

-- Add GST number field
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS gst_number VARCHAR(15);

-- Add CIN (Corporate Identification Number) field
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS cin VARCHAR(21);

-- Add indexes for searchability
CREATE INDEX IF NOT EXISTS idx_organizations_gst_number ON organizations(gst_number);
CREATE INDEX IF NOT EXISTS idx_organizations_cin ON organizations(cin);

-- Verify the columns were added
SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'organizations'
AND column_name IN ('logo_url', 'address', 'tax_percentage', 'gst_number', 'cin')
ORDER BY ordinal_position;
