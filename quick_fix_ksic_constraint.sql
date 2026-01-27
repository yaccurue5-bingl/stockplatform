-- =========================================
-- QUICK FIX: KSIC Primary Key Constraint
-- =========================================
-- This script fixes the "there is no unique or exclusion constraint matching
-- the ON CONFLICT specification" error
--
-- HOW TO USE:
-- 1. Open your Supabase dashboard
-- 2. Go to SQL Editor
-- 3. Copy and paste this entire script
-- 4. Click "Run"
--
-- This will:
-- - Remove any duplicate ksic_code values
-- - Remove any NULL ksic_code values
-- - Drop and recreate the primary key constraint properly
-- =========================================

-- Step 1: Remove duplicate ksic_code values (keep the most recent)
DELETE FROM public.ksic_codes
WHERE ctid NOT IN (
    SELECT MAX(ctid)
    FROM public.ksic_codes
    GROUP BY ksic_code
);

-- Step 2: Remove NULL ksic_code values
DELETE FROM public.ksic_codes
WHERE ksic_code IS NULL;

-- Step 3: Drop existing primary key constraint (if exists)
ALTER TABLE public.ksic_codes DROP CONSTRAINT IF EXISTS ksic_codes_pkey CASCADE;

-- Step 4: Make ksic_code NOT NULL
ALTER TABLE public.ksic_codes ALTER COLUMN ksic_code SET NOT NULL;

-- Step 5: Add PRIMARY KEY constraint
ALTER TABLE public.ksic_codes ADD CONSTRAINT ksic_codes_pkey PRIMARY KEY (ksic_code);

-- Step 6: Recreate foreign key from companies table (if needed)
DO $$
BEGIN
    -- Drop existing foreign key if it exists
    ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS companies_ksic_code_fkey;

    -- Add foreign key constraint
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'companies'
        AND column_name = 'ksic_code'
    ) THEN
        ALTER TABLE public.companies
        ADD CONSTRAINT companies_ksic_code_fkey
        FOREIGN KEY (ksic_code)
        REFERENCES public.ksic_codes(ksic_code);

        RAISE NOTICE '✓ Added foreign key constraint on companies.ksic_code';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE '⚠ Could not add foreign key: %', SQLERRM;
END $$;

-- Step 7: Verify the fix
DO $$
DECLARE
    pk_exists BOOLEAN;
    record_count INTEGER;
BEGIN
    -- Check if primary key exists
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
    RAISE NOTICE '========================================';
    IF pk_exists THEN
        RAISE NOTICE '✓✓✓ PRIMARY KEY CONSTRAINT EXISTS ✓✓✓';
        RAISE NOTICE 'Total records: %', record_count;
        RAISE NOTICE '========================================';
        RAISE NOTICE 'The import script should now work!';
    ELSE
        RAISE NOTICE '✗✗✗ PRIMARY KEY CONSTRAINT MISSING ✗✗✗';
        RAISE NOTICE '========================================';
        RAISE NOTICE 'Please check for errors above';
    END IF;
    RAISE NOTICE '========================================';
END $$;
