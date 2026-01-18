-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- K-MarketInsight Database Reset & Setup
-- ⚠️ 경고: 이 스크립트는 기존 테이블을 삭제합니다!
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- 사용법:
-- 1. Supabase Dashboard → SQL Editor
-- 2. 이 파일 전체 복사 → 붙여넣기
-- 3. "Run" 클릭
--
-- ⚠️ 주의사항:
-- - 기존 disclosure_insights, disclosure_hashes, bundle_hashes,
--   hot_stocks, profiles, subscriptions 테이블이 삭제됩니다!
-- - 테스트 환경에서만 사용하세요!
-- - 프로덕션에서는 마이그레이션 스크립트를 사용하세요!
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Step 1: Drop existing tables (순서 중요 - 외래키 때문에)
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS hot_stocks CASCADE;
DROP TABLE IF EXISTS bundle_hashes CASCADE;
DROP TABLE IF EXISTS disclosure_hashes CASCADE;
DROP TABLE IF EXISTS disclosure_insights CASCADE;

-- Step 2: Drop existing functions
DROP FUNCTION IF EXISTS promote_to_hot_stock CASCADE;
DROP FUNCTION IF EXISTS is_hot_stock CASCADE;
DROP FUNCTION IF EXISTS demote_expired_hot_stocks CASCADE;
DROP FUNCTION IF EXISTS get_active_hot_stocks CASCADE;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. disclosure_insights 테이블 생성
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE disclosure_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 공시 기본 정보
  rcept_no TEXT NOT NULL UNIQUE,
  corp_code TEXT NOT NULL,
  corp_name TEXT NOT NULL,
  stock_code TEXT,
  report_nm TEXT NOT NULL,
  rcept_dt TEXT NOT NULL,

  -- Groq AI 분석 결과
  ai_summary TEXT,
  sentiment TEXT,
  sentiment_score NUMERIC(3, 2),
  importance TEXT,
  analysis_status TEXT DEFAULT 'pending',
  analysis_retry_count INTEGER DEFAULT 0,

  -- Sonnet 심층 분석 결과
  sonnet_analyzed BOOLEAN DEFAULT FALSE,
  sonnet_summary TEXT,
  sonnet_detailed_analysis TEXT,
  sonnet_investment_implications TEXT,
  sonnet_risk_factors TEXT[],
  sonnet_key_metrics TEXT[],
  sonnet_tokens_used INTEGER DEFAULT 0,
  sonnet_analyzed_at TIMESTAMPTZ,
  is_sample_disclosure BOOLEAN DEFAULT FALSE,

  -- 타임스탬프
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_disclosure_insights_rcept_no ON disclosure_insights(rcept_no);
CREATE INDEX idx_disclosure_insights_corp_code ON disclosure_insights(corp_code);
CREATE INDEX idx_disclosure_insights_stock_code ON disclosure_insights(stock_code);
CREATE INDEX idx_disclosure_insights_analyzed_at ON disclosure_insights(analyzed_at DESC);
CREATE INDEX idx_disclosure_insights_importance ON disclosure_insights(importance);
CREATE INDEX idx_disclosure_insights_is_sample ON disclosure_insights(is_sample_disclosure) WHERE is_sample_disclosure = TRUE;
CREATE INDEX idx_disclosure_insights_sonnet_analyzed ON disclosure_insights(sonnet_analyzed, importance) WHERE sonnet_analyzed = TRUE;

ALTER TABLE disclosure_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all disclosures"
ON disclosure_insights FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Service role can manage disclosures"
ON disclosure_insights FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. Hash 테이블 생성 (중복 방지)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE disclosure_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hash_key TEXT NOT NULL UNIQUE,
  corp_code TEXT NOT NULL,
  rcept_no TEXT NOT NULL,
  corp_name TEXT NOT NULL,
  report_name TEXT NOT NULL,
  is_revision BOOLEAN DEFAULT FALSE,
  groq_analyzed BOOLEAN DEFAULT FALSE,
  sonnet_analyzed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX idx_disclosure_hashes_hash_key ON disclosure_hashes(hash_key);
CREATE INDEX idx_disclosure_hashes_corp_code ON disclosure_hashes(corp_code);
CREATE INDEX idx_disclosure_hashes_expires_at ON disclosure_hashes(expires_at);

CREATE TABLE bundle_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hash_key TEXT NOT NULL UNIQUE,
  corp_code TEXT NOT NULL,
  bundle_date DATE NOT NULL,
  time_bucket TEXT NOT NULL,
  corp_name TEXT NOT NULL,
  disclosure_count INTEGER DEFAULT 1,
  sonnet_called BOOLEAN DEFAULT FALSE,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour')
);

CREATE INDEX idx_bundle_hashes_hash_key ON bundle_hashes(hash_key);
CREATE INDEX idx_bundle_hashes_corp_code ON bundle_hashes(corp_code);
CREATE INDEX idx_bundle_hashes_expires_at ON bundle_hashes(expires_at);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. Hot Stocks 테이블 생성 (5분 폴링)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE hot_stocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corp_code TEXT NOT NULL UNIQUE,
  stock_code TEXT,
  corp_name TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT '5m',
  reason TEXT NOT NULL,
  reason_detail TEXT,
  trigger_value NUMERIC,
  trigger_threshold NUMERIC,
  promoted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 minutes'),
  refresh_count INTEGER DEFAULT 0,
  max_refreshes INTEGER DEFAULT 5,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hot_stocks_corp_code ON hot_stocks(corp_code);
