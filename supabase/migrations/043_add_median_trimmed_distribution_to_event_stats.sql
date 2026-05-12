-- ============================================================
-- 043_add_median_trimmed_distribution_to_event_stats.sql
-- event_stats 테이블 — 통계 컬럼 보강
--
-- 추가 배경:
--   mean alpha 단독 사용 시 한국 small-cap outlier 에 의해 왜곡됨.
--   mean > trimmed > median 패턴 확인 → median/trimmed 병행 표시 필요.
--
-- 추가 컬럼:
--   Alpha Median  : alpha5_median, alpha20_median
--   Alpha Trimmed : alpha5_trimmed, alpha20_trimmed  (10% 상하 제거 평균)
--   Alpha Dist    : alpha20_pos_pct  (벤치마크 초과 비율 %)
--   Return Dist   : pct_gt5_20d, pct_lt10_20d, max_gain_20d, max_loss_20d
-- ============================================================

ALTER TABLE public.event_stats
  ADD COLUMN IF NOT EXISTS alpha5_median      float,  -- median(stock_r5 - bm_r5)
  ADD COLUMN IF NOT EXISTS alpha20_median     float,  -- median(stock_r20 - bm_r20)
  ADD COLUMN IF NOT EXISTS alpha5_trimmed     float,  -- trimmed mean 10% (alpha 5d)
  ADD COLUMN IF NOT EXISTS alpha20_trimmed    float,  -- trimmed mean 10% (alpha 20d)
  ADD COLUMN IF NOT EXISTS alpha20_pos_pct    float,  -- % events where alpha_20d > 0
  ADD COLUMN IF NOT EXISTS pct_gt5_20d        float,  -- % events where 20d return > +5%
  ADD COLUMN IF NOT EXISTS pct_lt10_20d       float,  -- % events where 20d return < -10%
  ADD COLUMN IF NOT EXISTS max_gain_20d       float,  -- max 20d return observed
  ADD COLUMN IF NOT EXISTS max_loss_20d       float;  -- min 20d return observed (most negative)

COMMENT ON COLUMN public.event_stats.alpha5_median   IS 'median alpha (stock - benchmark) 5일';
COMMENT ON COLUMN public.event_stats.alpha20_median  IS 'median alpha (stock - benchmark) 20일';
COMMENT ON COLUMN public.event_stats.alpha5_trimmed  IS 'trimmed mean alpha 5일 (상하 5% 제거)';
COMMENT ON COLUMN public.event_stats.alpha20_trimmed IS 'trimmed mean alpha 20일 (상하 5% 제거)';
COMMENT ON COLUMN public.event_stats.alpha20_pos_pct IS '20일 alpha > 0 비율 (벤치마크 초과 비율 %)';
COMMENT ON COLUMN public.event_stats.pct_gt5_20d     IS '20일 수익률 > +5% 비율 (%)';
COMMENT ON COLUMN public.event_stats.pct_lt10_20d    IS '20일 수익률 < -10% 비율 (%)';
COMMENT ON COLUMN public.event_stats.max_gain_20d    IS '20일 최대 수익률 (단일 이벤트 최고)';
COMMENT ON COLUMN public.event_stats.max_loss_20d    IS '20일 최대 손실률 (단일 이벤트 최저)';
