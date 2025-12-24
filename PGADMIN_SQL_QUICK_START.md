# Quick Start: SQL Migration for First Login Tracking

## Run This SQL in PGAdmin

Copy and paste this entire block into PGAdmin Query Tool and execute:

```sql
-- =====================================================
-- Add First Login Tracking Column
-- =====================================================

-- Add the column
ALTER TABLE public.users 
ADD COLUMN first_login_after_project_assignment BOOLEAN DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN public.users.first_login_after_project_assignment 
IS 'Tracks if user has logged in for the first time after being assigned to a project and project role.';

-- Create index for performance
CREATE INDEX idx_users_first_login 
ON public.users(first_login_after_project_assignment) 
WHERE first_login_after_project_assignment = FALSE;

-- Verify the migration
SELECT column_name, data_type, column_default, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND column_name = 'first_login_after_project_assignment';
```

## Expected Output

You should see:
```
| column_name                              | data_type | column_default | is_nullable |
|------------------------------------------|-----------|----------------|-------------|
| first_login_after_project_assignment     | boolean   | false          | YES         |
```

## Testing

### To test with a specific user:
```sql
-- Reset a user to show the welcome modal again
UPDATE users 
SET first_login_after_project_assignment = FALSE 
WHERE email = 'your-test-user@example.com';
```

### To check all users' status:
```sql
SELECT 
  id, 
  name, 
  email, 
  first_login_after_project_assignment 
FROM users 
ORDER BY created_at DESC 
LIMIT 10;
```

### To mark all existing users as completed (if needed):
```sql
-- Use this if you don't want existing users to see the modal
UPDATE users 
SET first_login_after_project_assignment = TRUE 
WHERE first_login_after_project_assignment = FALSE;
```

## Rollback (if needed)

If you need to remove this feature:
```sql
-- Remove the index
DROP INDEX IF EXISTS idx_users_first_login;

-- Remove the column
ALTER TABLE public.users 
DROP COLUMN IF EXISTS first_login_after_project_assignment;
```

---

✅ After running this SQL, the system is ready to show the welcome modal to users on their first login after project assignment!
