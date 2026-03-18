-- migration 021: companies 테이블 파이프라인 불필요 컬럼 제거
--
-- 제거 대상 (이유):
--   code        → stock_code 완전 중복 (일부만 채워짐)
--   market      → market_type 완전 중복 (일부만 채워짐)
--   full_code   → ISIN 코드, 파이프라인 미사용
--   close_price → 일별 가격 데이터 (파이프라인 범위 외)
--   open_price  → 일별 가격 데이터
--   high_price  → 일별 가격 데이터
--   low_price   → 일별 가격 데이터
--   volume      → 일별 거래량
--   trade_value → 일별 거래대금
--
-- 최종 컬럼 구성:
--   stock_code (PK), corp_name, sector, sector_en,
--   market_type, market_cap, listed_shares, foreign_ratio,
--   created_at, updated_at

ALTER TABLE public.companies
  DROP COLUMN IF EXISTS code,
  DROP COLUMN IF EXISTS market,
  DROP COLUMN IF EXISTS full_code,
  DROP COLUMN IF EXISTS close_price,
  DROP COLUMN IF EXISTS open_price,
  DROP COLUMN IF EXISTS high_price,
  DROP COLUMN IF EXISTS low_price,
  DROP COLUMN IF EXISTS volume,
  DROP COLUMN IF EXISTS trade_value;
