-- =====================================================
-- Companies 테이블 진단 스크립트
-- =====================================================
--
-- 목적: 현재 companies 테이블의 상태를 확인
-- 사용: fix_companies_table.sql 실행 전에 먼저 실행
--
-- =====================================================

-- 1. Companies 테이블이 존재하는지 확인
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'companies'
) AS table_exists;

-- 2. 현재 컬럼 목록 확인
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'companies'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. 현재 RLS 정책 확인
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'companies'
  AND schemaname = 'public';

-- 4. 현재 인덱스 확인
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'companies'
  AND schemaname = 'public';

-- 5. 테이블 데이터 샘플 확인 (처음 5개)
SELECT * FROM companies LIMIT 5;

-- 6. 총 레코드 수
SELECT COUNT(*) AS total_records FROM companies;

-- 7. 필요한 컬럼이 있는지 체크
SELECT
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='code') AS has_code,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='stock_code') AS has_stock_code,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='corp_name') AS has_corp_name,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='name_kr') AS has_name_kr,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='name_en') AS has_name_en,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='market') AS has_market,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='sector') AS has_sector,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='market_cap') AS has_market_cap,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='listed_shares') AS has_listed_shares;

-- 8. RLS가 활성화되어 있는지 확인
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'companies';

SELECT '✅ Companies 테이블 진단 완료!' AS status;
