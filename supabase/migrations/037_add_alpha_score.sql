-- migration 037: alpha_score 컬럼 추가
-- disclosure_insights: 통합 알파 스코어 저장
-- scores_log: 동일 컬럼 추가 (백테스트·시계열 분석용)

ALTER TABLE disclosure_insights
  ADD COLUMN IF NOT EXISTS alpha_score FLOAT;

ALTER TABLE scores_log
  ADD COLUMN IF NOT EXISTS alpha_score FLOAT;

COMMENT ON COLUMN disclosure_insights.alpha_score IS
  'FINAL_ALPHA_SCORE = base_score×0.5 + sector_score×0.2 + market_score×0.1 + regime_score×0.2 (범위 2.5~97.5)';

COMMENT ON COLUMN scores_log.alpha_score IS
  'FINAL_ALPHA_SCORE — compute_alpha_score.py 계산 결과';
