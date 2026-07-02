-- disclosure_insights는 분석 파이프라인이 기존 행을 계속 UPDATE한다
-- (is_visible, analysis_status, final_score, scores 등) — 이 UPDATE 패턴이
-- 신규 INSERT보다 훨씬 빠르게 dead tuple/heap bloat을 쌓는다.
--
-- 기본 autovacuum_vacuum_scale_factor(0.2 = 20%)로는 vacuum이 너무 늦게 트리거되어
-- visibility map이 계속 stale해지고, get_disclosure_companies() 등 DISTINCT ON
-- 커버링 인덱스 쿼리가 Index Only Scan 대신 Heap Fetches를 대량 발생시켜
-- 10초 이상 걸리다 statement timeout으로 실패하는 문제가 반복됐다
-- (2026-05-11, 2026-05-13, 2026-07-02 — 매번 수동 VACUUM ANALYZE로만 임시 해결).
--
-- 이 테이블만 훨씬 더 공격적인 autovacuum 임계값을 적용해 visibility map을
-- 상시 최신 상태로 유지한다 (수동 개입 없이 재발 방지).
ALTER TABLE public.disclosure_insights SET (
  autovacuum_vacuum_scale_factor  = 0.02,  -- 기본 20% → 2%: dead tuple 2%만 넘어도 vacuum
  autovacuum_vacuum_threshold     = 500,
  autovacuum_analyze_scale_factor = 0.02,
  autovacuum_analyze_threshold    = 500
);
