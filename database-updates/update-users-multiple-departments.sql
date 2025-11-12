-- Update users table to handle multiple departments
-- Remove single department_id and add departments array

-- Add new departments array column
ALTER TABLE users 
ADD COLUMN departments UUID[];

-- Create index for performance on departments array
CREATE INDEX IF NOT EXISTS idx_users_departments ON users USING GIN (departments);

-- Update existing users to move single department to array (if any exist)
UPDATE users 
SET departments = ARRAY[department_id] 
WHERE department_id IS NOT NULL;

-- Remove old single department column
ALTER TABLE users 
DROP COLUMN IF EXISTS department_id;

-- Also remove old department string column if it exists
ALTER TABLE users 
DROP COLUMN IF EXISTS department;