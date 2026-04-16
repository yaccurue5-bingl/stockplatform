-- ============================================================
-- Migration 032: backtest_trades + performance_summary 테이블
-- ============================================================
-- 목적: event_macro_v1 전략 백테스트 결과를 영구 저장한다.
--
-- compute_backtest.py 가 scores_log + daily_indicators 를 읽어
-- 매매 시뮬레이션을 실행한 뒤 두 테이블에 upsert 한다.
--
-- 전략 스펙 (event_macro_v1):
--   - Entry 조건: base_score >= 60  AND  market_regime = RISK_ON
--   - RISK_ON 정의: 공시일 직전 3거래일 foreign_net_buy_kospi 합계 > 0
--   - Exit: T+3 영업일 (future_return_3d 사용)
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 1. backtest_trades  (개별 매매 기록)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.backtest_trades (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_name   TEXT        NOT NULL,                        -- e.g. 'event_macro_v1'
  stock_code      TEXT        NOT NULL,
  event_date      DATE        NOT NULL,                        -- 공시일 (scores_log.date)
  disclosure_id   UUID        REFERENCES public.disclosure_insights(id) ON DELETE SET NULL,
  base_score      FLOAT,                                       -- 진입 시점 base_score
  final_score     FLOAT,                                       -- 진입 시점 final_score
  return_3d       FLOAT,                                       -- T+3 수익률 (%)
  return_5d       FLOAT,                                       -- T+5 수익률 (%)
  market_regime   TEXT        CHECK (market_regime IN ('RISK_ON','RISK_OFF')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (strategy_name, disclosure_id)
);

CREATE INDEX IF NOT EXISTS backtest_trades_strategy_idx
  ON public.backtest_trades (strategy_name, event_date DESC);

CREATE INDEX IF NOT EXISTS backtest_trades_stock_idx
  ON public.backtest_trades (stock_code, event_date DESC);

-- RLS
ALTER TABLE public.backtest_trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_full_backtest_trades"
  ON public.backtest_trades FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "users_select_backtest_trades"
  ON public.backtest_trades FOR SELECT
  USING (auth.uid() IS NOT NULL);


-- ────────────────────────────────────────────────────────────
-- 2. performance_summary  (전략별 집계)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.performance_summary (
  strategy_name     TEXT        PRIMARY KEY,
  total_return      FLOAT,      -- 모든 거래 단순 합산 수익률 (%)
  annualized_return FLOAT,      -- 연환산 수익률 (%)
  win_rate          FLOAT,      -- 승률 (0–1)
  avg_return        FLOAT,      -- 거래당 평균 수익률 (%)
  max_drawdown      FLOAT,      -- 최대 낙폭 (%)
  sharpe_ratio      FLOAT,      -- Sharpe ratio (무위험 0%)
  total_trades      INTEGER,    -- 총 거래 수
  risk_on_trades    INTEGER,    -- RISK_ON 진입 거래 수
  score_threshold   FLOAT,      -- 진입 base_score 임계값
  holding_days      TEXT,       -- 'T+3'
  period_start      DATE,       -- 백테스트 시작일
  period_end        DATE,       -- 백테스트 종료일
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.performance_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_full_performance_summary"
  ON public.performance_summary FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "users_select_performance_summary"
  ON public.performance_summary FOR SELECT
  USING (auth.uid() IS NOT NULL);
