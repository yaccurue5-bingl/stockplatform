-- 055_add_reddit_posted_at_to_disclosure_insights.sql
-- Reddit 수동 게시 추적용 컬럼 + 인덱스 (tweeted_at과 동일 패턴, 별도 트래킹)

ALTER TABLE public.disclosure_insights
  ADD COLUMN IF NOT EXISTS reddit_posted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.disclosure_insights.reddit_posted_at
  IS 'Reddit 게시 시각; NULL = 아직 Reddit에 안 올림';

-- 미게시 항목 빠른 조회용 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_disclosure_insights_reddit_queue
  ON public.disclosure_insights (rcept_dt DESC, ABS(sentiment_score) DESC)
  WHERE reddit_posted_at IS NULL
    AND analysis_status = 'completed'
    AND is_visible = TRUE;
