-- =========================================
-- QUICK FIX for KSIC Column Errors
-- =========================================
-- Run this SQL directly in your Supabase SQL Editor
-- This is a condensed version of migration 005
-- =========================================

-- 1. Rename Korean columns to English if they exist
DO $$
BEGIN
    -- 산업코드 → ksic_code
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ksic_codes' AND column_name = '산업코드') THEN
        ALTER TABLE public.ksic_codes RENAME COLUMN "산업코드" TO ksic_code;
        RAISE NOTICE 'Renamed: 산업코드 → ksic_code';
    END IF;

    -- 산업내용 → ksic_name
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ksic_codes' AND column_name = '산업내용') THEN
        ALTER TABLE public.ksic_codes RENAME COLUMN "산업내용" TO ksic_name;
        RAISE NOTICE 'Renamed: 산업내용 → ksic_name';
    END IF;

    -- 상위업종 → top_industry
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ksic_codes' AND column_name = '상위업종') THEN
        ALTER TABLE public.ksic_codes RENAME COLUMN "상위업종" TO top_industry;
        RAISE NOTICE 'Renamed: 상위업종 → top_industry';
    END IF;
END $$;

-- 2. Add English columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ksic_codes' AND column_name = 'ksic_code') THEN
        ALTER TABLE public.ksic_codes ADD COLUMN ksic_code TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ksic_codes' AND column_name = 'ksic_name') THEN
        ALTER TABLE public.ksic_codes ADD COLUMN ksic_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ksic_codes' AND column_name = 'top_industry') THEN
        ALTER TABLE public.ksic_codes ADD COLUMN top_industry TEXT;
    END IF;
END $$;

-- 3. Add all hierarchical columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ksic_codes' AND column_name = 'major_code') THEN
        ALTER TABLE public.ksic_codes ADD COLUMN major_code TEXT;
        RAISE NOTICE 'Added: major_code';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ksic_codes' AND column_name = 'major_name') THEN
        ALTER TABLE public.ksic_codes ADD COLUMN major_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ksic_codes' AND column_name = 'division_code') THEN
        ALTER TABLE public.ksic_codes ADD COLUMN division_code TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ksic_codes' AND column_name = 'division_name') THEN
        ALTER TABLE public.ksic_codes ADD COLUMN division_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ksic_codes' AND column_name = 'minor_code') THEN
        ALTER TABLE public.ksic_codes ADD COLUMN minor_code TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ksic_codes' AND column_name = 'minor_name') THEN
        ALTER TABLE public.ksic_codes ADD COLUMN minor_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ksic_codes' AND column_name = 'sub_code') THEN
        ALTER TABLE public.ksic_codes ADD COLUMN sub_code TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ksic_codes' AND column_name = 'sub_name') THEN
        ALTER TABLE public.ksic_codes ADD COLUMN sub_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ksic_codes' AND column_name = 'detail_code') THEN
        ALTER TABLE public.ksic_codes ADD COLUMN detail_code TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ksic_codes' AND column_name = 'detail_name') THEN
        ALTER TABLE public.ksic_codes ADD COLUMN detail_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ksic_codes' AND column_name = 'description') THEN
        ALTER TABLE public.ksic_codes ADD COLUMN description TEXT;
    END IF;
END $$;

-- 4. Populate major_code from ksic_code
UPDATE public.ksic_codes
SET major_code = SUBSTRING(ksic_code, 1, 2)
WHERE major_code IS NULL
AND ksic_code IS NOT NULL
AND LENGTH(ksic_code) >= 2;

-- 5. Create indexes
DROP INDEX IF EXISTS idx_ksic_codes_major;
DROP INDEX IF EXISTS idx_ksic_codes_top_industry;
DROP INDEX IF EXISTS idx_ksic_codes_name;

CREATE INDEX idx_ksic_codes_major ON public.ksic_codes(major_code);
CREATE INDEX idx_ksic_codes_top_industry ON public.ksic_codes(top_industry);
CREATE INDEX idx_ksic_codes_name ON public.ksic_codes(ksic_name);

-- 6. Verify the fix
SELECT
    'VERIFICATION' as status,
    COUNT(*) as total_records,
    COUNT(major_code) as records_with_major_code,
    COUNT(DISTINCT major_code) as unique_major_codes
FROM ksic_codes;

-- Check if columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ksic_codes'
AND column_name IN ('ksic_code', 'ksic_name', 'major_code', 'top_industry')
ORDER BY column_name;

-- Check if indexes exist
SELECT indexname
FROM pg_indexes
WHERE tablename = 'ksic_codes'
AND indexname LIKE 'idx_ksic%'
ORDER BY indexname;

-- Done!
SELECT '✓ Fix completed! Check the results above.' as message;
