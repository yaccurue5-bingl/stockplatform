-- =====================================================
-- Hash Strategy Tables for K-MarketInsight
-- Prevents duplicate AI analysis calls (Groq + Sonnet)
-- =====================================================

-- =====================================================
-- 1. DISCLOSURE_HASHES TABLE
-- =====================================================
-- 공시 단위 hash (1차 방어선)
-- 목적: 이미 처리한 공시 중복 방지

CREATE TABLE IF NOT EXISTS disclosure_hashes (
  id BIGSERIAL PRIMARY KEY,

  -- Hash keys
  hash_key TEXT NOT NULL UNIQUE,  -- {corp_code}_{rcept_no}
  corp_code TEXT NOT NULL,
  rcept_no TEXT NOT NULL,

  -- Metadata
  corp_name TEXT,
  report_name TEXT,
  is_revision BOOLEAN DEFAULT FALSE,  -- 정정공시 여부
  original_rcept_no TEXT,  -- 정정공시인 경우 원본 접수번호

  -- Analysis tracking
  groq_analyzed BOOLEAN DEFAULT FALSE,
  groq_analyzed_at TIMESTAMPTZ,
  sonnet_analyzed BOOLEAN DEFAULT FALSE,
  sonnet_analyzed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),

  -- Constraints
  CONSTRAINT unique_disclosure UNIQUE (corp_code, rcept_no)
);

-- Indexes
CREATE INDEX idx_disclosure_hashes_hash_key ON disclosure_hashes(hash_key);
CREATE INDEX idx_disclosure_hashes_corp_code ON disclosure_hashes(corp_code);
CREATE INDEX idx_disclosure_hashes_rcept_no ON disclosure_hashes(rcept_no);
CREATE INDEX idx_disclosure_hashes_expires_at ON disclosure_hashes(expires_at);
CREATE INDEX idx_disclosure_hashes_revision ON disclosure_hashes(is_revision) WHERE is_revision = TRUE;

COMMENT ON TABLE disclosure_hashes IS '공시 단위 hash - 중복 처리 방지 (TTL: 30일)';

-- =====================================================
-- 2. BUNDLE_HASHES TABLE
-- =====================================================
-- 종목·시간 묶음 hash (2차 방어선)
-- 목적: Sonnet 중복 호출 방지

CREATE TABLE IF NOT EXISTS bundle_hashes (
  id BIGSERIAL PRIMARY KEY,

  -- Hash keys
  hash_key TEXT NOT NULL UNIQUE,  -- {corp_code}_{YYYYMMDD}_{time_bucket}
  corp_code TEXT NOT NULL,
  bundle_date DATE NOT NULL,
  time_bucket TEXT NOT NULL,  -- '0930', '1015', etc.

  -- Metadata
  corp_name TEXT,
  disclosure_count INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,

  -- Analysis tracking
  sonnet_called BOOLEAN DEFAULT FALSE,
  sonnet_called_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour'),

  -- Constraints
  CONSTRAINT unique_bundle UNIQUE (corp_code, bundle_date, time_bucket)
);

-- Indexes
CREATE INDEX idx_bundle_hashes_hash_key ON bundle_hashes(hash_key);
CREATE INDEX idx_bundle_hashes_corp_code ON bundle_hashes(corp_code);
CREATE INDEX idx_bundle_hashes_date_bucket ON bundle_hashes(bundle_date, time_bucket);
CREATE INDEX idx_bundle_hashes_expires_at ON bundle_hashes(expires_at);

COMMENT ON TABLE bundle_hashes IS '종목·시간 묶음 hash - Sonnet 중복 호출 방지 (TTL: 1시간)';

-- =====================================================
-- 3. AUTO-CLEANUP FUNCTION
-- =====================================================
-- 만료된 hash 자동 삭제 (크론으로 호출)

CREATE OR REPLACE FUNCTION cleanup_expired_hashes()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- disclosure_hashes 정리
  DELETE FROM disclosure_hashes
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- bundle_hashes 정리
  DELETE FROM bundle_hashes
  WHERE expires_at < NOW();

  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_expired_hashes IS '만료된 hash 레코드 자동 삭제 (크론 호출용)';

