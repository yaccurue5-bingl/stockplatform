-- =========================================
-- Migration 019: market_radar 테이블 생성
-- 한국 시장 일일 요약 (daily summary)
-- compute_market_radar.py 가 매일 INSERT
-- =========================================

CREATE TABLE IF NOT EXISTS public.market_radar (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE  NOT NULL UNIQUE,   -- 기준일 (중복 방지)
  market_signal   TEXT  CHECK (market_signal IN ('Bullish', 'Bearish', 'Neutral')),
  top_sector      TEXT,                    -- 최고 confidence 섹터 (한글)
  top_sector_en   TEXT,                    -- 최고 confidence 섹터 (영문)
  foreign_flow    TEXT,                    -- 외국인 순매수 요약 ("+320M")
  kospi_change    NUMERIC(5,2),            -- 코스피 등락률 (%)
  kosdaq_change   NUMERIC(5,2),            -- 코스닥 등락률 (%)
  total_disclosures INT DEFAULT 0,         -- 당일 총 공시 수
  summary         TEXT,                    -- AI 생성 요약 문장
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.market_radar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view market_radar" ON public.market_radar;
CREATE POLICY "Authenticated users can view market_radar"
  ON public.market_radar FOR SELECT
  USING (auth.role() = 'authenticated');

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_market_radar_date ON public.market_radar(date DESC);
