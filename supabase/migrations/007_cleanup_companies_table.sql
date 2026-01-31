-- =========================================
-- Companies 테이블 정리
-- =========================================
-- Migration: 007_cleanup_companies_table.sql
-- Description: 중복 행 삭제, 불필요한 컬럼 제거, sector 초기화

-- =========================================
-- 1. 중복 행 삭제 (A가 붙은 코드 우선 삭제)
-- =========================================

-- 전략: code 컬럼에서 숫자만 추출하여 중복 찾기
-- 같은 숫자 코드에 대해 'A'가 붙은 것이 있으면 'A'가 붙은 것을 삭제

-- 1.1. 임시 테이블로 삭제할 행 식별
CREATE TEMP TABLE codes_to_delete AS
SELECT c1.code
FROM public.companies c1
WHERE c1.code LIKE 'A%'  -- 'A'로 시작하는 코드
  AND EXISTS (
    -- 'A'를 제거한 코드가 이미 존재하는 경우
    SELECT 1
    FROM public.companies c2
    WHERE c2.code = SUBSTRING(c1.code FROM 2)  -- 'A' 제거한 코드
  );

-- 1.2. 삭제 실행 전 확인 (로그 출력)
DO $$
DECLARE
  delete_count INTEGER;
  rec RECORD;
BEGIN
  SELECT COUNT(*) INTO delete_count FROM codes_to_delete;
  RAISE NOTICE '삭제할 중복 행 수: %', delete_count;

  IF delete_count > 0 THEN
    RAISE NOTICE '삭제할 코드 목록:';
    FOR rec IN SELECT code FROM codes_to_delete ORDER BY code LOOP
      RAISE NOTICE '  - %', rec.code;
    END LOOP;
  END IF;
END $$;

-- 1.3. 중복 행 삭제
DELETE FROM public.companies
WHERE code IN (SELECT code FROM codes_to_delete);

-- =========================================
-- 2. 불필요한 컬럼 삭제
-- =========================================

-- 2.1. industry_category 컬럼 삭제
ALTER TABLE public.companies
DROP COLUMN IF EXISTS industry_category CASCADE;

-- 2.2. corp_code 컬럼 삭제
ALTER TABLE public.companies
DROP COLUMN IF EXISTS corp_code CASCADE;

-- 2.3. ksic_name 컬럼 삭제
ALTER TABLE public.companies
DROP COLUMN IF EXISTS ksic_name CASCADE;

-- 2.4. ksic_updated_at 컬럼도 삭제 (ksic_code는 유지)
ALTER TABLE public.companies
DROP COLUMN IF EXISTS ksic_updated_at CASCADE;

-- =========================================
-- 3. sector 컬럼 초기화
-- =========================================

-- 3.1. sector 컬럼을 NULL로 초기화
UPDATE public.companies
SET sector = NULL;

-- 3.2. sector 컬럼 타입 확인 (이미 TEXT이지만 명시적으로 설정)
ALTER TABLE public.companies
ALTER COLUMN sector TYPE TEXT;

-- =========================================
-- 4. 관련 인덱스 정리
-- =========================================

-- 삭제된 컬럼의 인덱스는 CASCADE로 자동 삭제됨
-- 필요한 인덱스만 유지되는지 확인

DROP INDEX IF EXISTS idx_companies_industry_category;
DROP INDEX IF EXISTS idx_companies_corp_code;

-- =========================================
-- 5. 통계 뷰 업데이트
-- =========================================

-- industry_category를 사용하는 뷰 삭제
DROP VIEW IF EXISTS public.industry_statistics;

-- =========================================
-- 완료 및 결과 확인
-- =========================================

DO $$
DECLARE
  total_companies INTEGER;
  columns_list TEXT;
BEGIN
  -- 전체 기업 수 확인
  SELECT COUNT(*) INTO total_companies FROM public.companies;

  -- 현재 컬럼 목록 확인
  SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
  INTO columns_list
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'companies';

  RAISE NOTICE '✓ Companies 테이블 정리 완료';
  RAISE NOTICE '  - 중복 행 삭제 완료';
  RAISE NOTICE '  - 불필요한 컬럼 삭제: industry_category, corp_code, ksic_name, ksic_updated_at';
  RAISE NOTICE '  - sector 컬럼 NULL로 초기화 완료';
  RAISE NOTICE '  - 전체 기업 수: %', total_companies;
  RAISE NOTICE '  - 현재 컬럼: %', columns_list;
END $$;
