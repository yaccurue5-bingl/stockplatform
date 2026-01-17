-- =====================================================
-- Hot Stocks Table for 5-Minute Polling Hybrid
-- K-MarketInsight
-- =====================================================

-- =====================================================
-- HOT_STOCKS TABLE
-- =====================================================
-- Tracks stocks promoted to 5-minute polling due to:
-- - Price volatility (±5% in 5/15 min)
-- - Trading volume spike (2x average)
-- - Important disclosures

CREATE TABLE IF NOT EXISTS hot_stocks (
  id BIGSERIAL PRIMARY KEY,

  -- Stock identification
  corp_code TEXT NOT NULL UNIQUE,
  stock_code TEXT,
  corp_name TEXT,

  -- Promotion details
  level TEXT NOT NULL DEFAULT '5m',  -- '5m' or '15m'
  reason TEXT NOT NULL,  -- 'price_spike', 'volume_spike', 'important_disclosure'
  reason_detail TEXT,  -- Additional context

  -- Trigger values
  trigger_value NUMERIC,  -- e.g., 7.5 (for 7.5% price change)
  trigger_threshold NUMERIC,  -- e.g., 5.0 (threshold was 5%)

  -- Lifecycle
  promoted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 minutes'),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),

  -- Auto-refresh tracking
  refresh_count INTEGER DEFAULT 0,  -- TTL 갱신 횟수
  max_refreshes INTEGER DEFAULT 5,  -- 최대 갱신 횟수

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_hot_stocks_corp_code ON hot_stocks(corp_code);
CREATE INDEX idx_hot_stocks_active ON hot_stocks(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_hot_stocks_expires_at ON hot_stocks(expires_at);
CREATE INDEX idx_hot_stocks_level ON hot_stocks(level);

COMMENT ON TABLE hot_stocks IS 'Stocks promoted to 5-minute polling (TTL: 60min, renewable)';

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Promote stock to 5-minute polling
CREATE OR REPLACE FUNCTION promote_to_hot_stock(
  p_corp_code TEXT,
  p_stock_code TEXT,
  p_corp_name TEXT,
  p_reason TEXT,
  p_reason_detail TEXT DEFAULT NULL,
  p_trigger_value NUMERIC DEFAULT NULL,
  p_trigger_threshold NUMERIC DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  existing_record RECORD;
BEGIN
  -- Check if already exists
  SELECT * INTO existing_record
  FROM hot_stocks
  WHERE corp_code = p_corp_code
  AND is_active = TRUE;

  IF FOUND THEN
    -- Refresh TTL and update
    UPDATE hot_stocks
    SET
      expires_at = NOW() + INTERVAL '60 minutes',
      last_activity_at = NOW(),
      refresh_count = refresh_count + 1,
      reason = p_reason,
      reason_detail = p_reason_detail,
      trigger_value = p_trigger_value,
      trigger_threshold = p_trigger_threshold,
      updated_at = NOW()
    WHERE corp_code = p_corp_code
    AND is_active = TRUE
    AND refresh_count < max_refreshes;

    RETURN TRUE;
  ELSE
    -- Insert new hot stock
    INSERT INTO hot_stocks (
      corp_code,
      stock_code,
      corp_name,
      level,
      reason,
      reason_detail,
      trigger_value,
      trigger_threshold,
      promoted_at,
      expires_at,
      last_activity_at
    ) VALUES (
      p_corp_code,
      p_stock_code,
      p_corp_name,
      '5m',
      p_reason,
      p_reason_detail,
      p_trigger_value,
      p_trigger_threshold,
      NOW(),
      NOW() + INTERVAL '60 minutes',
      NOW()
    );

    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Check if stock is hot
CREATE OR REPLACE FUNCTION is_hot_stock(p_corp_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  is_hot BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM hot_stocks
    WHERE corp_code = p_corp_code
    AND is_active = TRUE
    AND expires_at > NOW()
  ) INTO is_hot;

  RETURN is_hot;
END;
$$ LANGUAGE plpgsql;

-- Demote expired hot stocks
CREATE OR REPLACE FUNCTION demote_expired_hot_stocks()
RETURNS INTEGER AS $$
DECLARE
  demoted_count INTEGER;
BEGIN
  UPDATE hot_stocks
  SET
    is_active = FALSE,
    level = '15m',
    updated_at = NOW()
  WHERE is_active = TRUE
  AND (
    expires_at < NOW()
    OR refresh_count >= max_refreshes
  );

  GET DIAGNOSTICS demoted_count = ROW_COUNT;

  RETURN demoted_count;
END;
$$ LANGUAGE plpgsql;

-- Get active hot stocks
CREATE OR REPLACE FUNCTION get_active_hot_stocks()
RETURNS TABLE (
  corp_code TEXT,
  stock_code TEXT,
  corp_name TEXT,
  reason TEXT,
  promoted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.corp_code,
    h.stock_code,
    h.corp_name,
    h.reason,
    h.promoted_at,
    h.expires_at
  FROM hot_stocks h
  WHERE h.is_active = TRUE
  AND h.expires_at > NOW()
  ORDER BY h.promoted_at DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STATISTICS VIEW
-- =====================================================

CREATE OR REPLACE VIEW hot_stocks_statistics AS
SELECT
  COUNT(*) FILTER (WHERE is_active = TRUE) AS active_count,
  COUNT(*) FILTER (WHERE is_active = FALSE) AS demoted_count,
  COUNT(*) FILTER (WHERE reason = 'price_spike') AS price_spike_count,
  COUNT(*) FILTER (WHERE reason = 'volume_spike') AS volume_spike_count,
  COUNT(*) FILTER (WHERE reason = 'important_disclosure') AS disclosure_count,
  AVG(refresh_count) FILTER (WHERE is_active = TRUE) AS avg_refreshes,
  MAX(expires_at) FILTER (WHERE is_active = TRUE) AS latest_expiry
FROM hot_stocks;

COMMENT ON VIEW hot_stocks_statistics IS 'Hot stocks statistics and monitoring';

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE hot_stocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON hot_stocks;
CREATE POLICY "Service role only"
ON hot_stocks
FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role')
WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- =====================================================
-- SAMPLE USAGE
-- =====================================================

-- Promote stock to hot
-- SELECT promote_to_hot_stock('00126380', '005930', 'Samsung Electronics', 'price_spike', '+7.5% in 5min', 7.5, 5.0);

-- Check if hot
-- SELECT is_hot_stock('00126380');

-- Get active hot stocks
-- SELECT * FROM get_active_hot_stocks();

-- Demote expired
-- SELECT demote_expired_hot_stocks();

-- Statistics
-- SELECT * FROM hot_stocks_statistics;
