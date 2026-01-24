-- =====================================================
-- Companies 테이블 상세 진단 스크립트
-- =====================================================
--
-- 목적: 현재 companies 테이블의 모든 정보를 한눈에 확인
-- 사용: fix_companies_table.sql 실행 전에 먼저 실행
--
-- 주의: 아래 쿼리들을 하나씩 실행하세요!
--       전체 실행하면 마지막 결과만 보입니다.
-- =====================================================

-- ============================================
-- 📊 1. 테이블 존재 여부 및 기본 정보
-- ============================================
SELECT
  '1. 테이블 존재 여부' AS check_type,
  CASE
    WHEN EXISTS (SELECT FROM pg_tables WHERE tablename = 'companies')
    THEN '✅ 존재함'
    ELSE '❌ 없음'
  END AS result,
  (SELECT COUNT(*) FROM companies)::TEXT AS total_records,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'companies')::TEXT AS policy_count;

-- ============================================
-- 📋 2. 현재 컬럼 목록 (전체)
-- ============================================
SELECT
  '2. 컬럼 목록' AS info,
  column_name,
  data_type,
  CASE WHEN is_nullable = 'YES' THEN 'NULL 허용' ELSE 'NOT NULL' END AS nullable,
  COALESCE(column_default, '-') AS default_value
FROM information_schema.columns
WHERE table_name = 'companies'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ============================================
-- ✅ 3. 필요한 컬럼 체크리스트
-- ============================================
SELECT
  '3. 필수 컬럼 체크' AS info,
  '✅ code' AS column_name,
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='code')
       THEN '✅ 있음' ELSE '❌ 없음' END AS status
UNION ALL
SELECT '3. 필수 컬럼 체크', '✅ stock_code',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='stock_code')
       THEN '✅ 있음' ELSE '❌ 없음 (추가 필요)' END
UNION ALL
SELECT '3. 필수 컬럼 체크', '✅ corp_name',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='corp_name')
       THEN '✅ 있음' ELSE '❌ 없음 (추가 필요)' END
UNION ALL
SELECT '3. 필수 컬럼 체크', '📌 name_kr (선택)',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='name_kr')
       THEN '✅ 있음 (corp_name으로 복사 가능)' ELSE '⚪ 없음 (괜찮음)' END
UNION ALL
SELECT '3. 필수 컬럼 체크', '✅ market',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='market')
       THEN '✅ 있음' ELSE '❌ 없음' END
UNION ALL
SELECT '3. 필수 컬럼 체크', '✅ sector',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='sector')
       THEN '✅ 있음' ELSE '❌ 없음' END
UNION ALL
SELECT '3. 필수 컬럼 체크', '✅ market_cap',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='market_cap')
       THEN '✅ 있음' ELSE '❌ 없음 (추가 필요)' END
UNION ALL
SELECT '3. 필수 컬럼 체크', '✅ listed_shares',
  CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='listed_shares')
       THEN '✅ 있음' ELSE '❌ 없음 (추가 필요)' END;

-- ============================================
-- 🔒 4. RLS 정책 목록
-- ============================================
SELECT
  '4. RLS 정책' AS info,
  policyname AS policy_name,
  cmd::TEXT AS command,
  CASE
    WHEN 'anon' = ANY(roles::TEXT[]) THEN '익명 포함'
    ELSE '인증만'
  END AS access_level
FROM pg_policies
WHERE tablename = 'companies'
  AND schemaname = 'public';

-- ============================================
-- 📇 5. 인덱스 목록
-- ============================================
SELECT
  '5. 인덱스' AS info,
  indexname AS index_name,
  indexdef AS definition
FROM pg_indexes
WHERE tablename = 'companies'
  AND schemaname = 'public';

-- ============================================
-- 📊 6. 데이터 샘플 (처음 3개만)
-- ============================================
SELECT
  '6. 데이터 샘플' AS info,
  *
FROM companies
LIMIT 3;

-- ============================================
-- 🎯 7. 진단 요약
-- ============================================
SELECT
  '==============================================' AS separator,
  '🎯 진단 요약' AS title,
  '==============================================' AS separator2
UNION ALL
SELECT
  '총 레코드 수' AS item,
  COUNT(*)::TEXT AS value,
  '' AS empty
FROM companies
UNION ALL
SELECT
  'RLS 활성화',
  CASE WHEN rowsecurity THEN '✅ 활성화됨' ELSE '❌ 비활성화됨' END,
  ''
FROM pg_tables
WHERE tablename = 'companies'
UNION ALL
SELECT
  'RLS 정책 수',
  COUNT(*)::TEXT || '개',
  ''
FROM pg_policies
WHERE tablename = 'companies'
UNION ALL
SELECT
  '필수 컬럼 누락 개수',
  (
    8 -
    (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='code') THEN 1 ELSE 0 END) -
    (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='stock_code') THEN 1 ELSE 0 END) -
    (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='corp_name') THEN 1 ELSE 0 END) -
    (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='market') THEN 1 ELSE 0 END) -
    (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='sector') THEN 1 ELSE 0 END) -
    (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='market_cap') THEN 1 ELSE 0 END) -
    (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='listed_shares') THEN 1 ELSE 0 END) -
    (CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='updated_at') THEN 1 ELSE 0 END)
  )::TEXT || '개',
  ''
UNION ALL
SELECT
  '다음 단계',
  CASE
    WHEN NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'companies')
    THEN '❌ 테이블 생성 필요'
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'companies' AND policyname LIKE '%Public read access%') > 1
    THEN '⚠️ 중복 정책 있음 - fix_companies_table.sql 실행'
    WHEN NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='stock_code')
    THEN '⚠️ 컬럼 추가 필요 - fix_companies_table.sql 실행'
    ELSE '✅ fix_companies_table.sql 실행 가능'
  END,
  '';

-- ============================================
-- 완료 메시지
-- ============================================
SELECT '✅ Companies 테이블 진단 완료!' AS status,
       '위의 결과를 확인하고 fix_companies_table.sql을 실행하세요.' AS next_step;
