-- ============================================================
-- 046_create_event_stats_by_regime_and_vol.sql
-- Contextual Stats #2: 시장 레짐, #3: 변동성 레짐별 이벤트 통계
--
-- event_stats_by_regime : 공시 시점 KOSPI 20D 추세 기반 레짐
--   UP      : KOSPI 20D 선행 수익률 > +5%
--   NEUTRAL : -5% ~ +5%
--   DOWN    : < -5%
--
-- event_stats_by_vol : 공시 시점 KOSPI 20D 롤링 변동성 기반 레짐
--   HIGH   : 20D 일간 수익률 표준편차 > 1.2%
--   NORMAL : 0.6% ~ 1.2%
--   LOW    : < 0.6%
-- ============================================================

-- ── 시장 레짐 (KOSPI 20D 추세) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_stats_by_regime (
  event_type          text    NOT NULL,
  regime              text    NOT NULL CHECK (regime IN ('UP', 'NEUTRAL', 'DOWN')),
  sample_size         int,
  hit_ratio           float,
  hit_ratio_20d       float,
  avg_5d_open_return  float,
  alpha5_trimmed      float,
  alpha20_trimmed     float,
  alpha20_median      float,
  avg_mdd             float,
  updated_at          timestamptz DEFAULT now(),
  PRIMARY KEY (event_type, regime)
);

COMMENT ON TABLE  public.event_stats_by_regime         IS 'KOSPI 20D 추세 레짐별 이벤트 통계 (EOD 업데이트)';
COMMENT ON COLUMN public.event_stats_by_regime.regime  IS 'UP(KOSPI 20D>+5%) / NEUTRAL(-5%~+5%) / DOWN(<-5%)';

ALTER TABLE public.event_stats_by_regime ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read event_stats_by_regime"
  ON public.event_stats_by_regime FOR SELECT USING (true);

-- ── 변동성 레짐 (KOSPI 20D 롤링 변동성) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_stats_by_vol (
  event_type          text    NOT NULL,
  vol_regime          text    NOT NULL CHECK (vol_regime IN ('HIGH', 'NORMAL', 'LOW')),
  sample_size         int,
  hit_ratio           float,
  hit_ratio_20d       float,
  avg_5d_open_return  float,
  alpha5_trimmed      float,
  alpha20_trimmed     float,
  alpha20_median      float,
  avg_mdd             float,
  updated_at          timestamptz DEFAULT now(),
  PRIMARY KEY (event_type, vol_regime)
);

COMMENT ON TABLE  public.event_stats_by_vol            IS 'KOSPI 20D 롤링 변동성 레짐별 이벤트 통계 (EOD 업데이트)';
COMMENT ON COLUMN public.event_stats_by_vol.vol_regime IS 'HIGH(std>1.2%) / NORMAL(0.6~1.2%) / LOW(std<0.6%)';

ALTER TABLE public.event_stats_by_vol ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read event_stats_by_vol"
  ON public.event_stats_by_vol FOR SELECT USING (true);
