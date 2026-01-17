-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- K-MarketInsight Database Migration (데이터 보존)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- ✅ 기존 데이터 보존
-- ✅ 누락된 컬럼만 추가
-- ✅ 누락된 테이블만 생성
-- ✅ 프로덕션 환경에서 안전하게 사용 가능
--
-- 사용법:
-- 1. Supabase Dashboard → SQL Editor
-- 2. 이 파일 전체 복사 → 붙여넣기
-- 3. "Run" 클릭
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 1. disclosure_insights 테이블 마이그레이션
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 테이블이 없으면 생성
CREATE TABLE IF NOT EXISTS disclosure_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rcept_no TEXT NOT NULL UNIQUE,
  corp_code TEXT NOT NULL,
  corp_name TEXT NOT NULL,
  stock_code TEXT,
  report_nm TEXT NOT NULL,
  rcept_dt TEXT NOT NULL,
  ai_summary TEXT,
  sentiment TEXT,
  sentiment_score NUMERIC(3, 2),
  importance TEXT,
  analysis_status TEXT DEFAULT 'pending',
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 누락된 컬럼 추가 (이미 있으면 에러나지만 계속 진행)
DO $$
BEGIN
  -- 분석 재시도 컬럼 추가
  ALTER TABLE disclosure_insights ADD COLUMN IF NOT EXISTS analysis_retry_count INTEGER DEFAULT 0;

  -- Sonnet 분석 컬럼들 추가
  ALTER TABLE disclosure_insights ADD COLUMN IF NOT EXISTS sonnet_analyzed BOOLEAN DEFAULT FALSE;
  ALTER TABLE disclosure_insights ADD COLUMN IF NOT EXISTS sonnet_summary TEXT;
  ALTER TABLE disclosure_insights ADD COLUMN IF NOT EXISTS sonnet_detailed_analysis TEXT;
  ALTER TABLE disclosure_insights ADD COLUMN IF NOT EXISTS sonnet_investment_implications TEXT;
  ALTER TABLE disclosure_insights ADD COLUMN IF NOT EXISTS sonnet_risk_factors TEXT[];
  ALTER TABLE disclosure_insights ADD COLUMN IF NOT EXISTS sonnet_key_metrics TEXT[];
  ALTER TABLE disclosure_insights ADD COLUMN IF NOT EXISTS sonnet_tokens_used INTEGER DEFAULT 0;
  ALTER TABLE disclosure_insights ADD COLUMN IF NOT EXISTS sonnet_analyzed_at TIMESTAMPTZ;
  ALTER TABLE disclosure_insights ADD COLUMN IF NOT EXISTS is_sample_disclosure BOOLEAN DEFAULT FALSE;

  RAISE NOTICE '✅ disclosure_insights 컬럼 추가 완료';
EXCEPTION
  WHEN duplicate_column THEN
    RAISE NOTICE '⚠️ 일부 컬럼이 이미 존재합니다 (정상)';
END $$;

