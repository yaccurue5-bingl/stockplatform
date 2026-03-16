-- =========================================
-- Migration 017: companies 테이블 확장
-- market_cap, foreign_ratio, listed_shares 컬럼 추가
-- 데이터 소스: data.go.kr KRX 상장종목정보 API (15094775)
-- =========================================

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS market_cap BIGINT,         -- 시가총액 (원)
  ADD COLUMN IF NOT EXISTS listed_shares BIGINT,      -- 상장주식수
  ADD COLUMN IF NOT EXISTS foreign_ratio NUMERIC(5,2); -- 외국인보유비율 (%)

-- 인덱스 추가 (시가총액 기준 정렬 빈번)
CREATE INDEX IF NOT EXISTS idx_companies_market_cap ON public.companies(market_cap DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_companies_market ON public.companies(market);
