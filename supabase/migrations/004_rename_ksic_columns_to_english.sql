-- =========================================
-- KSIC Columns Rename: Korean to English
-- =========================================
-- Migration: 004_rename_ksic_columns_to_english.sql
-- Description: ksic_codes 테이블의 한글 컬럼명을 영문으로 변경
--
-- Mapping:
--   산업코드 → ksic_code
--   산업내용 → ksic_name
--   상위업종 → top_industry (if exists)

-- =========================================
-- 1. Check if Korean columns exist and rename them
-- =========================================

-- 산업코드 → ksic_code 변경 (존재하는 경우)
DO $$
BEGIN
    -- Check if 산업코드 column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = '산업코드'
    ) THEN
        -- Check if ksic_code already exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'ksic_codes'
            AND column_name = 'ksic_code'
        ) THEN
            -- Rename 산업코드 to ksic_code
            ALTER TABLE public.ksic_codes RENAME COLUMN "산업코드" TO ksic_code;
            RAISE NOTICE '✓ Renamed column: 산업코드 → ksic_code';
        ELSE
            -- Copy data from 산업코드 to ksic_code and drop 산업코드
            EXECUTE 'UPDATE public.ksic_codes SET ksic_code = "산업코드" WHERE ksic_code IS NULL';
            EXECUTE 'ALTER TABLE public.ksic_codes DROP COLUMN "산업코드"';
            RAISE NOTICE '✓ Copied data from 산업코드 to ksic_code and dropped 산업코드';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ Column 산업코드 does not exist (already renamed or never existed)';
    END IF;
END $$;

-- 산업내용 → ksic_name 변경 (존재하는 경우)
DO $$
BEGIN
    -- Check if 산업내용 column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = '산업내용'
    ) THEN
        -- Check if ksic_name already exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'ksic_codes'
            AND column_name = 'ksic_name'
        ) THEN
            -- Rename 산업내용 to ksic_name
            ALTER TABLE public.ksic_codes RENAME COLUMN "산업내용" TO ksic_name;
            RAISE NOTICE '✓ Renamed column: 산업내용 → ksic_name';
        ELSE
            -- Copy data from 산업내용 to ksic_name and drop 산업내용
            EXECUTE 'UPDATE public.ksic_codes SET ksic_name = "산업내용" WHERE ksic_name IS NULL OR ksic_name = ''''';
            EXECUTE 'ALTER TABLE public.ksic_codes DROP COLUMN "산업내용"';
            RAISE NOTICE '✓ Copied data from 산업내용 to ksic_name and dropped 산업내용';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ Column 산업내용 does not exist (already renamed or never existed)';
    END IF;
END $$;

-- 상위업종 → top_industry 변경 (존재하는 경우)
DO $$
BEGIN
    -- Check if 상위업종 column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = '상위업종'
    ) THEN
        -- Check if top_industry already exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'ksic_codes'
            AND column_name = 'top_industry'
        ) THEN
            -- Rename 상위업종 to top_industry
            ALTER TABLE public.ksic_codes RENAME COLUMN "상위업종" TO top_industry;
            RAISE NOTICE '✓ Renamed column: 상위업종 → top_industry';
        ELSE
            -- Copy data from 상위업종 to top_industry and drop 상위업종
            EXECUTE 'UPDATE public.ksic_codes SET top_industry = "상위업종" WHERE top_industry IS NULL OR top_industry = ''''';
            EXECUTE 'ALTER TABLE public.ksic_codes DROP COLUMN "상위업종"';
            RAISE NOTICE '✓ Copied data from 상위업종 to top_industry and dropped 상위업종';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ Column 상위업종 does not exist (already renamed or never existed)';
    END IF;
END $$;

-- =========================================
-- 2. Ensure English columns exist with correct types
-- =========================================

-- Ensure ksic_code exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'ksic_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN ksic_code TEXT;
        RAISE NOTICE '✓ Added column: ksic_code';
    END IF;
END $$;

-- Ensure ksic_name exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'ksic_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN ksic_name TEXT;
        RAISE NOTICE '✓ Added column: ksic_name';
    END IF;
END $$;

