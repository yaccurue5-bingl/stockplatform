-- ============================================================
-- Migration 039: price_history 테이블에 open(시가) 컬럼 추가
-- ============================================================
-- 목적: Hot Stocks M_score 계산에 필요한 D+1 open 가격 저장
--       price_1d = D+1 close / D+1 open - 1
-- ============================================================

ALTER TABLE public.price_history
  ADD COLUMN IF NOT EXISTS open float;

COMMENT ON COLUMN public.price_history.open IS '시가(시초가) — fetch_market_data.py mkp 필드';
