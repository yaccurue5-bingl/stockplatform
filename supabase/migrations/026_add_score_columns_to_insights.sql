-- =========================================
-- Migration 026: disclosure_insights 스코어 컬럼 추가
-- BaseScore + FinalScore 계산 결과 저장
-- =========================================

ALTER TABLE public.disclosure_insights
    ADD COLUMN IF NOT EXISTS sentiment_score  FLOAT,   -- AI 연속값 -1.0 ~ +1.0 (auto_analyst.py)
    ADD COLUMN IF NOT EXISTS base_score_raw   FLOAT,   -- s + i + e (0~100, 정규화 전)
    ADD COLUMN IF NOT EXISTS base_score       FLOAT,   -- sigmoid 정규화 후 (0~100)
    ADD COLUMN IF NOT EXISTS final_score      FLOAT,   -- BaseScore * (1 - loan_weight)
    ADD COLUMN IF NOT EXISTS signal_tag       TEXT;    -- "⚠️ Smart Money Selling" 등

COMMENT ON COLUMN public.disclosure_insights.sentiment_score IS 'AI 연속 감성값 -1~+1. s = ((score+1)/2)*40';
COMMENT ON COLUMN public.disclosure_insights.base_score_raw  IS 'BaseScore 정규화 전: s(0~40) + i(0~30) + e(0~30)';
COMMENT ON COLUMN public.disclosure_insights.base_score      IS 'BaseScore 정규화 후: sigmoid((raw-50)/10)*100';
COMMENT ON COLUMN public.disclosure_insights.final_score     IS 'FinalScore: base_score * (1 - min(LPS/100, 0.4))';
COMMENT ON COLUMN public.disclosure_insights.signal_tag      IS '상황별 보정 태그 (Smart Money Selling 등)';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_insights_final_score
    ON public.disclosure_insights(final_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_insights_base_score
    ON public.disclosure_insights(base_score DESC NULLS LAST);
