-- Create disclosure_insights table
-- 공시 분석 결과를 저장하는 메인 테이블

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS disclosure_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 공시 기본 정보
  rcept_no TEXT NOT NULL UNIQUE,           -- 접수번호 (DART 고유 ID)
  corp_code TEXT NOT NULL,                 -- 기업 고유번호
  corp_name TEXT NOT NULL,                 -- 회사명
  stock_code TEXT,                         -- 종목코드
  report_nm TEXT NOT NULL,                 -- 공시명
  rcept_dt TEXT NOT NULL,                  -- 접수일자 (YYYYMMDD)

  -- Groq AI 분석 결과
  ai_summary TEXT,                         -- AI 요약
  sentiment TEXT,                          -- 감정: POSITIVE, NEGATIVE, NEUTRAL
  sentiment_score NUMERIC(3, 2),           -- 감정 점수 (0.0 ~ 1.0)
  importance TEXT,                         -- 중요도: HIGH, MEDIUM, LOW
  analysis_status TEXT DEFAULT 'pending',  -- 분석 상태: pending, completed, failed

  -- Sonnet 심층 분석 결과
  sonnet_analyzed BOOLEAN DEFAULT FALSE,
  sonnet_summary TEXT,
  sonnet_detailed_analysis TEXT,
  sonnet_investment_implications TEXT,
  sonnet_risk_factors TEXT[],
  sonnet_key_metrics TEXT[],
  sonnet_tokens_used INTEGER DEFAULT 0,
  sonnet_analyzed_at TIMESTAMPTZ,

  -- 샘플 공시 플래그 (무료 사용자용)
  is_sample_disclosure BOOLEAN DEFAULT FALSE,

  -- 타임스탬프
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_disclosure_insights_rcept_no ON disclosure_insights(rcept_no);
CREATE INDEX IF NOT EXISTS idx_disclosure_insights_corp_code ON disclosure_insights(corp_code);
CREATE INDEX IF NOT EXISTS idx_disclosure_insights_stock_code ON disclosure_insights(stock_code);
CREATE INDEX IF NOT EXISTS idx_disclosure_insights_analyzed_at ON disclosure_insights(analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_disclosure_insights_importance ON disclosure_insights(importance);
CREATE INDEX IF NOT EXISTS idx_disclosure_insights_sentiment ON disclosure_insights(sentiment);

-- 샘플 공시 빠른 조회용
CREATE INDEX IF NOT EXISTS idx_disclosure_insights_is_sample
ON disclosure_insights(is_sample_disclosure)
WHERE is_sample_disclosure = TRUE;

-- Sonnet 분석된 공시 조회용
CREATE INDEX IF NOT EXISTS idx_disclosure_insights_sonnet_analyzed
ON disclosure_insights(sonnet_analyzed, importance)
WHERE sonnet_analyzed = TRUE;

-- 3. RLS 정책 활성화
ALTER TABLE disclosure_insights ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자는 조회 가능
CREATE POLICY "Authenticated users can view all disclosures"
ON disclosure_insights FOR SELECT
USING (auth.role() = 'authenticated');

-- Service role만 삽입/수정/삭제 가능
CREATE POLICY "Service role can manage disclosures"
ON disclosure_insights FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- 4. 주석 추가
COMMENT ON TABLE disclosure_insights IS '공시 분석 결과 저장 테이블';
COMMENT ON COLUMN disclosure_insights.rcept_no IS 'DART 접수번호 (고유 ID)';
COMMENT ON COLUMN disclosure_insights.corp_code IS '기업 고유번호';
COMMENT ON COLUMN disclosure_insights.corp_name IS '회사명';
COMMENT ON COLUMN disclosure_insights.stock_code IS '종목코드';
COMMENT ON COLUMN disclosure_insights.report_nm IS '공시명';
COMMENT ON COLUMN disclosure_insights.rcept_dt IS '접수일자 (YYYYMMDD)';
COMMENT ON COLUMN disclosure_insights.ai_summary IS 'Groq AI 요약';
COMMENT ON COLUMN disclosure_insights.sentiment IS '감정: POSITIVE, NEGATIVE, NEUTRAL';
COMMENT ON COLUMN disclosure_insights.sentiment_score IS '감정 점수 (0.0 ~ 1.0)';
COMMENT ON COLUMN disclosure_insights.importance IS '중요도: HIGH, MEDIUM, LOW';
COMMENT ON COLUMN disclosure_insights.analysis_status IS '분석 상태: pending, completed, failed';
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
  RAISE NOTICE '✅ disclosure_insights table created successfully';
  RAISE NOTICE '📊 Includes Groq and Sonnet analysis fields';
  RAISE NOTICE '🔒 RLS policies enabled';
END $$;
