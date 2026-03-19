-- =========================================
-- Migration 024: event_stats 테이블 생성
-- 이벤트 타입별 수익률 통계 (BaseScore 계산용)
-- 데이터 소스: disclosure_events + 주가 데이터
-- =========================================

CREATE TABLE IF NOT EXISTS public.event_stats (
    event_type      TEXT    PRIMARY KEY,
    avg_1d_return   FLOAT,           -- 1일 평균 수익률 (%)
    avg_3d_return   FLOAT,           -- 3일 평균 수익률 (%)
    avg_5d_return   FLOAT,           -- 5일 평균 수익률 (%) ← BaseScore 계산에 사용
    avg_20d_return  FLOAT,           -- 20일 평균 수익률 (%)
    std_5d          FLOAT,           -- 5일 수익률 표준편차
    sample_size     INTEGER,         -- 표본 수
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE  public.event_stats               IS '이벤트 타입별 과거 수익률 통계 (BaseScore 계산용)';
COMMENT ON COLUMN public.event_stats.avg_5d_return IS 'BaseScore event component: min(max((avg_5d+3)/6*30, 0), 30)';
COMMENT ON COLUMN public.event_stats.sample_size   IS '통계 신뢰도 기준: 30건 미만이면 avg=0 fallback';

-- service role 정책
ALTER TABLE public.event_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access event_stats" ON public.event_stats;
CREATE POLICY "Service role full access event_stats"
    ON public.event_stats FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Authenticated users can view event_stats" ON public.event_stats;
CREATE POLICY "Authenticated users can view event_stats"
    ON public.event_stats FOR SELECT
    USING (auth.role() = 'authenticated');
