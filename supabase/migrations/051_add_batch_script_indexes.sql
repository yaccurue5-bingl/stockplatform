-- GitHub Actions 배치 스크립트 statement timeout 방지용 partial index 3개
--
-- 문제: compute_base_score.py / auto_analyst.py 가 disclosure_insights 전체 스캔
--       → Supabase PostgREST statement timeout (57014) 발생
-- 해결: 각 쿼리 패턴에 맞는 partial index 추가 → Index Scan으로 전환

-- ① compute_base_score.py: completed + score 있음 + base_score 미계산
CREATE INDEX IF NOT EXISTS idx_insights_base_score_pending
ON public.disclosure_insights (rcept_dt DESC)
WHERE analysis_status = 'completed'
  AND sentiment_score IS NOT NULL
  AND base_score IS NULL;

-- ② auto_analyst.py (일반 모드): pending 항목 분석 대기열
CREATE INDEX IF NOT EXISTS idx_insights_analysis_pending
ON public.disclosure_insights (rcept_dt DESC)
WHERE analysis_status = 'pending';

-- ③ auto_analyst.py (backfill 모드): completed지만 sentiment_score 누락
CREATE INDEX IF NOT EXISTS idx_insights_backfill_pending
ON public.disclosure_insights (rcept_dt DESC)
WHERE analysis_status = 'completed'
  AND sentiment_score IS NULL
  AND content IS NOT NULL;