-- Ensure top_industry exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'top_industry'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN top_industry TEXT;
        RAISE NOTICE '✓ Added column: top_industry';
    END IF;
END $$;

-- Ensure hierarchical columns exist (division, major, minor, sub, detail)
DO $$
BEGIN
    -- division_code
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'division_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN division_code TEXT;
        RAISE NOTICE '✓ Added column: division_code';
    END IF;

    -- division_name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'division_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN division_name TEXT;
        RAISE NOTICE '✓ Added column: division_name';
    END IF;

    -- major_code
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'major_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN major_code TEXT;
        RAISE NOTICE '✓ Added column: major_code';
    END IF;

    -- major_name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'major_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN major_name TEXT;
        RAISE NOTICE '✓ Added column: major_name';
    END IF;

    -- minor_code
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'minor_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN minor_code TEXT;
        RAISE NOTICE '✓ Added column: minor_code';
    END IF;

    -- minor_name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'minor_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN minor_name TEXT;
        RAISE NOTICE '✓ Added column: minor_name';
    END IF;

    -- sub_code
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'sub_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN sub_code TEXT;
        RAISE NOTICE '✓ Added column: sub_code';
    END IF;

    -- sub_name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'sub_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN sub_name TEXT;
        RAISE NOTICE '✓ Added column: sub_name';
    END IF;

    -- detail_code
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'detail_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN detail_code TEXT;
        RAISE NOTICE '✓ Added column: detail_code';
    END IF;

    -- detail_name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'detail_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN detail_name TEXT;
        RAISE NOTICE '✓ Added column: detail_name';
    END IF;

    -- description
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'description'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN description TEXT;
        RAISE NOTICE '✓ Added column: description';
    END IF;

    -- created_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE '✓ Added column: created_at';
    END IF;

    -- updated_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE '✓ Added column: updated_at';
    END IF;
END $$;

-- =========================================
-- 3. Update constraints if needed
-- =========================================

-- Drop old primary key if it exists on 산업코드
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND constraint_name LIKE '%산업코드%'
    ) THEN
        ALTER TABLE public.ksic_codes DROP CONSTRAINT IF EXISTS ksic_codes_pkey CASCADE;
        RAISE NOTICE '✓ Dropped old primary key constraint';
    END IF;
END $$;

-- Ensure primary key on ksic_code
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND constraint_type = 'PRIMARY KEY'
        AND constraint_name = 'ksic_codes_pkey'
    ) THEN
        ALTER TABLE public.ksic_codes ADD CONSTRAINT ksic_codes_pkey PRIMARY KEY (ksic_code);
        RAISE NOTICE '✓ Added primary key constraint on ksic_code';
    END IF;
EXCEPTION
    WHEN duplicate_table THEN
        RAISE NOTICE 'ℹ Primary key constraint already exists';
    WHEN others THEN
        RAISE NOTICE 'ℹ Could not add primary key: %', SQLERRM;
END $$;

-- =========================================
-- 4. Update indexes
-- =========================================

-- Recreate indexes if needed
CREATE INDEX IF NOT EXISTS idx_ksic_codes_name ON public.ksic_codes(ksic_name);
CREATE INDEX IF NOT EXISTS idx_ksic_codes_top_industry ON public.ksic_codes(top_industry);
CREATE INDEX IF NOT EXISTS idx_ksic_codes_major ON public.ksic_codes(major_code);

-- =========================================
-- 5. Update column comments
-- =========================================

COMMENT ON COLUMN public.ksic_codes.ksic_code IS 'KSIC 코드 (한국표준산업분류 코드, 최대 5자리)';
COMMENT ON COLUMN public.ksic_codes.ksic_name IS 'KSIC 산업명 (산업분류명칭)';
COMMENT ON COLUMN public.ksic_codes.top_industry IS '상위 업종 분류 (서비스용 카테고리)';

-- =========================================
-- 완료
-- =========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ KSIC Column Rename Migration Complete';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Renamed columns:';
    RAISE NOTICE '  - 산업코드 → ksic_code';
    RAISE NOTICE '  - 산업내용 → ksic_name';
    RAISE NOTICE '  - 상위업종 → top_industry';
    RAISE NOTICE '========================================';
END $$;
