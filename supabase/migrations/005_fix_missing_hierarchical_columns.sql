-- =========================================
-- Fix Missing Hierarchical Columns in KSIC Table
-- =========================================
-- Migration: 005_fix_missing_hierarchical_columns.sql
-- Description: Ensures all hierarchical columns (division, major, minor, sub, detail)
--              exist in ksic_codes table before creating indexes
--
-- This migration fixes the "column major_code does not exist" error
-- by ensuring all columns from the original schema are present
-- =========================================

-- =========================================
-- 1. Ensure all hierarchical columns exist
-- =========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Checking and adding missing columns...';
    RAISE NOTICE '========================================';

    -- division_code (대분류 코드)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'division_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN division_code TEXT;
        RAISE NOTICE '✓ Added column: division_code';
    ELSE
        RAISE NOTICE 'ℹ Column division_code already exists';
    END IF;

    -- division_name (대분류명)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'division_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN division_name TEXT;
        RAISE NOTICE '✓ Added column: division_name';
    ELSE
        RAISE NOTICE 'ℹ Column division_name already exists';
    END IF;

    -- major_code (중분류 코드) - THE CRITICAL ONE
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'major_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN major_code TEXT;
        RAISE NOTICE '✓ Added column: major_code';
    ELSE
        RAISE NOTICE 'ℹ Column major_code already exists';
    END IF;

    -- major_name (중분류명)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'major_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN major_name TEXT;
        RAISE NOTICE '✓ Added column: major_name';
    ELSE
        RAISE NOTICE 'ℹ Column major_name already exists';
    END IF;

    -- minor_code (소분류 코드)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'minor_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN minor_code TEXT;
        RAISE NOTICE '✓ Added column: minor_code';
    ELSE
        RAISE NOTICE 'ℹ Column minor_code already exists';
    END IF;

    -- minor_name (소분류명)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'minor_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN minor_name TEXT;
        RAISE NOTICE '✓ Added column: minor_name';
    ELSE
        RAISE NOTICE 'ℹ Column minor_name already exists';
    END IF;

    -- sub_code (세분류 코드)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'sub_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN sub_code TEXT;
        RAISE NOTICE '✓ Added column: sub_code';
    ELSE
        RAISE NOTICE 'ℹ Column sub_code already exists';
    END IF;

    -- sub_name (세분류명)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'sub_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN sub_name TEXT;
        RAISE NOTICE '✓ Added column: sub_name';
    ELSE
        RAISE NOTICE 'ℹ Column sub_name already exists';
    END IF;

    -- detail_code (세세분류 코드)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'detail_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN detail_code TEXT;
        RAISE NOTICE '✓ Added column: detail_code';
    ELSE
        RAISE NOTICE 'ℹ Column detail_code already exists';
    END IF;

    -- detail_name (세세분류명)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'detail_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN detail_name TEXT;
        RAISE NOTICE '✓ Added column: detail_name';
    ELSE
        RAISE NOTICE 'ℹ Column detail_name already exists';
    END IF;

    -- description (설명)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'description'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN description TEXT;
        RAISE NOTICE '✓ Added column: description';
    ELSE
        RAISE NOTICE 'ℹ Column description already exists';
    END IF;
END $$;

-- =========================================
-- 2. Populate major_code if empty
-- =========================================

DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Populating major_code from ksic_code...';
    RAISE NOTICE '========================================';

    -- Update major_code for records where it's null but ksic_code exists
    UPDATE public.ksic_codes
    SET major_code = SUBSTRING(ksic_code, 1, 2)
    WHERE major_code IS NULL
    AND ksic_code IS NOT NULL
    AND LENGTH(ksic_code) >= 2;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    IF updated_count > 0 THEN
        RAISE NOTICE '✓ Updated % records with major_code', updated_count;
    ELSE
        RAISE NOTICE 'ℹ No records needed major_code update';
    END IF;
END $$;

-- =========================================
-- 3. Create or recreate indexes
-- =========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Creating indexes...';
    RAISE NOTICE '========================================';
END $$;

-- Drop existing indexes if they exist (to recreate them cleanly)
DROP INDEX IF EXISTS idx_ksic_codes_major;
DROP INDEX IF EXISTS idx_ksic_codes_top_industry;
DROP INDEX IF EXISTS idx_ksic_codes_name;

-- Recreate indexes
CREATE INDEX idx_ksic_codes_major ON public.ksic_codes(major_code);
CREATE INDEX idx_ksic_codes_top_industry ON public.ksic_codes(top_industry);
CREATE INDEX idx_ksic_codes_name ON public.ksic_codes(ksic_name);

-- =========================================
-- 4. Verify the fix
-- =========================================

DO $$
DECLARE
    major_code_exists BOOLEAN;
    index_exists BOOLEAN;
    sample_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Verifying fix...';
    RAISE NOTICE '========================================';

    -- Check if major_code column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'major_code'
    ) INTO major_code_exists;

    -- Check if index exists
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'ksic_codes'
        AND indexname = 'idx_ksic_codes_major'
    ) INTO index_exists;

    -- Count records with major_code
    SELECT COUNT(*) INTO sample_count
    FROM public.ksic_codes
    WHERE major_code IS NOT NULL;

    -- Report results
    IF major_code_exists THEN
        RAISE NOTICE '✓ Column major_code exists';
    ELSE
        RAISE WARNING '✗ Column major_code does NOT exist';
    END IF;

    IF index_exists THEN
        RAISE NOTICE '✓ Index idx_ksic_codes_major exists';
    ELSE
        RAISE WARNING '✗ Index idx_ksic_codes_major does NOT exist';
    END IF;

    RAISE NOTICE 'ℹ Records with major_code: %', sample_count;

    IF major_code_exists AND index_exists THEN
        RAISE NOTICE '========================================';
        RAISE NOTICE '✓✓✓ FIX COMPLETED SUCCESSFULLY ✓✓✓';
        RAISE NOTICE '========================================';
    ELSE
        RAISE WARNING '========================================';
        RAISE WARNING '⚠ FIX MAY BE INCOMPLETE - CHECK ABOVE';
        RAISE WARNING '========================================';
    END IF;
END $$;

-- =========================================
-- 5. Add column comments
-- =========================================

COMMENT ON COLUMN public.ksic_codes.division_code IS 'KSIC 대분류 코드 (1자리)';
COMMENT ON COLUMN public.ksic_codes.division_name IS 'KSIC 대분류명';
COMMENT ON COLUMN public.ksic_codes.major_code IS 'KSIC 중분류 코드 (2자리)';
COMMENT ON COLUMN public.ksic_codes.major_name IS 'KSIC 중분류명';
COMMENT ON COLUMN public.ksic_codes.minor_code IS 'KSIC 소분류 코드 (3자리)';
COMMENT ON COLUMN public.ksic_codes.minor_name IS 'KSIC 소분류명';
COMMENT ON COLUMN public.ksic_codes.sub_code IS 'KSIC 세분류 코드 (4자리)';
COMMENT ON COLUMN public.ksic_codes.sub_name IS 'KSIC 세분류명';
COMMENT ON COLUMN public.ksic_codes.detail_code IS 'KSIC 세세분류 코드 (5자리)';
COMMENT ON COLUMN public.ksic_codes.detail_name IS 'KSIC 세세분류명';
COMMENT ON COLUMN public.ksic_codes.description IS 'KSIC 코드 설명';
