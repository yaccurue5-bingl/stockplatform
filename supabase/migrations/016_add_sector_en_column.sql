-- =========================================
-- Add sector_en Column to Sectors Table
-- =========================================
-- GICS 기반 영문 섹터명을 저장하는 컬럼 추가

-- 1. sectors 테이블에 sector_en 컬럼 추가
ALTER TABLE public.sectors
  ADD COLUMN IF NOT EXISTS sector_en TEXT;

-- 2. GICS 기반 영문 섹터명 매핑 업데이트
-- Technology 그룹
UPDATE public.sectors SET sector_en = 'Semiconductors, IT & Displays' WHERE name = '반도체와 반도체장비';
UPDATE public.sectors SET sector_en = 'Semiconductors, IT & Displays' WHERE name = '디스플레이·전자부품';
UPDATE public.sectors SET sector_en = 'Semiconductors, IT & Displays' WHERE name = 'IT·소프트웨어';
UPDATE public.sectors SET sector_en = 'Semiconductors, IT & Displays' WHERE name = '정보서비스';

-- Mobility 그룹
UPDATE public.sectors SET sector_en = 'Automobiles, Aerospace & Logistics' WHERE name = '자동차';
UPDATE public.sectors SET sector_en = 'Automobiles, Aerospace & Logistics' WHERE name = '방산·항공';
UPDATE public.sectors SET sector_en = 'Automobiles, Aerospace & Logistics' WHERE name = '항공';
UPDATE public.sectors SET sector_en = 'Automobiles, Aerospace & Logistics' WHERE name = '운송';
UPDATE public.sectors SET sector_en = 'Automobiles, Aerospace & Logistics' WHERE name = '창고·물류';
UPDATE public.sectors SET sector_en = 'Automobiles, Aerospace & Logistics' WHERE name = '창고·운송';

-- Healthcare 그룹
UPDATE public.sectors SET sector_en = 'Healthcare & Biotech' WHERE name = '바이오·제약';
UPDATE public.sectors SET sector_en = 'Healthcare & Biotech' WHERE name = '전문·과학·기술서비스';
UPDATE public.sectors SET sector_en = 'Healthcare & Biotech' WHERE name = '연구개발';
UPDATE public.sectors SET sector_en = 'Healthcare & Biotech' WHERE name = '보건·의료';

-- Finance 그룹
UPDATE public.sectors SET sector_en = 'Financial Services' WHERE name = '금융';
UPDATE public.sectors SET sector_en = 'Financial Services' WHERE name = '금융지원서비스';
UPDATE public.sectors SET sector_en = 'Financial Services' WHERE name = '보험·연금';
UPDATE public.sectors SET sector_en = 'Financial Services' WHERE name = '전문서비스';

-- Materials 그룹
UPDATE public.sectors SET sector_en = 'Materials & Chemicals' WHERE name = '화학';
UPDATE public.sectors SET sector_en = 'Materials & Chemicals' WHERE name = '2차전지·소재';
UPDATE public.sectors SET sector_en = 'Materials & Chemicals' WHERE name = '고무·플라스틱';
UPDATE public.sectors SET sector_en = 'Materials & Chemicals' WHERE name = '금속가공';
UPDATE public.sectors SET sector_en = 'Materials & Chemicals' WHERE name = '비금속광물';
UPDATE public.sectors SET sector_en = 'Materials & Chemicals' WHERE name = '1차금속';
UPDATE public.sectors SET sector_en = 'Materials & Chemicals' WHERE name = '석유·화학제품';
UPDATE public.sectors SET sector_en = 'Materials & Chemicals' WHERE name = '섬유';

-- Media 그룹
UPDATE public.sectors SET sector_en = 'Media & Entertainment' WHERE name = '출판·미디어';
UPDATE public.sectors SET sector_en = 'Media & Entertainment' WHERE name = '영상·방송';
UPDATE public.sectors SET sector_en = 'Media & Entertainment' WHERE name = '통신·방송';
UPDATE public.sectors SET sector_en = 'Media & Entertainment' WHERE name = '창작·예술';
UPDATE public.sectors SET sector_en = 'Media & Entertainment' WHERE name = '광고·시장조사';
UPDATE public.sectors SET sector_en = 'Media & Entertainment' WHERE name = '출판·인쇄';
UPDATE public.sectors SET sector_en = 'Media & Entertainment' WHERE name = '통신';

