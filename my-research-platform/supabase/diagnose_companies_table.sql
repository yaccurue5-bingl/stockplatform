-- =====================================================
-- Companies 테이블 통합 진단 스크립트
-- =====================================================
-- 한 번 실행으로 모든 정보를 확인할 수 있습니다
-- =====================================================

WITH table_info AS (
  -- 테이블 기본 정보
  SELECT
    EXISTS (SELECT FROM pg_tables WHERE tablename = 'companies') AS table_exists,
    COALESCE((SELECT COUNT(*) FROM companies), 0) AS total_records,
    COALESCE((SELECT COUNT(*) FROM pg_policies WHERE tablename = 'companies'), 0) AS policy_count,
    COALESCE((SELECT rowsecurity FROM pg_tables WHERE tablename = 'companies'), false) AS rls_enabled
),
column_check AS (
  -- 필수 컬럼 존재 여부
  SELECT
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='code') AS has_code,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='stock_code') AS has_stock_code,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='corp_name') AS has_corp_name,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='name_kr') AS has_name_kr,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='market') AS has_market,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='sector') AS has_sector,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='market_cap') AS has_market_cap,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='listed_shares') AS has_listed_shares,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='updated_at') AS has_updated_at
)
SELECT
  '========================================' AS section,
  '🎯 COMPANIES 테이블 진단 결과' AS title,
  '========================================' AS end_section

UNION ALL
SELECT '', '', ''

UNION ALL
SELECT '📊 기본 정보', '', ''
UNION ALL
SELECT
  '  • 테이블 존재',
  CASE WHEN table_exists THEN '✅ 예' ELSE '❌ 아니오' END,
  ''
FROM table_info

UNION ALL
SELECT
  '  • 총 레코드 수',
  total_records::TEXT || '개',
  ''
FROM table_info

UNION ALL
SELECT
  '  • RLS 활성화',
  CASE WHEN rls_enabled THEN '✅ 활성화됨' ELSE '❌ 비활성화됨' END,
  ''
FROM table_info

UNION ALL
SELECT
  '  • RLS 정책 수',
  policy_count::TEXT || '개',
  ''
FROM table_info

UNION ALL
SELECT '', '', ''

UNION ALL
SELECT '✅ 필수 컬럼 체크', '', ''
UNION ALL
SELECT
  '  • code',
  CASE WHEN has_code THEN '✅ 있음' ELSE '❌ 없음 [필수]' END,
  ''
FROM column_check

UNION ALL
SELECT
  '  • stock_code',
  CASE WHEN has_stock_code THEN '✅ 있음' ELSE '❌ 없음 [추가 필요]' END,
  ''
FROM column_check

UNION ALL
SELECT
  '  • corp_name',
  CASE WHEN has_corp_name THEN '✅ 있음' ELSE '❌ 없음 [추가 필요]' END,
  ''
FROM column_check

UNION ALL
SELECT
  '  • name_kr (선택)',
  CASE WHEN has_name_kr THEN '✅ 있음 (corp_name으로 복사 가능)' ELSE '⚪ 없음 (괜찮음)' END,
  ''
FROM column_check

UNION ALL
SELECT
  '  • market',
  CASE WHEN has_market THEN '✅ 있음' ELSE '❌ 없음 [필수]' END,
  ''
FROM column_check

UNION ALL
SELECT
  '  • sector',
  CASE WHEN has_sector THEN '✅ 있음' ELSE '❌ 없음 [필수]' END,
  ''
FROM column_check

UNION ALL
SELECT
  '  • market_cap',
  CASE WHEN has_market_cap THEN '✅ 있음' ELSE '❌ 없음 [추가 필요]' END,
  ''
FROM column_check

UNION ALL
SELECT
  '  • listed_shares',
  CASE WHEN has_listed_shares THEN '✅ 있음' ELSE '❌ 없음 [추가 필요]' END,
  ''
FROM column_check

