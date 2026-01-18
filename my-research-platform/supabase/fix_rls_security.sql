-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Security Advisor RLS 경고 수정
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- 일반적인 RLS 보안 이슈:
-- 1. 테이블에 RLS가 활성화되지 않음
-- 2. RLS 정책이 너무 광범위함 (모든 사용자 접근 허용)
-- 3. Service role 정책 누락
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 1. 모든 주요 테이블에 RLS 활성화
ALTER TABLE disclosure_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE disclosure_hashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_hashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE hot_stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- 2. Companies 테이블 RLS (KRX Market Data Sync 관련)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- 3. Market Indices 테이블 RLS (있다면)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'market_indices') THEN
    EXECUTE 'ALTER TABLE market_indices ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- disclosure_insights RLS 정책 (데이터 보안 강화)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Authenticated users can view all disclosures" ON disclosure_insights;
DROP POLICY IF EXISTS "Service role can manage disclosures" ON disclosure_insights;
DROP POLICY IF EXISTS "Public read access to sample disclosures" ON disclosure_insights;

-- 새 정책: 로그인한 사용자는 모든 공시 읽기 가능
CREATE POLICY "Authenticated users can view disclosures"
ON disclosure_insights FOR SELECT
TO authenticated
USING (true);

-- 새 정책: 익명 사용자는 샘플 공시만 읽기 가능
CREATE POLICY "Anonymous users can view sample disclosures"
ON disclosure_insights FOR SELECT
TO anon
USING (is_sample_disclosure = true);

-- 새 정책: Service role은 모든 작업 가능
CREATE POLICY "Service role full access"
ON disclosure_insights FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- companies 테이블 RLS 정책
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DROP POLICY IF EXISTS "Anyone can view companies" ON companies;
DROP POLICY IF EXISTS "Service role can manage companies" ON companies;

-- 모든 사용자(익명 포함) 읽기 가능
CREATE POLICY "Public read access to companies"
ON companies FOR SELECT
TO anon, authenticated
USING (true);

-- Service role은 모든 작업 가능
CREATE POLICY "Service role manages companies"
ON companies FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- market_indices 테이블 RLS 정책
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE tablename = 'market_indices') THEN
    -- 기존 정책 삭제
    EXECUTE 'DROP POLICY IF EXISTS "Anyone can view market indices" ON market_indices';
    EXECUTE 'DROP POLICY IF EXISTS "Service role can manage market indices" ON market_indices';

    -- 새 정책 생성
    EXECUTE 'CREATE POLICY "Public read access to market indices"
    ON market_indices FOR SELECT
    TO anon, authenticated
    USING (true)';

    EXECUTE 'CREATE POLICY "Service role manages market indices"
    ON market_indices FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true)';
  END IF;
END $$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Hash 테이블 RLS 정책 (Service role 전용)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DROP POLICY IF EXISTS "Service role manages disclosure hashes" ON disclosure_hashes;
DROP POLICY IF EXISTS "Service role manages bundle hashes" ON bundle_hashes;

CREATE POLICY "Service role manages disclosure hashes"
ON disclosure_hashes FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role manages bundle hashes"
ON bundle_hashes FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Hot Stocks 테이블 RLS 정책
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DROP POLICY IF EXISTS "Authenticated users can view hot stocks" ON hot_stocks;
DROP POLICY IF EXISTS "Service role manages hot stocks" ON hot_stocks;

-- 로그인 사용자만 hot stocks 조회 가능
CREATE POLICY "Authenticated users view hot stocks"
ON hot_stocks FOR SELECT
TO authenticated
USING (is_active = true);

-- Service role은 모든 작업 가능
CREATE POLICY "Service role manages hot stocks"
ON hot_stocks FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Profiles 테이블 RLS 정책 (이미 있지만 재확인)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Service role manages profiles" ON profiles;

CREATE POLICY "Users view own profile"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role manages profiles"
ON profiles FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Subscriptions 테이블 RLS 정책 (이미 있지만 재확인)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
DROP POLICY IF EXISTS "Service role manages subscriptions" ON subscriptions;

CREATE POLICY "Users view own subscription"
ON subscriptions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role manages subscriptions"
ON subscriptions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 완료! 확인
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 모든 테이블의 RLS 상태 확인
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  (SELECT COUNT(*)
   FROM pg_policies
   WHERE schemaname = t.schemaname
     AND tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename IN (
    'disclosure_insights',
    'disclosure_hashes',
    'bundle_hashes',
    'hot_stocks',
    'companies',
    'market_indices',
    'profiles',
    'subscriptions'
  )
ORDER BY tablename;

-- 각 테이블의 정책 상세 확인
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

SELECT '✅ RLS 보안 설정 완료!' as status;