-- Consumer 그룹
UPDATE public.sectors SET sector_en = 'Consumer Goods & Retail' WHERE name = '식품';
UPDATE public.sectors SET sector_en = 'Consumer Goods & Retail' WHERE name = '음료';
UPDATE public.sectors SET sector_en = 'Consumer Goods & Retail' WHERE name = '도매';
UPDATE public.sectors SET sector_en = 'Consumer Goods & Retail' WHERE name = '소매';
UPDATE public.sectors SET sector_en = 'Consumer Goods & Retail' WHERE name = '의복·패션';
UPDATE public.sectors SET sector_en = 'Consumer Goods & Retail' WHERE name = '가죽·신발';
UPDATE public.sectors SET sector_en = 'Consumer Goods & Retail' WHERE name = '담배';
UPDATE public.sectors SET sector_en = 'Consumer Goods & Retail' WHERE name = '숙박';
UPDATE public.sectors SET sector_en = 'Consumer Goods & Retail' WHERE name = '음식점';

-- Infrastructure 그룹
UPDATE public.sectors SET sector_en = 'Infrastructure & Energy' WHERE name = '건설';
UPDATE public.sectors SET sector_en = 'Infrastructure & Energy' WHERE name = '토목';
UPDATE public.sectors SET sector_en = 'Infrastructure & Energy' WHERE name = '전기장비';
UPDATE public.sectors SET sector_en = 'Infrastructure & Energy' WHERE name = '전기·가스';
UPDATE public.sectors SET sector_en = 'Infrastructure & Energy' WHERE name = '환경·복원';
UPDATE public.sectors SET sector_en = 'Infrastructure & Energy' WHERE name = '환경정화';
UPDATE public.sectors SET sector_en = 'Infrastructure & Energy' WHERE name = '전문건설';
UPDATE public.sectors SET sector_en = 'Infrastructure & Energy' WHERE name = '하수·폐기물';
UPDATE public.sectors SET sector_en = 'Infrastructure & Energy' WHERE name = '수도';

-- Industrial 그룹
UPDATE public.sectors SET sector_en = 'Industrial Machinery' WHERE name = '기계·설비';
UPDATE public.sectors SET sector_en = 'Industrial Machinery' WHERE name = '목재·종이';

-- Business 그룹
UPDATE public.sectors SET sector_en = 'Business & Services' WHERE name = '사업지원서비스';
UPDATE public.sectors SET sector_en = 'Business & Services' WHERE name = '부동산';
UPDATE public.sectors SET sector_en = 'Business & Services' WHERE name = '사회복지';

-- Others 그룹
UPDATE public.sectors SET sector_en = 'Education & Agriculture' WHERE name = '농업';
UPDATE public.sectors SET sector_en = 'Education & Agriculture' WHERE name = '어업';
UPDATE public.sectors SET sector_en = 'Education & Agriculture' WHERE name = '임업';
UPDATE public.sectors SET sector_en = 'Education & Agriculture' WHERE name = '교육';
UPDATE public.sectors SET sector_en = 'Education & Agriculture' WHERE name = '도서관·박물관';

-- Mining 그룹
UPDATE public.sectors SET sector_en = 'Mining & Resources' WHERE name = '석탄·광업';
UPDATE public.sectors SET sector_en = 'Mining & Resources' WHERE name = '원유·가스';
UPDATE public.sectors SET sector_en = 'Mining & Resources' WHERE name = '금속광업';

-- 기타/미분류
UPDATE public.sectors SET sector_en = 'Others' WHERE name = '기타';
UPDATE public.sectors SET sector_en = 'Unclassified' WHERE name = '미분류';
UPDATE public.sectors SET sector_en = 'Public Administration' WHERE name = '공공행정';
UPDATE public.sectors SET sector_en = 'Arts, Sports & Leisure' WHERE name = '예술·스포츠·여가';

-- 나머지 (sector_en이 NULL인 것들)에 기본값 설정
UPDATE public.sectors SET sector_en = 'Others' WHERE sector_en IS NULL;

-- 3. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_sectors_sector_en ON public.sectors(sector_en);

-- =========================================
-- 완료
-- =========================================
-- sectors.sector_en 컬럼이 추가되었습니다.
-- GICS 기반 영문 섹터명이 매핑되었습니다.
