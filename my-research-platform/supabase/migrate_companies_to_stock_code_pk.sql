-- =====================================================
-- Companies 테이블 PK 변경: code -> stock_code
-- =====================================================
--
-- 목표:
-- 1. stock_code를 PRIMARY KEY로 설정 (Unique, Not Null)
-- 2. code 컬럼의 NOT NULL 제약 해제 (또는 제거)
-- 3. 기존 데이터 보존
-- 4. 변수명 통일: industry -> sector
-- =====================================================

-- 1. 기존 RLS 정책 모두 삭제 (깔끔하게 재생성)
DROP POLICY IF EXISTS "Public read access" ON companies;
DROP POLICY IF EXISTS "Public read access for companies" ON companies;
DROP POLICY IF EXISTS "Public read access to companies" ON companies;
DROP POLICY IF EXISTS "Service role manages companies" ON companies;
DROP POLICY IF EXISTS "companies_public_read" ON companies;
DROP POLICY IF EXISTS "companies_service_role_all" ON companies;
DROP POLICY IF EXISTS "companies_select_public" ON companies;
DROP POLICY IF EXISTS "companies_all_service_role" ON companies;
DROP POLICY IF EXISTS "Authenticated users can view companies" ON companies;
DROP POLICY IF EXISTS "Anyone can view companies" ON companies;

-- 2. 기존 PRIMARY KEY 제약 제거 (code가 PK인 경우)
DO $$
BEGIN
  -- companies 테이블의 PK constraint 이름 찾아서 제거
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'companies'
    AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_pkey CASCADE;
    RAISE NOTICE '✅ 기존 PRIMARY KEY 제약 제거 완료';
  END IF;
END $$;

-- 3. stock_code 컬럼 설정 (없으면 추가, 있으면 업데이트)
DO $$
BEGIN
  -- stock_code 컬럼이 없으면 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'stock_code'
  ) THEN
    ALTER TABLE companies ADD COLUMN stock_code TEXT;
    RAISE NOTICE '✅ stock_code 컬럼 추가 완료';

    -- code 컬럼이 있으면 값을 복사
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'companies' AND column_name = 'code'
    ) THEN
      UPDATE companies SET stock_code = code WHERE stock_code IS NULL;
      RAISE NOTICE '✅ code 값을 stock_code로 복사 완료';
    END IF;
  END IF;

  -- stock_code가 NULL인 레코드 제거 (PK로 설정하기 전에 필수)
  DELETE FROM companies WHERE stock_code IS NULL OR stock_code = '';
  RAISE NOTICE '✅ stock_code가 NULL인 레코드 제거 완료';

  -- stock_code를 NOT NULL로 설정
  ALTER TABLE companies ALTER COLUMN stock_code SET NOT NULL;
  RAISE NOTICE '✅ stock_code NOT NULL 제약 설정 완료';
END $$;

-- 4. stock_code를 PRIMARY KEY로 설정
ALTER TABLE companies ADD CONSTRAINT companies_pkey PRIMARY KEY (stock_code);

-- 5. code 컬럼 NOT NULL 제약 해제 (있는 경우)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'code'
  ) THEN
    ALTER TABLE companies ALTER COLUMN code DROP NOT NULL;
    RAISE NOTICE '✅ code 컬럼 NOT NULL 제약 해제 완료';
  END IF;
END $$;

-- 6. sector 컬럼 확인 및 추가 (industry가 아닌 sector 사용)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'sector'
  ) THEN
    ALTER TABLE companies ADD COLUMN sector TEXT DEFAULT '기타';
    RAISE NOTICE '✅ sector 컬럼 추가 완료';
  END IF;
END $$;

-- 7. 필수 컬럼 확인 및 추가
DO $$
BEGIN
  -- corp_name 컬럼
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'corp_name'
  ) THEN
    ALTER TABLE companies ADD COLUMN corp_name TEXT;
    RAISE NOTICE '✅ corp_name 컬럼 추가 완료';
  END IF;

  -- market 컬럼
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'market'
  ) THEN
    ALTER TABLE companies ADD COLUMN market TEXT;
    RAISE NOTICE '✅ market 컬럼 추가 완료';
  END IF;

  -- market_cap 컬럼
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'market_cap'
  ) THEN
    ALTER TABLE companies ADD COLUMN market_cap BIGINT DEFAULT 0;
    RAISE NOTICE '✅ market_cap 컬럼 추가 완료';
  END IF;

  -- listed_shares 컬럼
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'listed_shares'
  ) THEN
    ALTER TABLE companies ADD COLUMN listed_shares BIGINT DEFAULT 0;
    RAISE NOTICE '✅ listed_shares 컬럼 추가 완료';
  END IF;

  -- updated_at 컬럼
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE companies ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    RAISE NOTICE '✅ updated_at 컬럼 추가 완료';
  END IF;
END $$;

-- 8. 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_companies_stock_code ON companies(stock_code);
CREATE INDEX IF NOT EXISTS idx_companies_corp_name ON companies(corp_name);
CREATE INDEX IF NOT EXISTS idx_companies_market ON companies(market);
CREATE INDEX IF NOT EXISTS idx_companies_sector ON companies(sector);

-- 9. RLS 활성화
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- 10. 새로운 RLS 정책 생성
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

-- 11. 확인 쿼리
SELECT
  '✅ PK 변경 완료' AS status,
  'stock_code가 PRIMARY KEY로 설정됨' AS details;

SELECT
  '✅ 컬럼 확인' AS status,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'companies'
  AND column_name IN ('stock_code', 'code', 'corp_name', 'market', 'sector', 'market_cap', 'listed_shares', 'updated_at')
ORDER BY column_name;

SELECT
  '✅ PRIMARY KEY 확인' AS status,
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'companies'
  AND constraint_type = 'PRIMARY KEY';

SELECT
  '✅ RLS 정책 확인' AS status,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'companies'
ORDER BY policyname;

SELECT '✅ Companies 테이블 마이그레이션 완료!' AS final_status;
