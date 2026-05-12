-- 047_add_tweeted_at_to_disclosure_insights.sql
-- X(Twitter) 자동 게시 추적용 컬럼 + 인덱스

ALTER TABLE public.disclosure_insights
  ADD COLUMN IF NOT EXISTS tweeted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.disclosure_insights.tweeted_at
  IS 'X(Twitter) 게시 시각; NULL = 아직 트윗 안 됨';

-- 미게시 항목 빠른 조회용 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_disclosure_insights_tweet_queue
  ON public.disclosure_insights (rcept_dt DESC, ABS(sentiment_score) DESC)
  WHERE tweeted_at IS NULL
    AND analysis_status = 'completed'
    AND is_visible = TRUE;
