# User Deletion Fix - Foreign Key Constraint Issues

## Problem
Unable to delete users from the `users` table due to foreign key constraints:
```
Unable to delete rows as one of them is currently referenced by a foreign key constraint from the table `tickets`
DETAIL: Key (id)=(d396bc57-c0fb-47a7-8889-68d0454836af) is still referenced from table tickets.
```

## Root Cause
The database schema has foreign key constraints that prevent user deletion when:
- User has created tickets (`tickets.created_by`)
- User is assigned to tickets (`tickets.assigned_to`)
- User has created projects, departments, documents, etc.
- User has comments, resource requests, etc.

These constraints **do NOT have `ON DELETE CASCADE` or `ON DELETE SET NULL`**, so they block deletion.

## Solutions

### Option 1: Apply Database Migration (RECOMMENDED)
This preserves data history by setting user references to NULL when a user is deleted.

**Steps:**
1. Connect to your Supabase database (SQL Editor)
2. Run the migration script: `database-updates/fix-user-deletion-foreign-keys.sql`
3. This will:
   - Update `tickets` table: Set `assigned_to` and `created_by` to NULL on user deletion
   - Update `ticket_comments`: Set `user_id` to NULL
   - Update `project_documents`: Set `created_by` and `updated_by` to NULL
   - Update `projects`, `departments`: Set `created_by` to NULL
   - Keep CASCADE for `user_roles`, `user_assignments`, `user_department_roles` (these should be deleted)

**Behavior after migration:**
- Deleting a user will preserve all their tickets/projects/comments
- The `created_by` and `assigned_to` fields will become NULL
- You won't lose historical data
- User's role assignments will be automatically removed (CASCADE)

### Option 2: Soft Delete (Alternative - Code-based)
Instead of deleting users, mark them as "inactive" or "deleted".

**Implementation needed:**
1. Add columns to `users` table:
   ```sql
   ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true;
   ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP;
   ```

2. Update user management to filter out inactive users
3. Change "Delete" button to "Deactivate" button
4. Users remain in database but don't appear in UI or have access

### Option 3: Manual Cleanup Before Deletion (Current Workaround)
Before deleting a user, manually remove/reassign their data:

**SQL to check what's blocking:**
```sql
-- Check tickets created by user
SELECT COUNT(*) FROM tickets WHERE created_by = 'd396bc57-c0fb-47a7-8889-68d0454836af';

-- Check tickets assigned to user
SELECT COUNT(*) FROM tickets WHERE assigned_to = 'd396bc57-c0fb-47a7-8889-68d0454836af';

-- Check comments
SELECT COUNT(*) FROM ticket_comments WHERE user_id = 'd396bc57-c0fb-47a7-8889-68d0454836af';

-- Check projects
SELECT COUNT(*) FROM projects WHERE created_by = 'd396bc57-c0fb-47a7-8889-68d0454836af';
```

**SQL to clean up before deletion:**
```sql
-- Reassign tickets to another user or set to NULL
UPDATE tickets SET assigned_to = NULL WHERE assigned_to = 'd396bc57-c0fb-47a7-8889-68d0454836af';
UPDATE tickets SET created_by = NULL WHERE created_by = 'd396bc57-c0fb-47a7-8889-68d0454836af';

-- Remove comments (or set user_id to NULL)
DELETE FROM ticket_comments WHERE user_id = 'd396bc57-c0fb-47a7-8889-68d0454836af';

-- Fix projects
UPDATE projects SET created_by = NULL WHERE created_by = 'd396bc57-c0fb-47a7-8889-68d0454836af';

-- Now delete user
DELETE FROM users WHERE id = 'd396bc57-c0fb-47a7-8889-68d0454836af';
```

## Recommendation

**Run the migration script (Option 1)** - it's the cleanest solution that:
- ✅ Preserves all historical data (tickets, projects, comments remain)
- ✅ Allows user deletion without manual cleanup
- ✅ Follows database best practices
- ✅ Only affects user references, not the actual data
- ✅ Automatically cleans up user role assignments (CASCADE)

After running the migration, user deletion will work seamlessly from the UI without any issues.

## Files Created
- `database-updates/fix-user-deletion-foreign-keys.sql` - Complete migration script ready to run

## Testing After Migration
1. Try deleting a test user who has tickets assigned
2. Verify tickets still exist but `assigned_to` is NULL
3. Verify user_organization_roles entry is deleted (CASCADE)
4. Check activity_logs to ensure deletion is tracked
