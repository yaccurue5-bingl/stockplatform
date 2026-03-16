-- =========================================
-- Migration 018: sector_signals 테이블 생성
-- 섹터별 투자 신호 (disclosure_insights 집계 결과)
-- compute_sector_signals.py 가 매일 INSERT
-- =========================================

CREATE TABLE IF NOT EXISTS public.sector_signals (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  date          DATE    NOT NULL,
  sector        TEXT    NOT NULL,   -- companies.sector (한글)
  sector_en     TEXT,               -- sectors.sector_en (영문)
  signal        TEXT    CHECK (signal IN ('Bullish', 'Bearish', 'Neutral')),
  confidence    NUMERIC(4,3),       -- 0.000 ~ 1.000
  disclosure_count INT DEFAULT 0,  -- 해당 섹터 당일 공시 수
  positive_count   INT DEFAULT 0,
  negative_count   INT DEFAULT 0,
  neutral_count    INT DEFAULT 0,
  drivers       TEXT[],             -- ["exports rising", "foreign inflow"]
  created_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (date, sector)             -- 날짜+섹터 중복 방지
);

-- RLS
ALTER TABLE public.sector_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view sector_signals" ON public.sector_signals;
CREATE POLICY "Authenticated users can view sector_signals"
  ON public.sector_signals FOR SELECT
  USING (auth.role() = 'authenticated');

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_sector_signals_date   ON public.sector_signals(date DESC);
CREATE INDEX IF NOT EXISTS idx_sector_signals_sector ON public.sector_signals(sector);
CREATE INDEX IF NOT EXISTS idx_sector_signals_signal ON public.sector_signals(signal);
