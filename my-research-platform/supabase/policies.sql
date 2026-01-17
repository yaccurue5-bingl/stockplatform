-- =====================================================
-- K-MarketInsight Security Policies
-- Supabase Row Level Security (RLS) Setup
-- =====================================================

-- 1. PROFILES TABLE
-- =====================================================
-- 사용자 프로필 테이블 (users 테이블과 1:1 매핑)

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles viewable by authenticated users" ON profiles;

-- Policy 1: 자신의 프로필 조회
CREATE POLICY "Users can view own profile"
ON profiles
FOR SELECT
USING (auth.uid() = id);

-- Policy 2: 자신의 프로필 업데이트
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 3: 인증된 사용자는 다른 사용자의 공개 프로필 조회 가능
CREATE POLICY "Public profiles viewable by authenticated users"
ON profiles
FOR SELECT
USING (
  auth.role() = 'authenticated'
  AND is_public = true
);

-- =====================================================
-- 2. SUBSCRIPTIONS TABLE
-- =====================================================
-- 구독 정보 (Paddle)

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Service role can manage all subscriptions" ON subscriptions;

-- Policy 1: 자신의 구독 정보만 조회
CREATE POLICY "Users can view own subscriptions"
ON subscriptions
FOR SELECT
USING (auth.uid() = user_id);

-- Policy 2: Service role만 insert/update 가능 (webhook용)
CREATE POLICY "Service role can manage all subscriptions"
ON subscriptions
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- 3. PAYMENTS TABLE
-- =====================================================
-- 결제 내역

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Service role can manage all payments" ON payments;

-- Policy 1: 자신의 결제 내역만 조회
CREATE POLICY "Users can view own payments"
ON payments
FOR SELECT
USING (auth.uid() = user_id);

-- Policy 2: Service role만 insert (webhook용)
CREATE POLICY "Service role can manage all payments"
ON payments
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- 4. DISCLOSURE_INSIGHTS TABLE
-- =====================================================
-- AI 분석된 공시 정보 (모든 인증 사용자가 조회 가능)

ALTER TABLE disclosure_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view all disclosures" ON disclosure_insights;
DROP POLICY IF EXISTS "Service role can manage disclosures" ON disclosure_insights;

-- Policy 1: 인증된 사용자는 모든 공시 조회 가능
CREATE POLICY "Authenticated users can view all disclosures"
ON disclosure_insights
FOR SELECT
USING (auth.role() = 'authenticated');

-- Policy 2: Service role만 insert/update (cron job용)
CREATE POLICY "Service role can manage disclosures"
ON disclosure_insights
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- 5. COMPANIES TABLE
-- =====================================================
-- 종목 정보 (공개 데이터)

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view companies" ON companies;
DROP POLICY IF EXISTS "Service role can manage companies" ON companies;

-- Policy 1: 누구나 종목 정보 조회 가능
CREATE POLICY "Anyone can view companies"
ON companies
FOR SELECT
USING (true);

-- Policy 2: Service role만 insert/update
CREATE POLICY "Service role can manage companies"
ON companies
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- 6. MARKET_INDICES TABLE
-- =====================================================
-- 시장 지수 (공개 데이터)

ALTER TABLE market_indices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view market indices" ON market_indices;
DROP POLICY IF EXISTS "Service role can manage market indices" ON market_indices;

-- Policy 1: 누구나 시장 지수 조회 가능
CREATE POLICY "Anyone can view market indices"
ON market_indices
FOR SELECT
USING (true);

-- Policy 2: Service role만 insert/update
CREATE POLICY "Service role can manage market indices"
ON market_indices
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- 7. SAVED_DISCLOSURES TABLE (Optional)
-- =====================================================
-- 사용자가 저장한 공시

ALTER TABLE saved_disclosures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own saved disclosures" ON saved_disclosures;
DROP POLICY IF EXISTS "Users can insert own saved disclosures" ON saved_disclosures;
DROP POLICY IF EXISTS "Users can delete own saved disclosures" ON saved_disclosures;

-- Policy 1: 자신이 저장한 공시만 조회
CREATE POLICY "Users can view own saved disclosures"
ON saved_disclosures
FOR SELECT
USING (auth.uid() = user_id);

-- Policy 2: 자신의 저장 공시 추가
CREATE POLICY "Users can insert own saved disclosures"
ON saved_disclosures
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy 3: 자신의 저장 공시 삭제
CREATE POLICY "Users can delete own saved disclosures"
ON saved_disclosures
FOR DELETE
USING (auth.uid() = user_id);

-- =====================================================
-- INDEXES (Performance Optimization)
-- =====================================================

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

-- Subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_paddle_id ON subscriptions(paddle_subscription_id);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_paddle_id ON payments(paddle_payment_id);

-- Disclosures
CREATE INDEX IF NOT EXISTS idx_disclosures_stock_code ON disclosure_insights(stock_code);
CREATE INDEX IF NOT EXISTS idx_disclosures_created_at ON disclosure_insights(created_at);
CREATE INDEX IF NOT EXISTS idx_disclosures_corp_name ON disclosure_insights(corp_name);
CREATE INDEX IF NOT EXISTS idx_disclosures_importance ON disclosure_insights(importance);

-- Companies
CREATE INDEX IF NOT EXISTS idx_companies_stock_code ON companies(stock_code);
CREATE INDEX IF NOT EXISTS idx_companies_corp_name ON companies(corp_name);

-- Market Indices
CREATE INDEX IF NOT EXISTS idx_market_indices_symbol ON market_indices(symbol);

-- =====================================================
-- FUNCTIONS (Auto-update timestamps)
-- =====================================================

-- Updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Profiles 트리거
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Subscriptions 트리거
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE profiles IS '사용자 프로필 정보';
COMMENT ON TABLE subscriptions IS 'Paddle 구독 정보';
COMMENT ON TABLE payments IS 'Paddle 결제 내역';
COMMENT ON TABLE disclosure_insights IS 'AI 분석된 공시 정보';
COMMENT ON TABLE companies IS 'KRX 종목 정보';
COMMENT ON TABLE market_indices IS '시장 지수 (KOSPI, KOSDAQ, USD/KRW)';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- RLS 활성화 확인
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'subscriptions', 'payments', 'disclosure_insights', 'companies', 'market_indices');

-- Policy 확인
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
