-- =========================================
-- KSIC (한국표준산업분류) Support
-- =========================================
-- Migration: 003_add_ksic_support.sql
-- Description: KSIC 코드 테이블 및 companies 테이블 확장

-- =========================================
-- 1. KSIC 코드 참조 테이블 생성
-- =========================================

-- KSIC 코드 마스터 테이블 (한국표준산업분류 전체 코드)
CREATE TABLE IF NOT EXISTS public.ksic_codes (
  ksic_code TEXT PRIMARY KEY,           -- KSIC 코드 (예: "26110", "21")
  ksic_name TEXT NOT NULL,              -- KSIC 분류명 (예: "반도체 제조업")
  division_code TEXT,                   -- 대분류 코드 (1자리)
  division_name TEXT,                   -- 대분류명
  major_code TEXT,                      -- 중분류 코드 (2자리)
  major_name TEXT,                      -- 중분류명
  minor_code TEXT,                      -- 소분류 코드 (3자리)
  minor_name TEXT,                      -- 소분류명
  sub_code TEXT,                        -- 세분류 코드 (4자리)
  sub_name TEXT,                        -- 세분류명
  detail_code TEXT,                     -- 세세분류 코드 (5자리)
  detail_name TEXT,                     -- 세세분류명
  top_industry TEXT,                    -- 상위 업종 (서비스 분류용)
  description TEXT,                     -- 설명
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- KSIC 코드 인덱스
CREATE INDEX IF NOT EXISTS idx_ksic_codes_major ON public.ksic_codes(major_code);
CREATE INDEX IF NOT EXISTS idx_ksic_codes_top_industry ON public.ksic_codes(top_industry);
CREATE INDEX IF NOT EXISTS idx_ksic_codes_name ON public.ksic_codes(ksic_name);

-- KSIC 코드 테이블 코멘트
COMMENT ON TABLE public.ksic_codes IS '한국표준산업분류(KSIC) 코드 마스터 테이블';
COMMENT ON COLUMN public.ksic_codes.ksic_code IS 'KSIC 코드 (최대 5자리)';
COMMENT ON COLUMN public.ksic_codes.top_industry IS '서비스에서 사용하는 상위 업종 분류';

-- =========================================
-- 2. companies 테이블에 KSIC 필드 추가
-- =========================================

-- KSIC 관련 컬럼 추가
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS ksic_code TEXT REFERENCES public.ksic_codes(ksic_code),
  ADD COLUMN IF NOT EXISTS ksic_name TEXT,
  ADD COLUMN IF NOT EXISTS industry_category TEXT,
  ADD COLUMN IF NOT EXISTS corp_code TEXT,  -- DART 기업코드
  ADD COLUMN IF NOT EXISTS ksic_updated_at TIMESTAMP WITH TIME ZONE;

-- KSIC 관련 인덱스
CREATE INDEX IF NOT EXISTS idx_companies_ksic_code ON public.companies(ksic_code);
CREATE INDEX IF NOT EXISTS idx_companies_industry_category ON public.companies(industry_category);
CREATE INDEX IF NOT EXISTS idx_companies_corp_code ON public.companies(corp_code);

-- 컬럼 코멘트
COMMENT ON COLUMN public.companies.ksic_code IS 'KSIC 산업분류코드 (DART에서 가져옴)';
COMMENT ON COLUMN public.companies.ksic_name IS 'KSIC 산업분류명';
COMMENT ON COLUMN public.companies.industry_category IS '상위 업종 분류 (반도체, 바이오 등)';
COMMENT ON COLUMN public.companies.corp_code IS 'DART 기업코드 (8자리)';
COMMENT ON COLUMN public.companies.ksic_updated_at IS 'KSIC 정보 최종 업데이트 시각';

-- =========================================
-- 3. KSIC 통계 뷰 생성
-- =========================================

-- 업종별 기업 수 통계 뷰
CREATE OR REPLACE VIEW public.industry_statistics AS
SELECT
  industry_category,
  COUNT(*) as company_count,
  COUNT(DISTINCT market) as market_count,
  array_agg(DISTINCT market ORDER BY market) as markets
FROM public.companies
WHERE industry_category IS NOT NULL
GROUP BY industry_category
ORDER BY company_count DESC;

COMMENT ON VIEW public.industry_statistics IS '업종별 기업 통계';

-- KSIC 중분류별 기업 수 통계 뷰
CREATE OR REPLACE VIEW public.ksic_major_statistics AS
SELECT
  SUBSTRING(c.ksic_code, 1, 2) as major_code,
  k.major_name,
  c.industry_category,
  COUNT(*) as company_count,
  array_agg(c.name_kr ORDER BY c.name_kr) as company_names
FROM public.companies c
LEFT JOIN public.ksic_codes k ON c.ksic_code = k.ksic_code
WHERE c.ksic_code IS NOT NULL
GROUP BY SUBSTRING(c.ksic_code, 1, 2), k.major_name, c.industry_category
ORDER BY company_count DESC;

COMMENT ON VIEW public.ksic_major_statistics IS 'KSIC 중분류별 기업 통계';

-- =========================================
-- 4. Triggers (Updated_at 자동 업데이트)
-- =========================================

-- KSIC 코드 테이블 updated_at 트리거
DROP TRIGGER IF EXISTS update_ksic_codes_updated_at ON public.ksic_codes;

CREATE TRIGGER update_ksic_codes_updated_at
  BEFORE UPDATE ON public.ksic_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================
-- 5. RLS (Row Level Security) 설정
-- =========================================

-- KSIC 코드 테이블 RLS (모든 인증 사용자 읽기 가능)
ALTER TABLE public.ksic_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view ksic codes" ON public.ksic_codes;

CREATE POLICY "Authenticated users can view ksic codes"
  ON public.ksic_codes
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- =========================================
-- 6. Helper Functions
-- =========================================

-- KSIC 코드에서 중분류 추출 함수
CREATE OR REPLACE FUNCTION public.get_ksic_major_code(ksic_code TEXT)
RETURNS TEXT AS $$
BEGIN
  IF ksic_code IS NULL OR LENGTH(ksic_code) < 2 THEN
    RETURN NULL;
  END IF;

  -- 숫자만 추출하여 앞 2자리 반환
  RETURN SUBSTRING(regexp_replace(ksic_code, '[^0-9]', '', 'g'), 1, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.get_ksic_major_code IS 'KSIC 코드에서 중분류(2자리) 추출';

-- 기업의 KSIC 정보 업데이트 함수
CREATE OR REPLACE FUNCTION public.update_company_ksic(
  p_stock_code TEXT,
  p_ksic_code TEXT,
  p_ksic_name TEXT DEFAULT NULL,
  p_industry_category TEXT DEFAULT NULL,
  p_corp_code TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.companies
  SET
    ksic_code = p_ksic_code,
    ksic_name = COALESCE(p_ksic_name, ksic_name),
    industry_category = COALESCE(p_industry_category, industry_category),
    corp_code = COALESCE(p_corp_code, corp_code),
    ksic_updated_at = NOW(),
    updated_at = NOW()
  WHERE code = p_stock_code;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.update_company_ksic IS '기업의 KSIC 정보 업데이트 (종목코드 기준)';

-- =========================================
-- 7. 초기 데이터 (rule_table 기반 상위 업종)
-- =========================================

-- KSIC 중분류 기반 상위 업종 매핑 (industry_classifier의 rule_table.py와 동기화)
INSERT INTO public.ksic_codes (ksic_code, ksic_name, major_code, major_name, top_industry) VALUES
  -- 제조업 - 전자/반도체
  ('26', '전자부품, 컴퓨터, 영상, 음향 및 통신장비 제조업', '26', '전자부품, 컴퓨터, 영상, 음향 및 통신장비 제조업', '반도체와 반도체장비'),
  ('27', '의료, 정밀, 광학기기 및 시계 제조업', '27', '의료, 정밀, 광학기기 및 시계 제조업', '디스플레이·전자부품'),
  ('28', '전기장비 제조업', '28', '전기장비 제조업', '전기장비'),

  -- 제조업 - 화학/소재
  ('20', '화학물질 및 화학제품 제조업', '20', '화학물질 및 화학제품 제조업', '화학'),
  ('21', '의료용 물질 및 의약품 제조업', '21', '의료용 물질 및 의약품 제조업', '바이오·제약'),
  ('22', '고무제품 및 플라스틱제품 제조업', '22', '고무제품 및 플라스틱제품 제조업', '고무·플라스틱'),
  ('23', '비금속 광물제품 제조업', '23', '비금속 광물제품 제조업', '비금속광물'),
  ('24', '1차 금속 제조업', '24', '1차 금속 제조업', '2차전지·소재'),
  ('25', '금속가공제품 제조업', '25', '금속가공제품 제조업', '금속가공'),

  -- 제조업 - 기계/운송
  ('29', '기타 기계 및 장비 제조업', '29', '기타 기계 및 장비 제조업', '자동차'),
  ('30', '자동차 및 트레일러 제조업', '30', '자동차 및 트레일러 제조업', '방산·항공'),
  ('31', '기타 운송장비 제조업', '31', '기타 운송장비 제조업', '기계·설비'),

  -- 제조업 - 생활소비재
  ('10', '식료품 제조업', '10', '식료품 제조업', '식품'),
  ('11', '음료 제조업', '11', '음료 제조업', '음료'),
  ('12', '담배 제조업', '12', '담배 제조업', '담배'),
  ('13', '섬유제품 제조업', '13', '섬유제품 제조업', '섬유'),
  ('14', '의복, 의복액세서리 및 모피제품 제조업', '14', '의복, 의복액세서리 및 모피제품 제조업', '의복·패션'),
  ('15', '가죽, 가방 및 신발 제조업', '15', '가죽, 가방 및 신발 제조업', '가죽·신발'),
  ('16', '목재 및 나무제품 제조업', '16', '목재 및 나무제품 제조업', '목재·종이'),
  ('17', '펄프, 종이 및 종이제품 제조업', '17', '펄프, 종이 및 종이제품 제조업', '출판·인쇄'),
  ('18', '인쇄 및 기록매체 복제업', '18', '인쇄 및 기록매체 복제업', '석유·화학제품'),
  ('19', '코크스, 연탄 및 석유정제품 제조업', '19', '코크스, 연탄 및 석유정제품 제조업', '1차금속'),

  -- IT·서비스
  ('58', '출판업', '58', '출판업', '출판·미디어'),
  ('59', '영상·오디오 기록물 제작 및 배급업', '59', '영상·오디오 기록물 제작 및 배급업', '영상·방송'),
  ('60', '방송업', '60', '방송업', '통신·방송'),
  ('61', '우편 및 통신업', '61', '우편 및 통신업', '통신'),
  ('62', '컴퓨터 프로그래밍, 시스템 통합 및 관리업', '62', '컴퓨터 프로그래밍, 시스템 통합 및 관리업', 'IT·소프트웨어'),
  ('63', '정보서비스업', '63', '정보서비스업', '정보서비스'),

  -- 금융
  ('64', '금융업', '64', '금융업', '금융'),
  ('65', '보험 및 연금업', '65', '보험 및 연금업', '보험·연금'),
  ('66', '금융 및 보험 관련 서비스업', '66', '금융 및 보험 관련 서비스업', '금융지원서비스'),

  -- 유통·서비스
  ('45', '도매 및 소매업', '45', '도매 및 소매업', '건설'),
  ('46', '도매 및 상품중개업', '46', '도매 및 상품중개업', '도매'),
  ('47', '소매업', '47', '소매업', '소매'),
  ('49', '육상운송 및 파이프라인 운송업', '49', '육상운송 및 파이프라인 운송업', '운송'),
  ('50', '수상 운송업', '50', '수상 운송업', '창고·물류'),
  ('51', '항공 운송업', '51', '항공 운송업', '항공'),
  ('52', '창고 및 운송관련 서비스업', '52', '창고 및 운송관련 서비스업', '창고·운송'),
  ('55', '숙박업', '55', '숙박업', '숙박'),
  ('56', '음식점 및 주점업', '56', '음식점 및 주점업', '음식점'),

  -- 전문서비스
  ('70', '부동산업', '70', '부동산업', '부동산'),
  ('71', '임대업', '71', '임대업', '전문·과학·기술서비스'),
  ('72', '전문, 과학 및 기술 서비스업', '72', '전문, 과학 및 기술 서비스업', '연구개발'),
  ('73', '사업시설관리 및 사업지원 서비스업', '73', '사업시설관리 및 사업지원 서비스업', '광고·시장조사'),
  ('74', '사업지원 서비스업', '74', '사업지원 서비스업', '전문서비스'),
  ('75', '공공행정, 국방 및 사회보장 행정', '75', '공공행정, 국방 및 사회보장 행정', '사업지원서비스'),

  -- 공공·교육·의료
  ('84', '공공행정, 국방 및 사회보장 행정', '84', '공공행정, 국방 및 사회보장 행정', '공공행정'),
  ('85', '교육 서비스업', '85', '교육 서비스업', '교육'),
  ('86', '보건업 및 사회복지 서비스업', '86', '보건업 및 사회복지 서비스업', '보건·의료'),
  ('87', '사회복지 서비스업', '87', '사회복지 서비스업', '사회복지'),
  ('88', '예술, 스포츠 및 여가관련 서비스업', '88', '예술, 스포츠 및 여가관련 서비스업', '예술·스포츠·여가'),
  ('90', '창작, 예술 및 여가관련 서비스업', '90', '창작, 예술 및 여가관련 서비스업', '창작·예술'),
  ('91', '도서관, 사적지 및 유사 여가관련 서비스업', '91', '도서관, 사적지 및 유사 여가관련 서비스업', '도서관·박물관'),

  -- 기타
  ('01', '농업', '01', '농업', '농업'),
  ('02', '임업', '02', '임업', '임업'),
  ('03', '어업', '03', '어업', '어업'),
  ('05', '석탄, 원유 및 천연가스 광업', '05', '석탄, 원유 및 천연가스 광업', '석탄·광업'),
  ('06', '금속 광업', '06', '금속 광업', '원유·가스'),
  ('07', '비금속광물 광업', '07', '비금속광물 광업', '금속광업'),
  ('08', '광업 지원 서비스업', '08', '광업 지원 서비스업', '비금속광물'),
  ('35', '전기, 가스, 증기 및 공기조절 공급업', '35', '전기, 가스, 증기 및 공기조절 공급업', '전기·가스'),
  ('36', '수도업', '36', '수도업', '수도'),
  ('37', '하수, 폐수 및 분뇨 처리업', '37', '하수, 폐수 및 분뇨 처리업', '하수·폐기물'),
  ('38', '폐기물 수집운반, 처리 및 원료재생업', '38', '폐기물 수집운반, 처리 및 원료재생업', '환경·복원'),
  ('39', '환경 정화 및 복원업', '39', '환경 정화 및 복원업', '환경정화'),
  ('41', '종합 건설업', '41', '종합 건설업', '건설'),
  ('42', '전문직별 공사업', '42', '전문직별 공사업', '토목'),
  ('43', '건설업', '43', '건설업', '전문건설')
ON CONFLICT (ksic_code) DO NOTHING;

-- =========================================
-- 완료
-- =========================================

-- 확인용 쿼리
DO $$
BEGIN
  RAISE NOTICE '✓ KSIC 지원 마이그레이션 완료';
  RAISE NOTICE '  - ksic_codes 테이블 생성 완료';
  RAISE NOTICE '  - companies 테이블 KSIC 필드 추가 완료';
  RAISE NOTICE '  - 통계 뷰 생성 완료';
  RAISE NOTICE '  - Helper 함수 생성 완료';
  RAISE NOTICE '  - 초기 KSIC 중분류 데이터 삽입 완료';
END $$;
