-- =========================================
-- Companies 테이블 정리 (수정된 버전)
-- =========================================
-- 이 파일을 Supabase Dashboard SQL Editor에서 실행하세요

-- 1.1. 임시 테이블로 삭제할 행 식별
CREATE TEMP TABLE codes_to_delete AS
SELECT c1.code
FROM public.companies c1
WHERE c1.code LIKE 'A%'
  AND EXISTS (
    SELECT 1
    FROM public.companies c2
    WHERE c2.code = SUBSTRING(c1.code FROM 2)
  );

-- 1.2. 삭제 실행 전 확인 (로그 출력) ✅ 수정됨
DO $$
DECLARE
  delete_count INTEGER;
  rec RECORD;  -- ✅ RECORD 변수 추가
BEGIN
  SELECT COUNT(*) INTO delete_count FROM codes_to_delete;
  RAISE NOTICE '삭제할 중복 행 수: %', delete_count;

  IF delete_count > 0 THEN
    RAISE NOTICE '삭제할 코드 목록:';
    FOR rec IN SELECT code FROM codes_to_delete ORDER BY code LOOP  -- ✅ rec 사용
      RAISE NOTICE '  - %', rec.code;  -- ✅ rec.code 사용
    END LOOP;
  END IF;
END $$;

-- 1.3. 중복 행 삭제
DELETE FROM public.companies
WHERE code IN (SELECT code FROM codes_to_delete);

-- 2. 불필요한 컬럼 삭제
ALTER TABLE public.companies DROP COLUMN IF EXISTS industry_category CASCADE;
ALTER TABLE public.companies DROP COLUMN IF EXISTS corp_code CASCADE;
ALTER TABLE public.companies DROP COLUMN IF EXISTS ksic_name CASCADE;
ALTER TABLE public.companies DROP COLUMN IF EXISTS ksic_updated_at CASCADE;

-- 3. sector 컬럼 초기화
UPDATE public.companies SET sector = NULL;
ALTER TABLE public.companies ALTER COLUMN sector TYPE TEXT;

-- 4. 인덱스 정리
DROP INDEX IF EXISTS idx_companies_industry_category;
DROP INDEX IF EXISTS idx_companies_corp_code;

-- 5. 통계 뷰 삭제
DROP VIEW IF EXISTS public.industry_statistics;

-- 6. 결과 확인
DO $$
DECLARE
  total_companies INTEGER;
  columns_list TEXT;
BEGIN
  SELECT COUNT(*) INTO total_companies FROM public.companies;
  SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
  INTO columns_list
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'companies';

  RAISE NOTICE '✓ Companies 테이블 정리 완료';
  RAISE NOTICE '  - 중복 행 삭제 완료';
  RAISE NOTICE '  - 불필요한 컬럼 삭제: industry_category, corp_code, ksic_name, ksic_updated_at';
  RAISE NOTICE '  - sector 컬럼 NULL로 초기화 완료';
  RAISE NOTICE '  - 전체 기업 수: %', total_companies;
  RAISE NOTICE '  - 현재 컬럼: %', columns_list;
END $$;
