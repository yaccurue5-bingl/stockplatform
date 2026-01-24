-- =====================================================
-- Companies 테이블 스키마 업데이트 및 RLS 수정
-- =====================================================
--
-- 목적:
-- 1. companies 테이블 스키마를 data.go.kr API에 맞게 업데이트
-- 2. 기존 RLS policy 충돌 해결
-- 3. Python 스크립트(fetch_krx_from_datagokr.py)와 호환
--
-- =====================================================

-- 1. 기존 정책 모두 삭제 (충돌 방지)
DROP POLICY IF EXISTS "Public read access to companies" ON companies;
DROP POLICY IF EXISTS "Public read access for companies" ON companies;
DROP POLICY IF EXISTS "Anyone can view companies" ON companies;
DROP POLICY IF EXISTS "Authenticated users can view companies" ON companies;
DROP POLICY IF EXISTS "Service role can manage companies" ON companies;
DROP POLICY IF EXISTS "Service role manages companies" ON companies;

-- 2. Companies 테이블 스키마 업데이트
-- 기존 컬럼: code, name_kr, name_en, market, sector, updated_at
-- 필요 컬럼: code, stock_code, corp_name, market, sector, market_cap, listed_shares, updated_at

-- stock_code 컬럼 추가 (없으면)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='companies' AND column_name='stock_code') THEN
    ALTER TABLE companies ADD COLUMN stock_code TEXT;
  END IF;
END $$;

-- corp_name 컬럼 추가 (없으면)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='companies' AND column_name='corp_name') THEN
    ALTER TABLE companies ADD COLUMN corp_name TEXT;
  END IF;
END $$;

-- market_cap 컬럼 추가 (없으면)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='companies' AND column_name='market_cap') THEN
    ALTER TABLE companies ADD COLUMN market_cap BIGINT DEFAULT 0;
  END IF;
END $$;

-- listed_shares 컬럼 추가 (없으면)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='companies' AND column_name='listed_shares') THEN
    ALTER TABLE companies ADD COLUMN listed_shares BIGINT DEFAULT 0;
  END IF;
END $$;

-- 3. 기존 데이터 마이그레이션 (name_kr -> corp_name)
-- corp_name이 비어있고 name_kr에 값이 있으면 복사
UPDATE companies
SET corp_name = name_kr
WHERE corp_name IS NULL AND name_kr IS NOT NULL;

-- stock_code가 비어있으면 code 복사
UPDATE companies
SET stock_code = code
WHERE stock_code IS NULL;

-- 4. RLS 활성화
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- 5. 새로운 정책 생성
-- Policy 1: 모든 사용자(익명 포함) 읽기 가능
CREATE POLICY "companies_public_read"
ON companies FOR SELECT
TO anon, authenticated
USING (true);

-- Policy 2: Service role은 모든 작업 가능
CREATE POLICY "companies_service_role_all"
ON companies FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 6. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_companies_code ON companies(code);
CREATE INDEX IF NOT EXISTS idx_companies_stock_code ON companies(stock_code);
CREATE INDEX IF NOT EXISTS idx_companies_corp_name ON companies(corp_name);
CREATE INDEX IF NOT EXISTS idx_companies_market ON companies(market);
CREATE INDEX IF NOT EXISTS idx_companies_sector ON companies(sector);

-- 7. 확인 쿼리
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'companies'
ORDER BY ordinal_position;

-- 정책 확인
SELECT
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'companies';

SELECT '✅ Companies 테이블 스키마 업데이트 및 RLS 수정 완료!' as status;
