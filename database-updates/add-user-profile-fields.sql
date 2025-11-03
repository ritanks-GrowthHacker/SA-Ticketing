-- Add Profile Picture and About Section to Users Table
-- Migration SQL for enhanced user profiles
-- Date: November 2, 2025

-- Add new columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
ADD COLUMN IF NOT EXISTS about TEXT,
ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS location VARCHAR(255),
ADD COLUMN IF NOT EXISTS job_title VARCHAR(255),
ADD COLUMN IF NOT EXISTS department VARCHAR(255),
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS profile_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create trigger to update profile_updated_at timestamp
CREATE OR REPLACE FUNCTION update_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.profile_updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists and create new one
DROP TRIGGER IF EXISTS trigger_update_profile_updated_at ON users;
CREATE TRIGGER trigger_update_profile_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    WHEN (OLD.name IS DISTINCT FROM NEW.name OR 
          OLD.email IS DISTINCT FROM NEW.email OR
          OLD.profile_picture_url IS DISTINCT FROM NEW.profile_picture_url OR
          OLD.about IS DISTINCT FROM NEW.about OR
          OLD.phone IS DISTINCT FROM NEW.phone OR
          OLD.location IS DISTINCT FROM NEW.location OR
          OLD.job_title IS DISTINCT FROM NEW.job_title OR
          OLD.department IS DISTINCT FROM NEW.department OR
          OLD.date_of_birth IS DISTINCT FROM NEW.date_of_birth)
    EXECUTE FUNCTION update_profile_updated_at();

-- Create index for profile picture lookups
CREATE INDEX IF NOT EXISTS idx_users_profile_picture ON users(profile_picture_url) WHERE profile_picture_url IS NOT NULL;

-- Create index for profile searches
CREATE INDEX IF NOT EXISTS idx_users_job_title ON users(job_title) WHERE job_title IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_department ON users(department) WHERE department IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_location ON users(location) WHERE location IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN users.profile_picture_url IS 'URL or path to user profile picture image';
COMMENT ON COLUMN users.about IS 'User bio/about section - rich text describing the user';
COMMENT ON COLUMN users.phone IS 'User phone number for contact';
COMMENT ON COLUMN users.location IS 'User physical location or address';
COMMENT ON COLUMN users.job_title IS 'User job title or position';
COMMENT ON COLUMN users.department IS 'Department or team the user belongs to';
COMMENT ON COLUMN users.date_of_birth IS 'User date of birth for profile information';
COMMENT ON COLUMN users.profile_updated_at IS 'Timestamp when profile information was last updated';