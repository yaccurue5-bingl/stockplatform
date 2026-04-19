-- ============================================================
-- Migration 033: performance_summary + sector_signals 컬럼 확장
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. performance_summary 추가 컬럼
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.performance_summary
  ADD COLUMN IF NOT EXISTS avg_win          NUMERIC,   -- 승리 트레이드 평균 수익(%)
  ADD COLUMN IF NOT EXISTS avg_loss         NUMERIC,   -- 패배 트레이드 평균 손실(%, 음수값)
  ADD COLUMN IF NOT EXISTS expectancy       NUMERIC,   -- 기댓값 = win_rate*avg_win - loss_rate*|avg_loss|
  ADD COLUMN IF NOT EXISTS equity_curve_json JSONB;    -- 누적 equity curve [{date, equity}]

-- ────────────────────────────────────────────────────────────
-- 2. sector_signals 추가 컬럼
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.sector_signals
  ADD COLUMN IF NOT EXISTS avg_return_3d  NUMERIC,   -- 섹터 내 종목 평균 T+3 수익률(%)
  ADD COLUMN IF NOT EXISTS win_rate       NUMERIC,   -- 승률 0~1
  ADD COLUMN IF NOT EXISTS score         NUMERIC,   -- 섹터 signal strength 0~100
  ADD COLUMN IF NOT EXISTS risk_on_ratio  NUMERIC,   -- RISK_ON 종목 비율 0~1
  ADD COLUMN IF NOT EXISTS top_stocks     JSONB;     -- 상위 종목 [{stock_code, return_3d, base_score}]
