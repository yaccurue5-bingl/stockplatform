-- =========================================
-- Migration 023: loan_stats 테이블 생성
-- 대차잔고 + 거래량 히스토리 (LPS 계산용)
-- 데이터 소스: GetStocLendBorrInfoService (대차잔고)
--              GetStockSecuritiesInfoService (거래량)
-- =========================================

CREATE TABLE IF NOT EXISTS public.loan_stats (
    stock_code    TEXT    NOT NULL,
    date          DATE    NOT NULL,

    -- 원본 데이터
    loan_balance  BIGINT,          -- L_t: 대차잔고 (GetStocLendBorrInfoService)
    volume        BIGINT,          -- V_t: 거래량 (GetStockSecuritiesInfoService.trqu)

    -- 계산 결과 (compute_loan_pressure.py)
    loan_delta    FLOAT,           -- (L_t - L_t-5) / (L_t-5 + 1e-6)
    loan_z        FLOAT,           -- (loan_delta - mean_20d) / (std_20d + 1e-6)
    volume_ratio  FLOAT,           -- V_t / (avg_V_20d + 1e-6)
    lps           FLOAT,           -- Loan Pressure Score: sigmoid(loan_z * volume_ratio * 2.5) * 100

    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    PRIMARY KEY (stock_code, date)
);

COMMENT ON TABLE  public.loan_stats                IS '종목별 대차잔고 및 Loan Pressure Score 히스토리';
COMMENT ON COLUMN public.loan_stats.loan_balance   IS '대차잔고 (GetStocLendBorrInfoService)';
COMMENT ON COLUMN public.loan_stats.volume         IS '거래량 (GetStockSecuritiesInfoService.trqu)';
COMMENT ON COLUMN public.loan_stats.loan_delta     IS '5일 대차증가율: (L_t - L_t-5) / (L_t-5 + 1e-6)';
COMMENT ON COLUMN public.loan_stats.loan_z         IS 'Z-score 정규화: (loan_delta - mean_20d) / (std_20d + 1e-6)';
COMMENT ON COLUMN public.loan_stats.volume_ratio   IS '20일 평균 대비 거래량 비율';
COMMENT ON COLUMN public.loan_stats.lps            IS 'Loan Pressure Score 0~100 (70↑=공매도압력, 30↓=숏커버링)';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_loan_stats_stock_date
    ON public.loan_stats(stock_code, date DESC);

CREATE INDEX IF NOT EXISTS idx_loan_stats_date
    ON public.loan_stats(date DESC);

CREATE INDEX IF NOT EXISTS idx_loan_stats_lps
    ON public.loan_stats(lps DESC NULLS LAST);

-- service role 정책
ALTER TABLE public.loan_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access loan_stats" ON public.loan_stats;
CREATE POLICY "Service role full access loan_stats"
    ON public.loan_stats FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Authenticated users can view loan_stats" ON public.loan_stats;
CREATE POLICY "Authenticated users can view loan_stats"
    ON public.loan_stats FOR SELECT
    USING (auth.role() = 'authenticated');
