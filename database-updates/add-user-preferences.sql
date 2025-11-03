-- Add email notification flag to users table
ALTER TABLE users 
ADD COLUMN email_notifications_enabled BOOLEAN DEFAULT TRUE;

-- Add dark mode preference to users table  
ALTER TABLE users 
ADD COLUMN dark_mode_enabled BOOLEAN DEFAULT FALSE;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email_notifications ON users(email_notifications_enabled);
CREATE INDEX IF NOT EXISTS idx_users_dark_mode ON users(dark_mode_enabled);

-- Update existing users to have email notifications enabled by default
UPDATE users 
SET email_notifications_enabled = TRUE 
WHERE email_notifications_enabled IS NULL;

-- Update existing users to have dark mode disabled by default  
UPDATE users 
SET dark_mode_enabled = FALSE 
WHERE dark_mode_enabled IS NULL;