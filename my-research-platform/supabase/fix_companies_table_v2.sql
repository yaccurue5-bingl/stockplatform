-- =====================================================
-- Companies 테이블 수정 (기존 데이터 보존)
-- =====================================================
--
-- 현재 상태:
-- - 5684개 레코드 존재
-- - stock_code (PRIMARY KEY), corp_name 등 대부분 컬럼 있음
-- - market_type은 있지만 market이 없음
-- - code 컬럼이 없음
--
-- 목표:
-- 1. 중복 RLS 정책 정리
-- 2. code 컬럼 추가 (stock_code 복사)
-- 3. market 컬럼 추가 (market_type 복사)
-- =====================================================

-- 1. 모든 기존 RLS 정책 삭제 (중복 제거)
DROP POLICY IF EXISTS "Public read access" ON companies;
DROP POLICY IF EXISTS "Public read access for companies" ON companies;
DROP POLICY IF EXISTS "Public read access to companies" ON companies;
DROP POLICY IF EXISTS "Service role manages companies" ON companies;
DROP POLICY IF EXISTS "companies_public_read" ON companies;
DROP POLICY IF EXISTS "companies_service_role_all" ON companies;
DROP POLICY IF EXISTS "Authenticated users can view companies" ON companies;
DROP POLICY IF EXISTS "Anyone can view companies" ON companies;

-- 2. code 컬럼 추가 (없으면)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='companies' AND column_name='code') THEN
    ALTER TABLE companies ADD COLUMN code TEXT;
    -- stock_code 값을 code로 복사
    UPDATE companies SET code = stock_code WHERE code IS NULL;
    -- NOT NULL 제약 추가
    ALTER TABLE companies ALTER COLUMN code SET NOT NULL;
    -- 인덱스 추가
    CREATE INDEX IF NOT EXISTS idx_companies_code ON companies(code);
  END IF;
END $$;

-- 3. market 컬럼 추가 (없으면)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='companies' AND column_name='market') THEN
    ALTER TABLE companies ADD COLUMN market TEXT;
    -- market_type 값을 market으로 복사
    UPDATE companies SET market = market_type WHERE market IS NULL;
    -- 인덱스 추가
    CREATE INDEX IF NOT EXISTS idx_companies_market ON companies(market);
  END IF;
END $$;

-- 4. RLS 활성화 (이미 활성화되어 있지만 확인)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- 5. 새로운 RLS 정책 생성 (중복 없이 깔끔하게)
-- Policy 1: 모든 사용자(익명 포함) 읽기 가능
CREATE POLICY "companies_select_public"
ON companies FOR SELECT
TO anon, authenticated
USING (true);

-- Policy 2: Service role은 모든 작업 가능
CREATE POLICY "companies_all_service_role"
ON companies FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 6. 확인 쿼리
SELECT
  '✅ 정책 정리 완료' AS status,
  COUNT(*) || '개의 정책 생성됨' AS policy_count
FROM pg_policies
WHERE tablename = 'companies';

SELECT
  '✅ 컬럼 확인' AS status,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'companies'
  AND column_name IN ('code', 'stock_code', 'market', 'market_type', 'corp_name')
ORDER BY column_name;

SELECT '✅ Companies 테이블 수정 완료!' AS final_status;
