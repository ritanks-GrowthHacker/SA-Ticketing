-- ========================================================================
-- AUTOMATED CASCADE DELETE FIX - ALL THREE DATABASES
-- ========================================================================
-- Copy each section and run in pgAdmin for the respective database
-- ========================================================================

-- ========================================================================
-- DATABASE 1: organisation_ticket_sales
-- ========================================================================
-- Connect to this database in pgAdmin and execute below:

BEGIN;

-- Drop and recreate ALL foreign keys with CASCADE DELETE
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Loop through all foreign key constraints
    FOR r IN 
        SELECT
            tc.table_schema,
            tc.table_name,
            tc.constraint_name,
            string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as column_names,
            ccu.table_schema AS foreign_table_schema,
            ccu.table_name AS foreign_table_name,
            string_agg(ccu.column_name, ', ' ORDER BY kcu.ordinal_position) as foreign_column_names
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu 
            ON tc.constraint_name = ccu.constraint_name
            AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
        GROUP BY 
            tc.table_schema,
            tc.table_name,
            tc.constraint_name,
            ccu.table_schema,
            ccu.table_name
        ORDER BY tc.table_name, tc.constraint_name
    LOOP
        -- Drop the constraint
        EXECUTE format(
            'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
            r.table_schema, r.table_name, r.constraint_name
        );
        
        RAISE NOTICE 'Dropped: %.% - %', r.table_name, r.constraint_name, r.column_names;
        
        -- Recreate with CASCADE
        EXECUTE format(
            'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES %I.%I(%s) ON DELETE CASCADE ON UPDATE CASCADE',
            r.table_schema, r.table_name, r.constraint_name,
            r.column_names,
            r.foreign_table_schema, r.foreign_table_name,
            r.foreign_column_names
        );
        
        RAISE NOTICE 'Created CASCADE: %.% -> %.%', r.table_name, r.column_names, r.foreign_table_name, r.foreign_column_names;
    END LOOP;
    
    RAISE NOTICE '=== ALL FOREIGN KEYS UPDATED WITH CASCADE ===';
END $$;

-- Verify the changes
SELECT 
    tc.table_name,
    kcu.column_name,
    tc.constraint_name,
    ccu.table_name AS references_table,
    ccu.column_name AS references_column,
    rc.delete_rule,
    rc.update_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

COMMIT;

-- ========================================================================
-- DATABASE 2: organisation_sales  
-- ========================================================================
-- Connect to this database in pgAdmin and execute below:

BEGIN;

-- Drop and recreate ALL foreign keys with CASCADE DELETE
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Loop through all foreign key constraints
    FOR r IN 
        SELECT
            tc.table_schema,
            tc.table_name,
            tc.constraint_name,
            string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as column_names,
            ccu.table_schema AS foreign_table_schema,
            ccu.table_name AS foreign_table_name,
            string_agg(ccu.column_name, ', ' ORDER BY kcu.ordinal_position) as foreign_column_names
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu 
            ON tc.constraint_name = ccu.constraint_name
            AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
        GROUP BY 
            tc.table_schema,
            tc.table_name,
            tc.constraint_name,
            ccu.table_schema,
            ccu.table_name
        ORDER BY tc.table_name, tc.constraint_name
    LOOP
        -- Drop the constraint
        EXECUTE format(
            'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
            r.table_schema, r.table_name, r.constraint_name
        );
        
        RAISE NOTICE 'Dropped: %.% - %', r.table_name, r.constraint_name, r.column_names;
        
        -- Recreate with CASCADE
        EXECUTE format(
            'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES %I.%I(%s) ON DELETE CASCADE ON UPDATE CASCADE',
            r.table_schema, r.table_name, r.constraint_name,
            r.column_names,
            r.foreign_table_schema, r.foreign_table_name,
            r.foreign_column_names
        );
        
        RAISE NOTICE 'Created CASCADE: %.% -> %.%', r.table_name, r.column_names, r.foreign_table_name, r.foreign_column_names;
    END LOOP;
    
    RAISE NOTICE '=== ALL FOREIGN KEYS UPDATED WITH CASCADE ===';
END $$;

-- Verify the changes
SELECT 
    tc.table_name,
    kcu.column_name,
    tc.constraint_name,
    ccu.table_name AS references_table,
    ccu.column_name AS references_column,
    rc.delete_rule,
    rc.update_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

COMMIT;

-- ========================================================================
-- DATABASE 3: human_resource_module
-- ========================================================================
-- Connect to this database in pgAdmin and execute below:

BEGIN;

-- Drop and recreate ALL foreign keys with CASCADE DELETE
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Loop through all foreign key constraints
    FOR r IN 
        SELECT
            tc.table_schema,
            tc.table_name,
            tc.constraint_name,
            string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as column_names,
            ccu.table_schema AS foreign_table_schema,
            ccu.table_name AS foreign_table_name,
            string_agg(ccu.column_name, ', ' ORDER BY kcu.ordinal_position) as foreign_column_names
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu 
            ON tc.constraint_name = ccu.constraint_name
            AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
        GROUP BY 
            tc.table_schema,
            tc.table_name,
            tc.constraint_name,
            ccu.table_schema,
            ccu.table_name
        ORDER BY tc.table_name, tc.constraint_name
    LOOP
        -- Drop the constraint
        EXECUTE format(
            'ALTER TABLE %I.%I DROP CONSTRAINT IF EXISTS %I',
            r.table_schema, r.table_name, r.constraint_name
        );
        
        RAISE NOTICE 'Dropped: %.% - %', r.table_name, r.constraint_name, r.column_names;
        
        -- Recreate with CASCADE
        EXECUTE format(
            'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES %I.%I(%s) ON DELETE CASCADE ON UPDATE CASCADE',
            r.table_schema, r.table_name, r.constraint_name,
            r.column_names,
            r.foreign_table_schema, r.foreign_table_name,
            r.foreign_column_names
        );
        
        RAISE NOTICE 'Created CASCADE: %.% -> %.%', r.table_name, r.column_names, r.foreign_table_name, r.foreign_column_names;
    END LOOP;
    
    RAISE NOTICE '=== ALL FOREIGN KEYS UPDATED WITH CASCADE ===';
END $$;

-- Verify the changes
SELECT 
    tc.table_name,
    kcu.column_name,
    tc.constraint_name,
    ccu.table_name AS references_table,
    ccu.column_name AS references_column,
    rc.delete_rule,
    rc.update_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

COMMIT;

-- ========================================================================
-- DONE! Check the verification query results to confirm all rules are CASCADE
-- ========================================================================
