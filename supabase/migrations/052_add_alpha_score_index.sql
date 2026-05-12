-- compute_alpha_score.py statement timeout (57014) 방지용 partial index
--
-- 문제: compute_alpha_score.py 가 disclosure_insights 전체 스캔
--       → WHERE base_score IS NOT NULL AND alpha_score IS NULL 쿼리 → timeout
-- 해결: 해당 쿼리 패턴에 맞는 partial index 추가 → Index Scan으로 전환

CREATE INDEX IF NOT EXISTS idx_insights_alpha_score_pending
ON public.disclosure_insights (rcept_dt DESC)
WHERE analysis_status = 'completed'
  AND base_score IS NOT NULL
  AND alpha_score IS NULL;
