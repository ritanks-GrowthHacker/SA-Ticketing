-- ====================================================================
-- SQL COMMANDS TO FIX FOREIGN KEY CONSTRAINTS
-- Run these commands in pgAdmin for each database
-- ====================================================================
-- This will change foreign key constraints from RESTRICT to CASCADE
-- allowing automatic deletion of related records
-- ====================================================================

-- ====================================================================
-- FOR DATABASE: organisation_ticket_sales
-- ====================================================================
-- Run this in pgAdmin connected to organisation_ticket_sales database

-- Step 1: Generate script to recreate all foreign keys with CASCADE
-- Copy the output from this query and run it:

SELECT 
    'ALTER TABLE ' || tc.table_schema || '.' || tc.table_name || 
    ' DROP CONSTRAINT ' || tc.constraint_name || ';' || chr(10) ||
    'ALTER TABLE ' || tc.table_schema || '.' || tc.table_name || 
    ' ADD CONSTRAINT ' || tc.constraint_name || 
    ' FOREIGN KEY (' || kcu.column_name || ')' ||
    ' REFERENCES ' || ccu.table_schema || '.' || ccu.table_name || 
    '(' || ccu.column_name || ')' ||
    ' ON DELETE CASCADE ON UPDATE CASCADE;' as fix_command
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- ====================================================================
-- ALTERNATIVE: Quick fix for all constraints at once
-- ====================================================================
-- This script will automatically recreate ALL foreign keys with CASCADE
-- WARNING: This is a bulk operation, backup your database first!

DO $$ 
DECLARE
    constraint_record RECORD;
    drop_cmd TEXT;
    add_cmd TEXT;
BEGIN
    FOR constraint_record IN 
        SELECT 
            tc.table_schema,
            tc.table_name,
            tc.constraint_name,
            kcu.column_name,
            ccu.table_schema AS foreign_table_schema,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
    LOOP
        -- Drop existing constraint
        drop_cmd := 'ALTER TABLE ' || constraint_record.table_schema || '.' || 
                    constraint_record.table_name || 
                    ' DROP CONSTRAINT IF EXISTS ' || constraint_record.constraint_name;
        
        EXECUTE drop_cmd;
        RAISE NOTICE 'Dropped: %', constraint_record.constraint_name;
        
        -- Recreate with CASCADE
        add_cmd := 'ALTER TABLE ' || constraint_record.table_schema || '.' || 
                   constraint_record.table_name || 
                   ' ADD CONSTRAINT ' || constraint_record.constraint_name || 
                   ' FOREIGN KEY (' || constraint_record.column_name || ')' ||
                   ' REFERENCES ' || constraint_record.foreign_table_schema || '.' || 
                   constraint_record.foreign_table_name || 
                   '(' || constraint_record.foreign_column_name || ')' ||
                   ' ON DELETE CASCADE ON UPDATE CASCADE';
        
        EXECUTE add_cmd;
        RAISE NOTICE 'Created: %', constraint_record.constraint_name;
    END LOOP;
END $$;

-- Verify changes
SELECT 
    tc.table_name,
    tc.constraint_name,
    rc.delete_rule,
    rc.update_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;


-- ====================================================================
-- FOR DATABASE: organisation_sales
-- ====================================================================
-- Connect to organisation_sales database in pgAdmin and run:

DO $$ 
DECLARE
    constraint_record RECORD;
    drop_cmd TEXT;
    add_cmd TEXT;
BEGIN
    FOR constraint_record IN 
        SELECT 
            tc.table_schema,
            tc.table_name,
            tc.constraint_name,
            kcu.column_name,
            ccu.table_schema AS foreign_table_schema,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
    LOOP
        -- Drop existing constraint
        drop_cmd := 'ALTER TABLE ' || constraint_record.table_schema || '.' || 
                    constraint_record.table_name || 
                    ' DROP CONSTRAINT IF EXISTS ' || constraint_record.constraint_name;
        
        EXECUTE drop_cmd;
        RAISE NOTICE 'Dropped: %', constraint_record.constraint_name;
        
        -- Recreate with CASCADE
        add_cmd := 'ALTER TABLE ' || constraint_record.table_schema || '.' || 
                   constraint_record.table_name || 
                   ' ADD CONSTRAINT ' || constraint_record.constraint_name || 
                   ' FOREIGN KEY (' || constraint_record.column_name || ')' ||
                   ' REFERENCES ' || constraint_record.foreign_table_schema || '.' || 
                   constraint_record.foreign_table_name || 
                   '(' || constraint_record.foreign_column_name || ')' ||
                   ' ON DELETE CASCADE ON UPDATE CASCADE';
        
        EXECUTE add_cmd;
        RAISE NOTICE 'Created: %', constraint_record.constraint_name;
    END LOOP;
END $$;

-- Verify changes
SELECT 
    tc.table_name,
    tc.constraint_name,
    rc.delete_rule,
    rc.update_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;


-- ====================================================================
-- FOR DATABASE: human_resource_module
-- ====================================================================
-- Connect to human_resource_module database in pgAdmin and run:

DO $$ 
DECLARE
    constraint_record RECORD;
    drop_cmd TEXT;
    add_cmd TEXT;
BEGIN
    FOR constraint_record IN 
        SELECT 
            tc.table_schema,
            tc.table_name,
            tc.constraint_name,
            kcu.column_name,
            ccu.table_schema AS foreign_table_schema,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
    LOOP
        -- Drop existing constraint
        drop_cmd := 'ALTER TABLE ' || constraint_record.table_schema || '.' || 
                    constraint_record.table_name || 
                    ' DROP CONSTRAINT IF EXISTS ' || constraint_record.constraint_name;
        
        EXECUTE drop_cmd;
        RAISE NOTICE 'Dropped: %', constraint_record.constraint_name;
        
        -- Recreate with CASCADE
        add_cmd := 'ALTER TABLE ' || constraint_record.table_schema || '.' || 
                   constraint_record.table_name || 
                   ' ADD CONSTRAINT ' || constraint_record.constraint_name || 
                   ' FOREIGN KEY (' || constraint_record.column_name || ')' ||
                   ' REFERENCES ' || constraint_record.foreign_table_schema || '.' || 
                   constraint_record.foreign_table_name || 
                   '(' || constraint_record.foreign_column_name || ')' ||
                   ' ON DELETE CASCADE ON UPDATE CASCADE';
        
        EXECUTE add_cmd;
        RAISE NOTICE 'Created: %', constraint_record.constraint_name;
    END LOOP;
END $$;

-- Verify changes
SELECT 
    tc.table_name,
    tc.constraint_name,
    rc.delete_rule,
    rc.update_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name;


-- ====================================================================
-- IMPORTANT NOTES:
-- ====================================================================
-- 1. CASCADE DELETE will automatically delete all related records
--    Example: Deleting a user will delete all their tickets, comments, etc.
--
-- 2. BACKUP YOUR DATABASE BEFORE RUNNING THESE COMMANDS!
--    pg_dump -U postgres -d organisation_ticket_sales > backup_tickets.sql
--    pg_dump -U postgres -d organisation_sales > backup_sales.sql
--    pg_dump -U postgres -d human_resource_module > backup_hrm.sql
--
-- 3. Alternative approaches if CASCADE is too aggressive:
--    - Use ON DELETE SET NULL (sets foreign key to NULL instead)
--    - Keep RESTRICT and handle deletions in application logic
--    - Use soft deletes (add 'deleted_at' column instead of actual deletion)
--
-- 4. To test in one database first, run only that database's section
--
-- 5. The RAISE NOTICE statements will show progress in the Messages tab
-- ====================================================================
