-- ============================================================
-- Migration 030: price_history 테이블
-- ============================================================
-- 목적: fetch_market_data.py가 매일 수집하는 종가·거래량을
--       영구 이력으로 보존한다.
--
-- 활용:
--   - backtest 엔진의 T+3 / T+5 가격 조회 (data.go.kr API 콜 절감)
--   - volume spike 조건 계산 (rolling avg 가능)
--   - future_return_3d 계산용 price fetch 캐시
-- ============================================================

-- 1. 테이블 생성
CREATE TABLE IF NOT EXISTS public.price_history (
  stock_code  text    NOT NULL,
  date        date    NOT NULL,
  close       float,           -- 종가 (clpr)
  volume      bigint,          -- 거래량 (trqu)
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stock_code, date)
);

-- 2. 인덱스
CREATE INDEX IF NOT EXISTS price_history_date_idx
  ON public.price_history (date DESC);

CREATE INDEX IF NOT EXISTS price_history_stock_date_idx
  ON public.price_history (stock_code, date DESC);

-- 3. RLS
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- service role: 전체 접근 (fetch_market_data.py, backfill_prices.py)
CREATE POLICY "service_full_price_history"
  ON public.price_history FOR ALL
  USING (true) WITH CHECK (true);

-- 인증 유저: 조회만 허용 (향후 API 노출 시 활용)
CREATE POLICY "users_select_price_history"
  ON public.price_history FOR SELECT
  USING (auth.uid() IS NOT NULL);
