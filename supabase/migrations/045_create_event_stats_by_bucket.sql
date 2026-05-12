-- ============================================================
-- 045_create_event_stats_by_bucket.sql
-- 시총 버킷(LARGE/MID/SMALL)별 조건부 이벤트 통계
--
-- 배경:
--   event_stats는 전체 집계. 시총 버킷별로 성과가 크게 다를 수 있음:
--   - SMALL-cap: 이벤트 반응 변동성 크고 hit rate 차이 두드러짐
--   - LARGE-cap: 알파 작지만 안정적
--   이를 별도 테이블로 분리하여 향후 regime/sector 등과 동일한 패턴으로 확장 가능.
--
-- 버킷 정의 (backfill_prices.py get_cap_bucket 기준):
--   LARGE : 시가총액 1조 원 이상
--   MID   : 시가총액 1000억 ~ 1조 원 미만
--   SMALL : 시가총액 1000억 원 미만
-- ============================================================

CREATE TABLE IF NOT EXISTS public.event_stats_by_bucket (
  event_type          text        NOT NULL,
  bucket              text        NOT NULL CHECK (bucket IN ('LARGE', 'MID', 'SMALL')),
  sample_size         int,                   -- 해당 버킷의 이벤트 수
  hit_ratio           float,                 -- 5D 수익률 > 0 비율 (공시 다음날 시가 기준)
  hit_ratio_20d       float,                 -- 20D 수익률 > 0 비율
  avg_5d_open_return  float,                 -- 공시 다음날 시가 매수 → 5D 종가 평균 수익률
  alpha5_trimmed      float,                 -- trimmed mean alpha 5D (상하 5% 제거)
  alpha20_trimmed     float,                 -- trimmed mean alpha 20D (상하 5% 제거)
  alpha20_median      float,                 -- median alpha 20D
  avg_mdd             float,                 -- 평균 최대 낙폭 (%)
  updated_at          timestamptz DEFAULT now(),
  PRIMARY KEY (event_type, bucket)
);

COMMENT ON TABLE  public.event_stats_by_bucket                    IS '시총 버킷별 이벤트 유형 통계 (EOD 배치 업데이트)';
COMMENT ON COLUMN public.event_stats_by_bucket.bucket             IS 'LARGE(시총 1조+) / MID(1000억~1조) / SMALL(1000억 미만)';
COMMENT ON COLUMN public.event_stats_by_bucket.hit_ratio          IS '5일 수익률 > 0 비율 — 공시 다음날 시가 매수 기준';
COMMENT ON COLUMN public.event_stats_by_bucket.alpha5_trimmed     IS 'trimmed mean alpha 5D: 상하 5% 제거 후 평균 (주식 수익률 - 벤치마크 수익률)';
COMMENT ON COLUMN public.event_stats_by_bucket.alpha20_trimmed    IS 'trimmed mean alpha 20D: 상하 5% 제거 후 평균';
COMMENT ON COLUMN public.event_stats_by_bucket.alpha20_median     IS 'median alpha 20D: 중앙값 (outlier 영향 최소)';

-- RLS
ALTER TABLE public.event_stats_by_bucket ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read event_stats_by_bucket"
  ON public.event_stats_by_bucket
  FOR SELECT
  USING (true);
