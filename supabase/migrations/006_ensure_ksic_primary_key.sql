-- =========================================
-- Ensure KSIC Primary Key Constraint Exists
-- =========================================
-- Migration: 006_ensure_ksic_primary_key.sql
-- Description: Fixes the "there is no unique or exclusion constraint matching
--              the ON CONFLICT specification" error by ensuring a proper
--              primary key constraint exists on ksic_code column
--
-- This migration:
-- 1. Removes duplicate ksic_code values if any exist
-- 2. Ensures ksic_code is NOT NULL
-- 3. Drops and recreates the primary key constraint properly
-- =========================================

-- =========================================
-- 1. Remove duplicate ksic_code values
-- =========================================

DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Checking for duplicate ksic_code values...';
    RAISE NOTICE '========================================';

    -- Count duplicates
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT ksic_code, COUNT(*) as cnt
        FROM public.ksic_codes
        GROUP BY ksic_code
        HAVING COUNT(*) > 1
    ) duplicates;

    IF duplicate_count > 0 THEN
        RAISE NOTICE '⚠ Found % duplicate ksic_code values', duplicate_count;

        -- Keep only the most recent record for each ksic_code
        DELETE FROM public.ksic_codes
        WHERE ctid NOT IN (
            SELECT MAX(ctid)
            FROM public.ksic_codes
            GROUP BY ksic_code
        );

        RAISE NOTICE '✓ Removed duplicate ksic_code records';
    ELSE
        RAISE NOTICE 'ℹ No duplicate ksic_code values found';
    END IF;
END $$;

-- =========================================
-- 2. Remove NULL ksic_code values
-- =========================================

DO $$
DECLARE
    null_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Checking for NULL ksic_code values...';
    RAISE NOTICE '========================================';

    -- Count NULL values
    SELECT COUNT(*) INTO null_count
    FROM public.ksic_codes
    WHERE ksic_code IS NULL;

    IF null_count > 0 THEN
        RAISE NOTICE '⚠ Found % records with NULL ksic_code', null_count;

        -- Delete records with NULL ksic_code
        DELETE FROM public.ksic_codes
        WHERE ksic_code IS NULL;

        RAISE NOTICE '✓ Removed records with NULL ksic_code';
    ELSE
        RAISE NOTICE 'ℹ No NULL ksic_code values found';
    END IF;
END $$;

-- =========================================
-- 3. Drop existing primary key constraint (if exists)
-- =========================================

DO $$
DECLARE
    constraint_exists BOOLEAN;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Checking existing primary key constraint...';
    RAISE NOTICE '========================================';

    -- Check if any primary key exists on ksic_codes table
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND constraint_type = 'PRIMARY KEY'
    ) INTO constraint_exists;

    IF constraint_exists THEN
        RAISE NOTICE '⚠ Existing primary key constraint found, dropping it...';

        -- Drop the constraint (using CASCADE to handle dependencies)
        ALTER TABLE public.ksic_codes DROP CONSTRAINT IF EXISTS ksic_codes_pkey CASCADE;

        RAISE NOTICE '✓ Dropped existing primary key constraint';
    ELSE
        RAISE NOTICE 'ℹ No existing primary key constraint found';
    END IF;
END $$;

-- =========================================
-- 4. Add PRIMARY KEY constraint on ksic_code
-- =========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Adding PRIMARY KEY constraint on ksic_code...';
    RAISE NOTICE '========================================';

    -- Add NOT NULL constraint first (if not already present)
    BEGIN
        ALTER TABLE public.ksic_codes ALTER COLUMN ksic_code SET NOT NULL;
        RAISE NOTICE '✓ Set ksic_code column to NOT NULL';
    EXCEPTION
        WHEN others THEN
            RAISE NOTICE 'ℹ ksic_code column already NOT NULL or error: %', SQLERRM;
    END;

    -- Add PRIMARY KEY constraint
    BEGIN
        ALTER TABLE public.ksic_codes ADD CONSTRAINT ksic_codes_pkey PRIMARY KEY (ksic_code);
        RAISE NOTICE '✓ Added PRIMARY KEY constraint on ksic_code';
    EXCEPTION
        WHEN duplicate_table THEN
            RAISE NOTICE 'ℹ Primary key constraint already exists';
        WHEN unique_violation THEN
            RAISE EXCEPTION '✗ Cannot add primary key: duplicate values exist in ksic_code column';
        WHEN others THEN
            RAISE EXCEPTION '✗ Failed to add primary key: %', SQLERRM;
    END;
END $$;

-- =========================================
-- 5. Verify the constraint
-- =========================================

DO $$
DECLARE
    pk_exists BOOLEAN;
    record_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Verifying PRIMARY KEY constraint...';
    RAISE NOTICE '========================================';

    -- Check if primary key exists on ksic_code
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = 'ksic_codes'
        AND kcu.column_name = 'ksic_code'
    ) INTO pk_exists;

    -- Count total records
    SELECT COUNT(*) INTO record_count
    FROM public.ksic_codes;

    -- Report results
    IF pk_exists THEN
        RAISE NOTICE '✓ PRIMARY KEY constraint exists on ksic_code';
        RAISE NOTICE 'ℹ Total records in ksic_codes: %', record_count;
        RAISE NOTICE '========================================';
        RAISE NOTICE '✓✓✓ MIGRATION COMPLETED SUCCESSFULLY ✓✓✓';
        RAISE NOTICE '========================================';
    ELSE
        RAISE EXCEPTION '✗ PRIMARY KEY constraint does NOT exist on ksic_code - migration failed';
    END IF;
END $$;

-- =========================================
-- 6. Recreate foreign key constraints if needed
-- =========================================

-- Recreate foreign key from companies table to ksic_codes
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Checking foreign key constraints...';
    RAISE NOTICE '========================================';

    -- Check if foreign key exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'companies'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%ksic_code%'
    ) THEN
        RAISE NOTICE 'ℹ Foreign key constraint already exists on companies.ksic_code';
    ELSE
        -- Check if companies table and ksic_code column exist
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'companies'
            AND column_name = 'ksic_code'
        ) THEN
            -- Add foreign key constraint
            BEGIN
                ALTER TABLE public.companies
                ADD CONSTRAINT companies_ksic_code_fkey
                FOREIGN KEY (ksic_code)
                REFERENCES public.ksic_codes(ksic_code);

                RAISE NOTICE '✓ Added foreign key constraint on companies.ksic_code';
            EXCEPTION
                WHEN foreign_key_violation THEN
                    RAISE NOTICE '⚠ Cannot add foreign key: invalid ksic_code values exist in companies table';
                WHEN others THEN
                    RAISE NOTICE '⚠ Could not add foreign key: %', SQLERRM;
            END;
        ELSE
            RAISE NOTICE 'ℹ companies.ksic_code column does not exist, skipping foreign key';
        END IF;
    END IF;
END $$;

-- =========================================
-- Complete
-- =========================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 006 Complete!';
    RAISE NOTICE '';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  ✓ Removed duplicate ksic_code values';
    RAISE NOTICE '  ✓ Removed NULL ksic_code values';
    RAISE NOTICE '  ✓ Dropped old primary key constraint';
    RAISE NOTICE '  ✓ Added new PRIMARY KEY on ksic_code';
    RAISE NOTICE '  ✓ Verified constraint exists';
    RAISE NOTICE '';
    RAISE NOTICE 'The import script should now work correctly!';
    RAISE NOTICE '========================================';
END $$;
