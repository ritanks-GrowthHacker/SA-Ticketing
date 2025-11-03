-- Add password reset token fields to users table
-- This provides a fallback for OTP storage when otp_verifications table is not available

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS reset_token VARCHAR(10),
ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL;

-- Add comment
COMMENT ON COLUMN users.reset_token IS 'Temporary storage for password reset OTP tokens';
COMMENT ON COLUMN users.reset_token_expires IS 'Expiration timestamp for reset tokens';