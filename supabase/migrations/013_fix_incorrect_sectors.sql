-- =========================================
-- 잘못 분류된 종목 업종 수정
-- =========================================
-- 지주회사가 아닌데 지주회사로 분류된 종목들 수정

-- 1. 화학 계열
UPDATE public.companies SET sector = '화학'
WHERE stock_code IN (
  '051910'   -- LG화학 (KSIC 20111)
);

-- 2. 전기장비/2차전지 계열
UPDATE public.companies SET sector = '전기장비'
WHERE stock_code IN (
  '006400',  -- 삼성SDI (KSIC 28202)
  '373220'   -- LG에너지솔루션 (KSIC 28202)
);

-- 3. 자동차 계열
UPDATE public.companies SET sector = '자동차'
WHERE stock_code IN (
  '005380',  -- 현대차 (KSIC 30121)
  '000270',  -- 기아 (KSIC 30121)
  '012330',  -- 현대모비스 (KSIC 30121)
  '018880',  -- 한온시스템
  '161390',  -- 한국타이어앤테크놀로지
  '000240'   -- 한국타이어
);

-- 4. 운송장비 (조선/항공)
UPDATE public.companies SET sector = '운송장비'
WHERE stock_code IN (
  '329180',  -- HD현대중공업 (KSIC 31)
  '042660',  -- 한화오션 (KSIC 31)
  '010140',  -- 삼성중공업 (KSIC 31)
  '012450'   -- 한화에어로스페이스 (KSIC 31)
);

-- 5. 통신
UPDATE public.companies SET sector = '통신'
WHERE stock_code IN (
  '017670'   -- SK텔레콤 (KSIC 61)
);

-- 6. IT·소프트웨어
UPDATE public.companies SET sector = 'IT·소프트웨어'
WHERE stock_code IN (
  '036570'   -- 엔씨소프트 (KSIC 62)
);

-- 7. 식품
UPDATE public.companies SET sector = '식품'
WHERE stock_code IN (
  '005180',  -- 빙그레
  '097950',  -- CJ제일제당
  '007310',  -- 오뚜기
  '271560',  -- 오리온
  '280360',  -- 롯데웰푸드
  '004370',  -- 농심
  '014710'   -- 사조대림
);

-- 8. 전기·가스
UPDATE public.companies SET sector = '전기·가스'
WHERE stock_code IN (
  '051600'   -- 한전KPS
);

-- 9. 건설
UPDATE public.companies SET sector = '건설'
WHERE stock_code IN (
  '000720',  -- 현대건설
  '047040',  -- 대우건설
  '034300',  -- 신세계건설
  '006360'   -- GS건설
);

-- 10. 화학/건자재
UPDATE public.companies SET sector = '화학'
WHERE stock_code IN (
  '009830',  -- 한화솔루션
  '002380'   -- KCC
);

-- 11. 전기장비
UPDATE public.companies SET sector = '전기장비'
WHERE stock_code IN (
  '010120',  -- LS일렉트릭
  '011210'   -- 현대위아
);

-- 12. 금융 (은행/보험 - 지주회사 아님)
UPDATE public.companies SET sector = '금융'
WHERE stock_code IN (
  '024110'   -- 기업은행
);

UPDATE public.companies SET sector = '보험·연금'
WHERE stock_code IN (
  '000810',  -- 삼성화재
  '032830',  -- 삼성생명
  '088350',  -- 한화생명
  '005830',  -- DB손해보험
  '001450'   -- 현대해상
);

-- 13. 소비재
UPDATE public.companies SET sector = '의복·패션'
WHERE stock_code IN (
  '051900'   -- LG생활건강
);

-- =========================================
-- 결과 확인
-- =========================================
-- SELECT stock_code, corp_name, sector
-- FROM public.companies
-- WHERE stock_code IN ('051910', '006400', '005380', '000270', '017670')
-- ORDER BY stock_code;
