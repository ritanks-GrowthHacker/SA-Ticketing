-- Fix tickets.priority_id foreign key to point to priorities table instead of statuses
-- This fixes the error: "insert or update on table "tickets" violates foreign key constraint "tickets_priority_id_fkey""

-- Step 1: Drop the incorrect foreign key constraint
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_priority_id_fkey;

-- Step 2: Add the correct foreign key constraint pointing to priorities table
ALTER TABLE tickets 
ADD CONSTRAINT tickets_priority_id_fkey 
FOREIGN KEY (priority_id) REFERENCES priorities(id);

-- Verify the change
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'tickets'
  AND kcu.column_name = 'priority_id';
