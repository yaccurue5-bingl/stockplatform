-- ============================================================
-- Migration 040: financials 테이블 F_score 관련 컬럼 추가
-- ============================================================
-- 목적: EMF Hot Score의 F(Fundamental) 컴포넌트 계산에 필요한
--       재무상태표 항목 + F_score pre-compute 컬럼 추가
--
-- F_score (0~100) = 수익성/성장성/안정성 각 지표 percentile 평균
--   ROE           = net_profit / total_equity
--   op_margin     = op_profit  / revenue
--   rev_yoy       = (revenue_t - revenue_t-1) / |revenue_t-1|
--   op_profit_yoy = (op_profit_t - op_profit_t-1) / |op_profit_t-1|
--   debt_ratio    = total_liabilities / total_equity  (낮을수록 좋음 → 역순)
--
-- F_adjustment = 0.5 + F_score / 200  (범위: 0.50 ~ 1.00)
-- Hot_score    = E_adj × sigmoid(max(0, M_score)) × F_adjustment
-- ============================================================

ALTER TABLE public.financials
  ADD COLUMN IF NOT EXISTS total_assets      bigint,
  ADD COLUMN IF NOT EXISTS total_liabilities bigint,
  ADD COLUMN IF NOT EXISTS total_equity      bigint,
  ADD COLUMN IF NOT EXISTS roe               float,
  ADD COLUMN IF NOT EXISTS op_margin         float,
  ADD COLUMN IF NOT EXISTS rev_yoy           float,
  ADD COLUMN IF NOT EXISTS op_profit_yoy     float,
  ADD COLUMN IF NOT EXISTS f_score           float;

COMMENT ON COLUMN public.financials.total_assets      IS '자산총계 (원)';
COMMENT ON COLUMN public.financials.total_liabilities IS '부채총계 (원)';
COMMENT ON COLUMN public.financials.total_equity      IS '자본총계 (원)';
COMMENT ON COLUMN public.financials.roe               IS 'ROE = net_profit / total_equity';
COMMENT ON COLUMN public.financials.op_margin         IS '영업이익률 = op_profit / revenue';
COMMENT ON COLUMN public.financials.rev_yoy           IS '매출 YoY 성장률';
COMMENT ON COLUMN public.financials.op_profit_yoy     IS '영업이익 YoY 성장률';
COMMENT ON COLUMN public.financials.f_score           IS 'F_score (0~100) — compute_f_score.py로 계산';

-- f_score 조회 인덱스 (Hot Stocks 쿼리에서 stock_code로 조회)
CREATE INDEX IF NOT EXISTS financials_stock_code_fiscal_year_idx
  ON public.financials (stock_code, fiscal_year DESC);
