-- Add new columns to organizations table for enhanced onboarding system

-- Add username column (unique identifier for login)
ALTER TABLE organizations 
ADD COLUMN username VARCHAR(255) UNIQUE;

-- Add password hash column for authentication
ALTER TABLE organizations 
ADD COLUMN password_hash VARCHAR(255);

-- Add organization email column (unique)
ALTER TABLE organizations 
ADD COLUMN org_email VARCHAR(255) UNIQUE;

-- Add mobile number column
ALTER TABLE organizations 
ADD COLUMN mobile_number VARCHAR(20);

-- Add OTP columns for email verification
ALTER TABLE organizations 
ADD COLUMN otp VARCHAR(6);

ALTER TABLE organizations 
ADD COLUMN otp_expiry TIMESTAMP;

ALTER TABLE organizations 
ADD COLUMN otp_verified BOOLEAN DEFAULT FALSE;

-- Add associated departments as UUID array
ALTER TABLE organizations 
ADD COLUMN associated_departments UUID[];

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_username ON organizations(username);
CREATE INDEX IF NOT EXISTS idx_organizations_org_email ON organizations(org_email);
CREATE INDEX IF NOT EXISTS idx_organizations_otp_verified ON organizations(otp_verified);

-- Update existing organizations to have otp_verified as false initially
UPDATE organizations 
SET otp_verified = FALSE 
WHERE otp_verified IS NULL;