-- =====================================================
-- 4. HASH UTILITY FUNCTIONS
-- =====================================================

-- 공시 hash 생성
CREATE OR REPLACE FUNCTION generate_disclosure_hash(
  p_corp_code TEXT,
  p_rcept_no TEXT
)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(p_corp_code || '_' || p_rcept_no, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 묶음 hash 생성
CREATE OR REPLACE FUNCTION generate_bundle_hash(
  p_corp_code TEXT,
  p_date DATE,
  p_time_bucket TEXT
)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(
    p_corp_code || '_' ||
    TO_CHAR(p_date, 'YYYYMMDD') || '_' ||
    p_time_bucket,
    'md5'
  ), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 공시 중복 확인
CREATE OR REPLACE FUNCTION is_disclosure_processed(
  p_corp_code TEXT,
  p_rcept_no TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  hash_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM disclosure_hashes
    WHERE corp_code = p_corp_code
    AND rcept_no = p_rcept_no
    AND expires_at > NOW()
  ) INTO hash_exists;

  RETURN hash_exists;
END;
$$ LANGUAGE plpgsql;

-- 묶음 Sonnet 호출 확인
CREATE OR REPLACE FUNCTION is_bundle_sonnet_called(
  p_corp_code TEXT,
  p_date DATE,
  p_time_bucket TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  already_called BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM bundle_hashes
    WHERE corp_code = p_corp_code
    AND bundle_date = p_date
    AND time_bucket = p_time_bucket
    AND sonnet_called = TRUE
    AND expires_at > NOW()
  ) INTO already_called;

  RETURN already_called;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. RLS POLICIES
-- =====================================================

-- Service role만 접근 가능
ALTER TABLE disclosure_hashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_hashes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON disclosure_hashes;
CREATE POLICY "Service role only"
ON disclosure_hashes
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role only" ON bundle_hashes;
CREATE POLICY "Service role only"
ON bundle_hashes
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- 6. SAMPLE USAGE QUERIES
-- =====================================================

-- 공시 처리 전 중복 확인
-- SELECT is_disclosure_processed('00126380', '20240117000123');

-- 공시 hash 등록
-- INSERT INTO disclosure_hashes (hash_key, corp_code, rcept_no, corp_name, report_name)
-- VALUES (
--   generate_disclosure_hash('00126380', '20240117000123'),
--   '00126380',
--   '20240117000123',
--   '삼성전자',
--   '매출액 또는 손익구조 30%(대규모법인 15%)이상 변경'
-- );

-- Sonnet 호출 전 중복 확인
-- SELECT is_bundle_sonnet_called('00126380', CURRENT_DATE, '0930');

-- 묶음 hash 등록
-- INSERT INTO bundle_hashes (hash_key, corp_code, bundle_date, time_bucket, corp_name, sonnet_called)
-- VALUES (
--   generate_bundle_hash('00126380', CURRENT_DATE, '0930'),
--   '00126380',
--   CURRENT_DATE,
--   '0930',
--   '삼성전자',
--   TRUE
-- );

-- 만료된 hash 정리
-- SELECT cleanup_expired_hashes();

-- =====================================================
-- 7. STATISTICS VIEW
-- =====================================================

CREATE OR REPLACE VIEW hash_statistics AS
SELECT
  'disclosure' AS hash_type,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE groq_analyzed = TRUE) AS groq_analyzed_count,
  COUNT(*) FILTER (WHERE sonnet_analyzed = TRUE) AS sonnet_analyzed_count,
  COUNT(*) FILTER (WHERE is_revision = TRUE) AS revision_count,
  COUNT(*) FILTER (WHERE expires_at < NOW()) AS expired_count
FROM disclosure_hashes

UNION ALL

SELECT
  'bundle' AS hash_type,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE sonnet_called = TRUE) AS groq_analyzed_count,
  0 AS sonnet_analyzed_count,
  0 AS revision_count,
  COUNT(*) FILTER (WHERE expires_at < NOW()) AS expired_count
FROM bundle_hashes;

COMMENT ON VIEW hash_statistics IS 'Hash 시스템 통계 - 중복 방지 효율성 모니터링';
