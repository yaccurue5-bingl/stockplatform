-- Add Sonnet Analysis Fields to disclosure_insights
-- Sonnet 심층 분석 결과를 저장할 필드 추가

-- 1. Sonnet 분석 필드 추가
ALTER TABLE disclosure_insights
ADD COLUMN IF NOT EXISTS sonnet_analyzed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS sonnet_summary TEXT,
ADD COLUMN IF NOT EXISTS sonnet_detailed_analysis TEXT,
ADD COLUMN IF NOT EXISTS sonnet_investment_implications TEXT,
ADD COLUMN IF NOT EXISTS sonnet_risk_factors TEXT[],
ADD COLUMN IF NOT EXISTS sonnet_key_metrics TEXT[],
ADD COLUMN IF NOT EXISTS sonnet_tokens_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sonnet_analyzed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_sample_disclosure BOOLEAN DEFAULT FALSE;

-- 2. 인덱스 추가 (샘플 공시 빠른 조회용)
CREATE INDEX IF NOT EXISTS idx_disclosure_insights_is_sample
ON disclosure_insights(is_sample_disclosure)
WHERE is_sample_disclosure = TRUE;

CREATE INDEX IF NOT EXISTS idx_disclosure_insights_sonnet_analyzed
ON disclosure_insights(sonnet_analyzed, importance)
WHERE sonnet_analyzed = TRUE;

-- 3. 주석 추가
COMMENT ON COLUMN disclosure_insights.sonnet_analyzed IS 'Sonnet으로 심층 분석 여부';
COMMENT ON COLUMN disclosure_insights.sonnet_summary IS 'Sonnet 요약';
COMMENT ON COLUMN disclosure_insights.sonnet_detailed_analysis IS 'Sonnet 심층 분석';
COMMENT ON COLUMN disclosure_insights.sonnet_investment_implications IS '투자 시사점';
COMMENT ON COLUMN disclosure_insights.sonnet_risk_factors IS '리스크 요인 배열';
COMMENT ON COLUMN disclosure_insights.sonnet_key_metrics IS '핵심 지표 배열';
COMMENT ON COLUMN disclosure_insights.sonnet_tokens_used IS 'Sonnet 사용 토큰 수';
COMMENT ON COLUMN disclosure_insights.sonnet_analyzed_at IS 'Sonnet 분석 일시';
COMMENT ON COLUMN disclosure_insights.is_sample_disclosure IS '무료 사용자용 샘플 공시 여부';

-- 완료 메시지
DO $$
BEGIN
  RAISE NOTICE '✅ Sonnet analysis fields added to disclosure_insights table';
  RAISE NOTICE '📊 New fields: sonnet_analyzed, sonnet_summary, sonnet_detailed_analysis, etc.';
  RAISE NOTICE '🎯 Use is_sample_disclosure=true to mark sample disclosures for free users';
END $$;
