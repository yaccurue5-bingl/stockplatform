-- migration 022: companies 테이블 기업 상세 정보 컬럼 추가
-- 출처: GetCorpBasicInfoService_V2 / GetStockSecuritiesInfoService

ALTER TABLE public.companies
  -- GetCorpBasicInfoService_V2 / getCorpOutline_V2
  ADD COLUMN IF NOT EXISTS representative       TEXT,    -- 대표자명 (enpRprFnm)
  ADD COLUMN IF NOT EXISTS established_at       DATE,    -- 설립일자 (enpEstbDt)
  ADD COLUMN IF NOT EXISTS employee_count       INTEGER, -- 직원수 (enpEmpeCnt)
  ADD COLUMN IF NOT EXISTS homepage_url         TEXT,    -- 홈페이지 URL (enpHmpgUrl)
  ADD COLUMN IF NOT EXISTS corp_reg_no          TEXT,    -- 법인등록번호 (crno)

  -- GetStockSecuritiesInfoService / getStockPriceInfo
  ADD COLUMN IF NOT EXISTS foreign_hold_shares  BIGINT;  -- 외국인 보유주식수 (frinInvstHldShrs)
  -- foreign_ratio(외국인보유비율%) 컬럼은 기존에 존재 (migration 017)

COMMENT ON COLUMN public.companies.representative      IS '대표자명 (GetCorpBasicInfoService_V2)';
COMMENT ON COLUMN public.companies.established_at      IS '설립일자 (GetCorpBasicInfoService_V2)';
COMMENT ON COLUMN public.companies.employee_count      IS '직원수 (GetCorpBasicInfoService_V2)';
COMMENT ON COLUMN public.companies.homepage_url        IS '홈페이지 URL (GetCorpBasicInfoService_V2)';
COMMENT ON COLUMN public.companies.corp_reg_no         IS '법인등록번호 (GetCorpBasicInfoService_V2)';
COMMENT ON COLUMN public.companies.foreign_hold_shares IS '외국인 보유주식수 (GetStockSecuritiesInfoService)';
COMMENT ON COLUMN public.companies.foreign_ratio       IS '외국인 보유비율 % = foreign_hold_shares/listed_shares*100';
