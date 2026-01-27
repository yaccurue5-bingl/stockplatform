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
    ksic_code_col_exists BOOLEAN;
    korean_col_exists BOOLEAN;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Populating major_code from ksic_code...';
    RAISE NOTICE '========================================';

    -- Check which column name exists (English or Korean)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'ksic_code'
    ) INTO ksic_code_col_exists;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = '산업코드'
    ) INTO korean_col_exists;

    -- Try to populate from English column name
    IF ksic_code_col_exists THEN
        UPDATE public.ksic_codes
        SET major_code = SUBSTRING(ksic_code, 1, 2)
        WHERE major_code IS NULL
        AND ksic_code IS NOT NULL
        AND LENGTH(ksic_code) >= 2;

        GET DIAGNOSTICS updated_count = ROW_COUNT;

        IF updated_count > 0 THEN
            RAISE NOTICE '✓ Updated % records with major_code from ksic_code', updated_count;
        ELSE
            RAISE NOTICE 'ℹ No records needed major_code update (from ksic_code)';
        END IF;

    -- Try to populate from Korean column name
    ELSIF korean_col_exists THEN
        EXECUTE 'UPDATE public.ksic_codes
                 SET major_code = SUBSTRING("산업코드", 1, 2)
                 WHERE major_code IS NULL
                 AND "산업코드" IS NOT NULL
                 AND LENGTH("산업코드") >= 2';

        GET DIAGNOSTICS updated_count = ROW_COUNT;

        IF updated_count > 0 THEN
            RAISE NOTICE '✓ Updated % records with major_code from 산업코드', updated_count;
        ELSE
            RAISE NOTICE 'ℹ No records needed major_code update (from 산업코드)';
        END IF;

    ELSE
        RAISE WARNING '⚠ Neither ksic_code nor 산업코드 column exists - cannot populate major_code';
    END IF;
END $$;

-- =========================================
-- 3. Ensure primary columns exist (ksic_code, ksic_name, top_industry)
-- =========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Ensuring primary columns exist...';
    RAISE NOTICE '========================================';

    -- Ensure ksic_code exists (might be named 산업코드)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'ksic_code'
    ) THEN
        -- Check if Korean column exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'ksic_codes'
            AND column_name = '산업코드'
        ) THEN
            -- Rename Korean to English
            ALTER TABLE public.ksic_codes RENAME COLUMN "산업코드" TO ksic_code;
            RAISE NOTICE '✓ Renamed 산업코드 → ksic_code';
        ELSE
            -- Create new column
            ALTER TABLE public.ksic_codes ADD COLUMN ksic_code TEXT;
            RAISE NOTICE '✓ Added column: ksic_code';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ Column ksic_code already exists';
    END IF;

    -- Ensure ksic_name exists (might be named 산업내용)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'ksic_name'
    ) THEN
        -- Check if Korean column exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'ksic_codes'
            AND column_name = '산업내용'
        ) THEN
            -- Rename Korean to English
            ALTER TABLE public.ksic_codes RENAME COLUMN "산업내용" TO ksic_name;
            RAISE NOTICE '✓ Renamed 산업내용 → ksic_name';
        ELSE
            -- Create new column
            ALTER TABLE public.ksic_codes ADD COLUMN ksic_name TEXT;
            RAISE NOTICE '✓ Added column: ksic_name';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ Column ksic_name already exists';
    END IF;

    -- Ensure top_industry exists (might be named 상위업종)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'top_industry'
    ) THEN
        -- Check if Korean column exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'ksic_codes'
            AND column_name = '상위업종'
        ) THEN
            -- Rename Korean to English
            ALTER TABLE public.ksic_codes RENAME COLUMN "상위업종" TO top_industry;
            RAISE NOTICE '✓ Renamed 상위업종 → top_industry';
        ELSE
            -- Create new column
            ALTER TABLE public.ksic_codes ADD COLUMN top_industry TEXT;
            RAISE NOTICE '✓ Added column: top_industry';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ Column top_industry already exists';
    END IF;
END $$;

-- =========================================
-- 4. Ensure primary key on ksic_code
-- =========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Checking primary key...';
    RAISE NOTICE '========================================';

    -- Check if primary key exists on ksic_code
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = 'ksic_codes'
        AND kcu.column_name = 'ksic_code'
    ) THEN
        -- Try to add primary key
        BEGIN
            ALTER TABLE public.ksic_codes ADD CONSTRAINT ksic_codes_pkey PRIMARY KEY (ksic_code);
            RAISE NOTICE '✓ Added primary key constraint on ksic_code';
        EXCEPTION
            WHEN duplicate_table THEN
                RAISE NOTICE 'ℹ Primary key constraint already exists';
            WHEN others THEN
                RAISE NOTICE '⚠ Could not add primary key: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'ℹ Primary key on ksic_code already exists';
    END IF;
END $$;

-- =========================================
-- 5. Create or recreate indexes
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
-- 6. Verify the fix
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
-- 7. Add column comments
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
