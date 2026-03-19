-- =========================================
-- Migration 025: scores_log 테이블 생성
-- 스코어 히스토리 저장 (백테스트 + 성능 측정용)
-- =========================================

CREATE TABLE IF NOT EXISTS public.scores_log (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_code      TEXT    NOT NULL,
    date            DATE    NOT NULL,
    disclosure_id   UUID    REFERENCES public.disclosure_insights(id) ON DELETE SET NULL,

    -- 점수
    base_score_raw  FLOAT,   -- s + i + e (0~100, 정규화 전)
    base_score      FLOAT,   -- sigmoid 정규화 후 (0~100)
    lps             FLOAT,   -- Loan Pressure Score (0~100)
    final_score     FLOAT,   -- BaseScore * (1 - min(LPS/100, 0.4))

    -- 보정 태그
    signal_tag      TEXT,    -- "⚠️ Smart Money Selling" 등

    -- 사후 검증 (배치로 업데이트)
    future_return_5d  FLOAT, -- 5일 후 실제 수익률 (%) - 사후 기입
    future_return_20d FLOAT, -- 20일 후 실제 수익률 (%) - 사후 기입

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE (stock_code, date, disclosure_id)
);

COMMENT ON TABLE  public.scores_log                  IS '공시별 스코어 히스토리 (백테스트 및 모델 성능 측정)';
COMMENT ON COLUMN public.scores_log.future_return_5d IS '사후 기입: 공시일 +5영업일 수익률. 모델 검증에 사용';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_scores_log_stock_date
    ON public.scores_log(stock_code, date DESC);

CREATE INDEX IF NOT EXISTS idx_scores_log_date
    ON public.scores_log(date DESC);

CREATE INDEX IF NOT EXISTS idx_scores_log_final_score
    ON public.scores_log(final_score DESC NULLS LAST);

-- service role 정책
ALTER TABLE public.scores_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access scores_log" ON public.scores_log;
CREATE POLICY "Service role full access scores_log"
    ON public.scores_log FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Authenticated users can view scores_log" ON public.scores_log;
CREATE POLICY "Authenticated users can view scores_log"
    ON public.scores_log FOR SELECT
    USING (auth.role() = 'authenticated');
