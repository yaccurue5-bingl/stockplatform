-- =========================================
-- 지주회사 업종 세분화 (KSIC 64992만 해당)
-- =========================================
-- 실제 지주회사(KSIC 64992)만 세분화
-- 다른 종목들은 DART KSIC 기반 rule_table.py가 자동 매핑

-- 세분화된 지주회사 업종을 sectors 테이블에 추가
INSERT INTO public.sectors (name, description) VALUES
  ('지주회사(전자·화학)', 'LG 등 전자/화학 계열 지주회사'),
  ('지주회사(반도체·ICT)', 'SK 등 반도체/ICT 계열 지주회사'),
  ('지주회사(방산·에너지)', '한화 등 방산/에너지 계열 지주회사'),
  ('지주회사(유통·식품)', '롯데, CJ 등 유통/식품 계열 지주회사'),
  ('지주회사(에너지·인프라)', 'GS 등 에너지/인프라 계열 지주회사'),
  ('지주회사(전선·전기)', 'LS 등 전선/전기 계열 지주회사'),
  ('지주회사(기계·건설)', '두산 등 기계/건설 계열 지주회사'),
  ('지주회사(금융)', '금융 계열 지주회사')
ON CONFLICT (name) DO NOTHING;

-- =========================================
-- 실제 지주회사만 업데이트 (KSIC 64992)
-- =========================================

-- 전자·화학 계열 지주회사
UPDATE public.companies SET sector = '지주회사(전자·화학)'
WHERE stock_code IN (
  '003550'   -- LG (지주회사)
);

-- 반도체·ICT 계열 지주회사
UPDATE public.companies SET sector = '지주회사(반도체·ICT)'
WHERE stock_code IN (
  '034730'   -- SK (지주회사)
);

-- 방산·에너지 계열 지주회사
UPDATE public.companies SET sector = '지주회사(방산·에너지)'
WHERE stock_code IN (
  '000880'   -- 한화 (지주회사)
);

-- 유통·식품 계열 지주회사
UPDATE public.companies SET sector = '지주회사(유통·식품)'
WHERE stock_code IN (
  '004990',  -- 롯데지주 (지주회사)
  '001040'   -- CJ (지주회사)
);

-- 에너지·인프라 계열 지주회사
UPDATE public.companies SET sector = '지주회사(에너지·인프라)'
WHERE stock_code IN (
  '078930',  -- GS (지주회사)
  '267250'   -- HD현대 (지주회사)
);

-- 전선·전기 계열 지주회사
UPDATE public.companies SET sector = '지주회사(전선·전기)'
WHERE stock_code IN (
  '006260'   -- LS (지주회사)
);

-- 기계·건설 계열 지주회사
UPDATE public.companies SET sector = '지주회사(기계·건설)'
WHERE stock_code IN (
  '000150'   -- 두산 (지주회사)
);

-- 금융 계열 지주회사 (KSIC 64992)
UPDATE public.companies SET sector = '지주회사(금융)'
WHERE stock_code IN (
  '055550',  -- 신한지주
  '086790',  -- 하나금융지주
  '105560',  -- KB금융
  '138930',  -- BNK금융지주
  '139130',  -- DGB금융지주
  '316140'   -- 우리금융지주
);

-- =========================================
-- 주의: 아래 종목들은 지주회사가 아님!
-- DART KSIC 기반으로 rule_table.py가 자동 매핑
-- =========================================
-- LG화학 (051910) → 화학 (KSIC 20)
-- 삼성SDI (006400) → 전기장비 (KSIC 28)
-- 현대차 (005380) → 자동차 (KSIC 30)
-- 기아 (000270) → 자동차 (KSIC 30)
-- 삼성바이오 (207940) → 바이오·제약 (KSIC 21)
-- 등등...