CREATE INDEX idx_hot_stocks_is_active ON hot_stocks(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_hot_stocks_expires_at ON hot_stocks(expires_at);

-- Hot stock 승격/갱신 함수
CREATE OR REPLACE FUNCTION promote_to_hot_stock(
  p_corp_code TEXT,
  p_stock_code TEXT,
  p_corp_name TEXT,
  p_reason TEXT,
  p_reason_detail TEXT DEFAULT NULL,
  p_trigger_value NUMERIC DEFAULT NULL,
  p_trigger_threshold NUMERIC DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_existing RECORD;
BEGIN
  SELECT * INTO v_existing FROM hot_stocks WHERE corp_code = p_corp_code AND is_active = TRUE;

  IF FOUND THEN
    IF v_existing.refresh_count < v_existing.max_refreshes THEN
      UPDATE hot_stocks SET
        expires_at = NOW() + INTERVAL '60 minutes',
        refresh_count = refresh_count + 1,
        reason = p_reason,
        reason_detail = p_reason_detail,
        trigger_value = p_trigger_value,
        trigger_threshold = p_trigger_threshold,
        updated_at = NOW()
      WHERE corp_code = p_corp_code AND is_active = TRUE;
      RETURN TRUE;
    ELSE
      RETURN FALSE;
    END IF;
  ELSE
    INSERT INTO hot_stocks (
      corp_code, stock_code, corp_name, reason, reason_detail,
      trigger_value, trigger_threshold
    ) VALUES (
      p_corp_code, p_stock_code, p_corp_name, p_reason, p_reason_detail,
      p_trigger_value, p_trigger_threshold
    );
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Hot stock 여부 확인 함수
CREATE OR REPLACE FUNCTION is_hot_stock(p_corp_code TEXT) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM hot_stocks
    WHERE corp_code = p_corp_code
      AND is_active = TRUE
      AND expires_at > NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- 만료된 hot stocks 정리 함수
CREATE OR REPLACE FUNCTION demote_expired_hot_stocks() RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE hot_stocks SET is_active = FALSE, updated_at = NOW()
  WHERE is_active = TRUE AND expires_at <= NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 활성 hot stocks 조회 함수
CREATE OR REPLACE FUNCTION get_active_hot_stocks()
RETURNS TABLE(
  corp_code TEXT,
  stock_code TEXT,
  corp_name TEXT,
  reason TEXT,
  promoted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT h.corp_code, h.stock_code, h.corp_name, h.reason, h.promoted_at, h.expires_at
  FROM hot_stocks h
  WHERE h.is_active = TRUE AND h.expires_at > NOW()
  ORDER BY h.promoted_at DESC;
END;
$$ LANGUAGE plpgsql;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 4. Profiles & Subscriptions 테이블
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
ON subscriptions FOR SELECT
USING (auth.uid() = user_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. 테스트 계정 Premium 업그레이드
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- yaccurue3@naver.com 사용자 확인
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'yaccurue3@naver.com';

  IF v_user_id IS NOT NULL THEN
    -- Profile 생성
    INSERT INTO profiles (id, email, created_at, updated_at)
    VALUES (v_user_id, 'yaccurue3@naver.com', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    -- Premium Subscription 생성
    INSERT INTO subscriptions (
      user_id, plan_type, status,
      current_period_start, current_period_end,
      created_at, updated_at
    ) VALUES (
      v_user_id, 'premium', 'active',
      NOW(), NOW() + INTERVAL '1 year',
      NOW(), NOW()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan_type = 'premium',
      status = 'active',
      current_period_start = NOW(),
      current_period_end = NOW() + INTERVAL '1 year',
      updated_at = NOW();

    RAISE NOTICE '✅ 테스트 계정 Premium 업그레이드 완료: %', 'yaccurue3@naver.com';
  ELSE
    RAISE NOTICE '⚠️ 사용자를 찾을 수 없습니다: %', 'yaccurue3@naver.com';
  END IF;
END $$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 완료! 설정 확인
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SELECT
  '✅ disclosure_insights' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'disclosure_insights'
GROUP BY table_name;

SELECT
  '✅ disclosure_hashes' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'disclosure_hashes'
GROUP BY table_name;

SELECT
  '✅ bundle_hashes' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'bundle_hashes'
GROUP BY table_name;

SELECT
  '✅ hot_stocks' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'hot_stocks'
GROUP BY table_name;

SELECT
  '✅ profiles' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'profiles'
GROUP BY table_name;

SELECT
  '✅ subscriptions' as table_name,
  COUNT(*) as column_count
FROM information_schema.columns
WHERE table_name = 'subscriptions'
GROUP BY table_name;

-- 테스트 계정 확인
SELECT
  '✅ 테스트 계정 설정 완료' as message,
  u.email,
  s.plan_type,
  s.status,
  s.current_period_end
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
LEFT JOIN subscriptions s ON u.id = s.user_id
WHERE u.email = 'yaccurue3@naver.com';
