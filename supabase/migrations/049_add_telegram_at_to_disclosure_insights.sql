-- Telegram 전용 게시 타임스탬프 (tweeted_at은 Twitter 전용으로 분리)
ALTER TABLE public.disclosure_insights
ADD COLUMN IF NOT EXISTS telegram_at TIMESTAMPTZ DEFAULT NULL;

-- Telegram 미게시 항목 빠른 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_insights_telegram_pending
ON public.disclosure_insights (final_score DESC)
WHERE telegram_at IS NULL
  AND analysis_status = 'completed'
  AND is_visible = TRUE;

COMMENT ON COLUMN public.disclosure_insights.telegram_at
  IS 'Telegram 채널(@KMI_Signals) 게시 타임스탬프. NULL이면 미게시. tweeted_at(Twitter)과 독립.';