UNION ALL
SELECT
  '  • updated_at',
  CASE WHEN has_updated_at THEN '✅ 있음' ELSE '⚪ 없음 (선택)' END,
  ''
FROM column_check

UNION ALL
SELECT '', '', ''

UNION ALL
SELECT '🔒 RLS 정책 목록', '', ''
UNION ALL
SELECT
  '  • ' || policyname,
  cmd::TEXT,
  CASE WHEN 'anon' = ANY(roles::TEXT[]) THEN '익명 포함' ELSE '인증만' END
FROM pg_policies
WHERE tablename = 'companies' AND schemaname = 'public'

UNION ALL
SELECT '', '', ''

UNION ALL
SELECT '📇 인덱스 목록', '', ''
UNION ALL
SELECT
  '  • ' || indexname,
  LEFT(indexdef, 60) || '...',
  ''
FROM pg_indexes
WHERE tablename = 'companies' AND schemaname = 'public'

UNION ALL
SELECT '', '', ''

UNION ALL
SELECT '📋 현재 컬럼 목록', '', ''
UNION ALL
SELECT
  '  • ' || column_name,
  data_type,
  CASE WHEN is_nullable = 'YES' THEN 'NULL 허용' ELSE 'NOT NULL' END
FROM information_schema.columns
WHERE table_name = 'companies' AND table_schema = 'public'
ORDER BY ordinal_position

UNION ALL
SELECT '', '', ''

UNION ALL
SELECT '========================================', '', ''
UNION ALL
SELECT '🎯 진단 요약', '', ''
UNION ALL
SELECT '========================================', '', ''

UNION ALL
SELECT '', '', ''

UNION ALL
SELECT
  '필수 컬럼 누락 개수',
  (
    8 -
    (CASE WHEN has_code THEN 1 ELSE 0 END) -
    (CASE WHEN has_stock_code THEN 1 ELSE 0 END) -
    (CASE WHEN has_corp_name THEN 1 ELSE 0 END) -
    (CASE WHEN has_market THEN 1 ELSE 0 END) -
    (CASE WHEN has_sector THEN 1 ELSE 0 END) -
    (CASE WHEN has_market_cap THEN 1 ELSE 0 END) -
    (CASE WHEN has_listed_shares THEN 1 ELSE 0 END) -
    (CASE WHEN has_updated_at THEN 1 ELSE 0 END)
  )::TEXT || '개',
  ''
FROM column_check

UNION ALL
SELECT '', '', ''

UNION ALL
SELECT
  '📌 다음 단계',
  CASE
    WHEN NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'companies')
    THEN '❌ 테이블이 없습니다. 테이블을 먼저 생성하세요.'

    WHEN (SELECT COUNT(*) FROM pg_policies
          WHERE tablename = 'companies'
          AND policyname LIKE '%Public read access%') > 1
    THEN '⚠️ 중복된 RLS 정책이 있습니다. fix_companies_table.sql을 실행하세요.'

    WHEN NOT has_stock_code OR NOT has_corp_name OR NOT has_market_cap OR NOT has_listed_shares
    THEN '⚠️ 필수 컬럼이 누락되었습니다. fix_companies_table.sql을 실행하세요.'

    ELSE '✅ 스키마가 정상입니다. Python 스크립트를 실행할 수 있습니다.'
  END,
  ''
FROM table_info, column_check

UNION ALL
SELECT '', '', ''

UNION ALL
SELECT
  '🚀 실행할 명령',
  CASE
    WHEN NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'companies')
    THEN '1. 테이블 생성 SQL 실행'

    WHEN NOT has_stock_code OR NOT has_corp_name OR NOT has_market_cap OR NOT has_listed_shares
    THEN '1. fix_companies_table.sql 실행' || E'\n' ||
         '2. python scripts/fetch_krx_from_datagokr.py'

    ELSE 'python scripts/fetch_krx_from_datagokr.py'
  END,
  ''
FROM table_info, column_check;
