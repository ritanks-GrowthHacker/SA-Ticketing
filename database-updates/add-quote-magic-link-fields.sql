-- Add missing fields to quotes table for magic link and status tracking

-- Add viewed_at timestamp column
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS viewed_at TIMESTAMP WITH TIME ZONE;

-- Update status enum to include 'viewed' and 'expired' if not already present
-- First check if status column exists and its type
DO $$ 
BEGIN
  -- Drop the old status check constraint if it exists
  ALTER TABLE quotes DROP CONSTRAINT IF EXISTS quotes_status_check;
  
  -- Add new constraint with all status values
  ALTER TABLE quotes 
  ADD CONSTRAINT quotes_status_check 
  CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'));
  
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add accepted_at timestamp column
ALTER TABLE quotes 
ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;

-- Add index on magic_link_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_quotes_magic_link_token ON quotes(magic_link_token);

-- Add index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_quotes_status ON quotes(status);

-- Add comment for documentation
COMMENT ON COLUMN quotes.magic_link_token IS 'UUID token for public quote preview access via magic link';
COMMENT ON COLUMN quotes.magic_link_expires_at IS 'Expiry timestamp for magic link (recommended 7-15 days from creation)';
COMMENT ON COLUMN quotes.viewed_at IS 'Timestamp when client first viewed the quote via magic link';
COMMENT ON COLUMN quotes.accepted_at IS 'Timestamp when client accepted the quote';