-- 인덱스 생성 (이미 있으면 스킵)
CREATE INDEX IF NOT EXISTS idx_disclosure_insights_rcept_no ON disclosure_insights(rcept_no);
CREATE INDEX IF NOT EXISTS idx_disclosure_insights_corp_code ON disclosure_insights(corp_code);
CREATE INDEX IF NOT EXISTS idx_disclosure_insights_stock_code ON disclosure_insights(stock_code);
CREATE INDEX IF NOT EXISTS idx_disclosure_insights_analyzed_at ON disclosure_insights(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_disclosure_insights_importance ON disclosure_insights(importance);
CREATE INDEX IF NOT EXISTS idx_disclosure_insights_is_sample ON disclosure_insights(is_sample_disclosure) WHERE is_sample_disclosure = TRUE;
CREATE INDEX IF NOT EXISTS idx_disclosure_insights_sonnet_analyzed ON disclosure_insights(sonnet_analyzed, importance) WHERE sonnet_analyzed = TRUE;

-- RLS 활성화
ALTER TABLE disclosure_insights ENABLE ROW LEVEL SECURITY;

-- RLS 정책 (기존 정책 삭제 후 재생성)
DROP POLICY IF EXISTS "Authenticated users can view all disclosures" ON disclosure_insights;
CREATE POLICY "Authenticated users can view all disclosures"
ON disclosure_insights FOR SELECT
USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Service role can manage disclosures" ON disclosure_insights;
CREATE POLICY "Service role can manage disclosures"
ON disclosure_insights FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 2. Hash 테이블 생성 (없으면)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS disclosure_hashes (
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

CREATE INDEX IF NOT EXISTS idx_disclosure_hashes_hash_key ON disclosure_hashes(hash_key);
CREATE INDEX IF NOT EXISTS idx_disclosure_hashes_corp_code ON disclosure_hashes(corp_code);
CREATE INDEX IF NOT EXISTS idx_disclosure_hashes_expires_at ON disclosure_hashes(expires_at);

CREATE TABLE IF NOT EXISTS bundle_hashes (
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

CREATE INDEX IF NOT EXISTS idx_bundle_hashes_hash_key ON bundle_hashes(hash_key);
CREATE INDEX IF NOT EXISTS idx_bundle_hashes_corp_code ON bundle_hashes(corp_code);
CREATE INDEX IF NOT EXISTS idx_bundle_hashes_expires_at ON bundle_hashes(expires_at);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 3. Hot Stocks 테이블 생성 (없으면)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS hot_stocks (
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

CREATE INDEX IF NOT EXISTS idx_hot_stocks_corp_code ON hot_stocks(corp_code);
CREATE INDEX IF NOT EXISTS idx_hot_stocks_is_active ON hot_stocks(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_hot_stocks_expires_at ON hot_stocks(expires_at);

-- Hot stock 함수들
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
-- 4. Profiles & Subscriptions 테이블 생성 (없으면)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

CREATE TABLE IF NOT EXISTS subscriptions (
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

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscription" ON subscriptions;
CREATE POLICY "Users can view own subscription"
ON subscriptions FOR SELECT
USING (auth.uid() = user_id);


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 5. 테스트 계정 Premium 업그레이드 (데이터 보존)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'yaccurue3@naver.com';

  IF v_user_id IS NOT NULL THEN
    -- Profile 생성 (없으면)
    INSERT INTO profiles (id, email, created_at, updated_at)
    VALUES (v_user_id, 'yaccurue3@naver.com', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    -- Premium Subscription 생성/업데이트
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

    RAISE NOTICE '✅ 테스트 계정 Premium 업그레이드 완료';
  ELSE
    RAISE NOTICE '⚠️ yaccurue3@naver.com 사용자를 찾을 수 없습니다';
  END IF;
END $$;


-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 완료! 데이터 확인
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 테이블별 데이터 개수 확인
SELECT
  '✅ disclosure_insights' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE sonnet_analyzed = TRUE) as sonnet_analyzed_count,
  COUNT(*) FILTER (WHERE is_sample_disclosure = TRUE) as sample_count
FROM disclosure_insights;

SELECT
  '✅ disclosure_hashes' as table_name,
  COUNT(*) as total_records
FROM disclosure_hashes;

SELECT
  '✅ hot_stocks' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE is_active = TRUE) as active_count
FROM hot_stocks;

-- 컬럼 확인
SELECT
  'disclosure_insights 컬럼 목록' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'disclosure_insights'
ORDER BY ordinal_position;

-- 테스트 계정 확인
SELECT
  '✅ 테스트 계정' as info,
  u.email,
  s.plan_type,
  s.status,
  s.current_period_end
FROM auth.users u
LEFT JOIN subscriptions s ON u.id = s.user_id
WHERE u.email = 'yaccurue3@naver.com';
