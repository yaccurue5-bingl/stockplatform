-- ============================================================
-- 041_create_market_index_history.sql
-- 주가지수 시세 이력 테이블 (KOSPI / KOSDAQ / KOSPI200)
--
-- 목적:
--   - 백테스트 벤치마크 계산 (Alpha = 종목수익률 - 지수수익률)
--   - 장기적으로 시장 레짐 분류에 활용
--
-- 데이터 출처:
--   data.go.kr GetMarketIndexInfoService / getStockMarketIndex
--   수집 스크립트: scripts/fetch_index_data.py
-- ============================================================

CREATE TABLE IF NOT EXISTS public.market_index_history (
  index_code   text    NOT NULL,   -- 'KOSPI' | 'KOSDAQ' | 'KOSPI200'
  date         date    NOT NULL,
  close        float,              -- 종가
  open         float,              -- 시가
  high         float,              -- 고가
  low          float,              -- 저가
  change_rate  float,              -- 등락률 (%)
  trade_value  bigint,             -- 거래대금 (백만원 단위)
  market_cap   bigint,             -- 상장시가총액 (백만원 단위)
  updated_at   timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (index_code, date)
);

COMMENT ON TABLE  public.market_index_history           IS '주가지수 일별 시세 이력 (data.go.kr 수집)';
COMMENT ON COLUMN public.market_index_history.index_code IS 'KOSPI | KOSDAQ | KOSPI200';
COMMENT ON COLUMN public.market_index_history.trade_value IS '거래대금 (백만원)';
COMMENT ON COLUMN public.market_index_history.market_cap  IS '상장시가총액 (백만원)';

-- 날짜 범위 조회용 인덱스 (백테스트에서 date 기준 범위 조회 多)
CREATE INDEX IF NOT EXISTS market_index_history_date_idx
  ON public.market_index_history (date DESC);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.market_index_history ENABLE ROW LEVEL SECURITY;

-- 프론트엔드(anon/authenticated)에서 직접 읽을 가능성 있으므로 SELECT 허용
CREATE POLICY "Public read market_index_history"
  ON public.market_index_history
  FOR SELECT
  USING (true);

-- service_role 은 RLS bypass → 별도 write 정책 불필요
