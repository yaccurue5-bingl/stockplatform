-- =========================================
-- K-MarketInsight MVP Database Schema
-- =========================================

-- 1. users 테이블 (Supabase Auth 확장)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'FREE' CHECK (plan IN ('FREE', 'PRO')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT,
  subscription_status TEXT CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. companies 테이블 (KRX 종목 정보)
CREATE TABLE IF NOT EXISTS public.companies (
  code TEXT PRIMARY KEY,
  name_kr TEXT NOT NULL,
  name_en TEXT,
  market TEXT CHECK (market IN ('KOSPI', 'KOSDAQ')),
  sector TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. disclosure_insights 테이블 (DART 공시 AI 요약)
CREATE TABLE IF NOT EXISTS public.disclosure_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_code TEXT REFERENCES public.companies(code) ON DELETE CASCADE,
  title_kr TEXT NOT NULL,
  title_en TEXT,
  summary_kr TEXT,
  summary_en TEXT,
  sentiment TEXT CHECK (sentiment IN ('POSITIVE', 'NEGATIVE', 'NEUTRAL')),
  published_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. market_indices 테이블 (시장 지수)
CREATE TABLE IF NOT EXISTS public.market_indices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  index_name TEXT NOT NULL,
  value NUMERIC,
  change_percent NUMERIC,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =========================================
-- RLS (Row Level Security) 설정
-- =========================================

-- users 테이블 RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (재실행 시 충돌 방지)
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own email" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own data" ON public.users;

-- ✅ 사용자는 자기 자신의 데이터만 조회 가능
CREATE POLICY "Users can view their own data"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);

-- ✅ 사용자는 자기 자신의 이메일만 업데이트 가능 (plan은 서버에서만 변경)
CREATE POLICY "Users can update their own email"
  ON public.users
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ✅ 회원가입 시 자동으로 users 레코드 생성 (Supabase Function에서 처리)
CREATE POLICY "Users can insert their own data"
  ON public.users
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- companies 테이블 RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view companies" ON public.companies;

-- ✅ 모든 로그인 사용자는 종목 정보 조회 가능 (읽기 전용)
CREATE POLICY "Authenticated users can view companies"
  ON public.companies
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- disclosure_insights 테이블 RLS
ALTER TABLE public.disclosure_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FREE users can view recent insights" ON public.disclosure_insights;

-- ✅ FREE 사용자는 최근 7일 데이터만 조회 가능
CREATE POLICY "FREE users can view recent insights"
  ON public.disclosure_insights
  FOR SELECT
  USING (
    auth.role() = 'authenticated' AND
    (
      -- PRO 사용자는 모든 데이터 조회 가능
      EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid() AND users.plan = 'PRO'
      )
      OR
      -- FREE 사용자는 최근 7일만
      (
        published_at >= NOW() - INTERVAL '7 days' AND
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = auth.uid() AND users.plan = 'FREE'
        )
      )
    )
  );

-- market_indices 테이블 RLS
ALTER TABLE public.market_indices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view market indices" ON public.market_indices;

-- ✅ 모든 로그인 사용자는 시장 지수 조회 가능
CREATE POLICY "Authenticated users can view market indices"
  ON public.market_indices
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- =========================================
-- 인덱스 (성능 최적화)
-- =========================================

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON public.users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_disclosure_company_code ON public.disclosure_insights(company_code);
CREATE INDEX IF NOT EXISTS idx_disclosure_published_at ON public.disclosure_insights(published_at DESC);

-- =========================================
-- Functions & Triggers
-- =========================================

-- updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 기존 트리거 삭제 (재실행 시 충돌 방지)
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_companies_updated_at ON public.companies;

-- users 테이블 updated_at 트리거
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- companies 테이블 updated_at 트리거
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================
-- 회원가입 시 자동으로 users 테이블에 레코드 생성
-- =========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, plan)
  VALUES (NEW.id, NEW.email, 'FREE');
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- 이미 존재하는 경우 무시
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 기존 트리거 삭제
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- auth.users 테이블에 새 사용자 생성 시 트리거
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- =========================================
-- disclosure_insights 테이블 rcept_dt NULL 허용
-- =========================================
--
-- 목적: rcept_dt 컬럼의 NOT NULL 제약 조건을 제거하여
--       DART API에서 날짜 정보가 누락된 경우에도 데이터 저장 가능하도록 함
--
-- 주의: 이 migration은 선택 사항입니다.
--       크롤러에서 기본값 처리를 구현했으므로 실행하지 않아도 됩니다.
--       만약 rcept_dt를 필수값으로 유지하고 싶다면 이 파일을 삭제하세요.
-- =========================================

-- rcept_dt 컬럼이 존재하는 경우에만 NULL 허용으로 변경
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'disclosure_insights'
        AND column_name = 'rcept_dt'
    ) THEN
        -- NOT NULL 제약 조건 제거
        ALTER TABLE public.disclosure_insights
        ALTER COLUMN rcept_dt DROP NOT NULL;

        RAISE NOTICE 'rcept_dt 컬럼의 NOT NULL 제약 조건이 제거되었습니다.';
    ELSE
        RAISE NOTICE 'rcept_dt 컬럼이 존재하지 않습니다. 건너뜁니다.';
    END IF;
END $$;


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


-- =========================================
-- KSIC Columns Rename: Korean to English
-- =========================================
-- Migration: 004_rename_ksic_columns_to_english.sql
-- Description: ksic_codes 테이블의 한글 컬럼명을 영문으로 변경
--
-- Mapping:
--   산업코드 → ksic_code
--   산업내용 → ksic_name
--   상위업종 → top_industry (if exists)

-- =========================================
-- 1. Check if Korean columns exist and rename them
-- =========================================

-- 산업코드 → ksic_code 변경 (존재하는 경우)
DO $$
BEGIN
    -- Check if 산업코드 column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = '산업코드'
    ) THEN
        -- Check if ksic_code already exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'ksic_codes'
            AND column_name = 'ksic_code'
        ) THEN
            -- Rename 산업코드 to ksic_code
            ALTER TABLE public.ksic_codes RENAME COLUMN "산업코드" TO ksic_code;
            RAISE NOTICE '✓ Renamed column: 산업코드 → ksic_code';
        ELSE
            -- Copy data from 산업코드 to ksic_code and drop 산업코드
            EXECUTE 'UPDATE public.ksic_codes SET ksic_code = "산업코드" WHERE ksic_code IS NULL';
            EXECUTE 'ALTER TABLE public.ksic_codes DROP COLUMN "산업코드"';
            RAISE NOTICE '✓ Copied data from 산업코드 to ksic_code and dropped 산업코드';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ Column 산업코드 does not exist (already renamed or never existed)';
    END IF;
END $$;

-- 산업내용 → ksic_name 변경 (존재하는 경우)
DO $$
BEGIN
    -- Check if 산업내용 column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = '산업내용'
    ) THEN
        -- Check if ksic_name already exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'ksic_codes'
            AND column_name = 'ksic_name'
        ) THEN
            -- Rename 산업내용 to ksic_name
            ALTER TABLE public.ksic_codes RENAME COLUMN "산업내용" TO ksic_name;
            RAISE NOTICE '✓ Renamed column: 산업내용 → ksic_name';
        ELSE
            -- Copy data from 산업내용 to ksic_name and drop 산업내용
            EXECUTE 'UPDATE public.ksic_codes SET ksic_name = "산업내용" WHERE ksic_name IS NULL OR ksic_name = ''''';
            EXECUTE 'ALTER TABLE public.ksic_codes DROP COLUMN "산업내용"';
            RAISE NOTICE '✓ Copied data from 산업내용 to ksic_name and dropped 산업내용';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ Column 산업내용 does not exist (already renamed or never existed)';
    END IF;
END $$;

-- 상위업종 → top_industry 변경 (존재하는 경우)
DO $$
BEGIN
    -- Check if 상위업종 column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = '상위업종'
    ) THEN
        -- Check if top_industry already exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'ksic_codes'
            AND column_name = 'top_industry'
        ) THEN
            -- Rename 상위업종 to top_industry
            ALTER TABLE public.ksic_codes RENAME COLUMN "상위업종" TO top_industry;
            RAISE NOTICE '✓ Renamed column: 상위업종 → top_industry';
        ELSE
            -- Copy data from 상위업종 to top_industry and drop 상위업종
            EXECUTE 'UPDATE public.ksic_codes SET top_industry = "상위업종" WHERE top_industry IS NULL OR top_industry = ''''';
            EXECUTE 'ALTER TABLE public.ksic_codes DROP COLUMN "상위업종"';
            RAISE NOTICE '✓ Copied data from 상위업종 to top_industry and dropped 상위업종';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ Column 상위업종 does not exist (already renamed or never existed)';
    END IF;
END $$;

-- =========================================
-- 2. Ensure English columns exist with correct types
-- =========================================

-- Ensure ksic_code exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'ksic_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN ksic_code TEXT;
        RAISE NOTICE '✓ Added column: ksic_code';
    END IF;
END $$;

-- Ensure ksic_name exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'ksic_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN ksic_name TEXT;
        RAISE NOTICE '✓ Added column: ksic_name';
    END IF;
END $$;

-- Ensure top_industry exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'top_industry'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN top_industry TEXT;
        RAISE NOTICE '✓ Added column: top_industry';
    END IF;
END $$;

-- Ensure hierarchical columns exist (division, major, minor, sub, detail)
DO $$
BEGIN
    -- division_code
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'division_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN division_code TEXT;
        RAISE NOTICE '✓ Added column: division_code';
    END IF;

    -- division_name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'division_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN division_name TEXT;
        RAISE NOTICE '✓ Added column: division_name';
    END IF;

    -- major_code
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'major_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN major_code TEXT;
        RAISE NOTICE '✓ Added column: major_code';
    END IF;

    -- major_name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'major_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN major_name TEXT;
        RAISE NOTICE '✓ Added column: major_name';
    END IF;

    -- minor_code
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'minor_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN minor_code TEXT;
        RAISE NOTICE '✓ Added column: minor_code';
    END IF;

    -- minor_name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'minor_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN minor_name TEXT;
        RAISE NOTICE '✓ Added column: minor_name';
    END IF;

    -- sub_code
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'sub_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN sub_code TEXT;
        RAISE NOTICE '✓ Added column: sub_code';
    END IF;

    -- sub_name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'sub_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN sub_name TEXT;
        RAISE NOTICE '✓ Added column: sub_name';
    END IF;

    -- detail_code
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'detail_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN detail_code TEXT;
        RAISE NOTICE '✓ Added column: detail_code';
    END IF;

    -- detail_name
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'detail_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN detail_name TEXT;
        RAISE NOTICE '✓ Added column: detail_name';
    END IF;

    -- description
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'description'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN description TEXT;
        RAISE NOTICE '✓ Added column: description';
    END IF;

    -- created_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE '✓ Added column: created_at';
    END IF;

    -- updated_at
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE '✓ Added column: updated_at';
    END IF;
END $$;

-- =========================================
-- 3. Update constraints if needed
-- =========================================

-- Drop old primary key if it exists on 산업코드
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND constraint_name LIKE '%산업코드%'
    ) THEN
        ALTER TABLE public.ksic_codes DROP CONSTRAINT IF EXISTS ksic_codes_pkey CASCADE;
        RAISE NOTICE '✓ Dropped old primary key constraint';
    END IF;
END $$;

-- Ensure primary key on ksic_code
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND constraint_type = 'PRIMARY KEY'
        AND constraint_name = 'ksic_codes_pkey'
    ) THEN
        ALTER TABLE public.ksic_codes ADD CONSTRAINT ksic_codes_pkey PRIMARY KEY (ksic_code);
        RAISE NOTICE '✓ Added primary key constraint on ksic_code';
    END IF;
EXCEPTION
    WHEN duplicate_table THEN
        RAISE NOTICE 'ℹ Primary key constraint already exists';
    WHEN others THEN
        RAISE NOTICE 'ℹ Could not add primary key: %', SQLERRM;
END $$;

-- =========================================
-- 4. Update indexes
-- =========================================

-- Recreate indexes if needed
CREATE INDEX IF NOT EXISTS idx_ksic_codes_name ON public.ksic_codes(ksic_name);
CREATE INDEX IF NOT EXISTS idx_ksic_codes_top_industry ON public.ksic_codes(top_industry);
CREATE INDEX IF NOT EXISTS idx_ksic_codes_major ON public.ksic_codes(major_code);

-- =========================================
-- 5. Update column comments
-- =========================================

COMMENT ON COLUMN public.ksic_codes.ksic_code IS 'KSIC 코드 (한국표준산업분류 코드, 최대 5자리)';
COMMENT ON COLUMN public.ksic_codes.ksic_name IS 'KSIC 산업명 (산업분류명칭)';
COMMENT ON COLUMN public.ksic_codes.top_industry IS '상위 업종 분류 (서비스용 카테고리)';

-- =========================================
-- 완료
-- =========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ KSIC Column Rename Migration Complete';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Renamed columns:';
    RAISE NOTICE '  - 산업코드 → ksic_code';
    RAISE NOTICE '  - 산업내용 → ksic_name';
    RAISE NOTICE '  - 상위업종 → top_industry';
    RAISE NOTICE '========================================';
END $$;


-- =========================================
-- Fix Missing Hierarchical Columns in KSIC Table
-- =========================================
-- Migration: 005_fix_missing_hierarchical_columns.sql
-- Description: Ensures all hierarchical columns (division, major, minor, sub, detail)
--              exist in ksic_codes table before creating indexes
--
-- This migration fixes the "column major_code does not exist" error
-- by ensuring all columns from the original schema are present
-- =========================================

-- =========================================
-- 1. Ensure all hierarchical columns exist
-- =========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Checking and adding missing columns...';
    RAISE NOTICE '========================================';

    -- division_code (대분류 코드)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'division_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN division_code TEXT;
        RAISE NOTICE '✓ Added column: division_code';
    ELSE
        RAISE NOTICE 'ℹ Column division_code already exists';
    END IF;

    -- division_name (대분류명)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'division_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN division_name TEXT;
        RAISE NOTICE '✓ Added column: division_name';
    ELSE
        RAISE NOTICE 'ℹ Column division_name already exists';
    END IF;

    -- major_code (중분류 코드) - THE CRITICAL ONE
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'major_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN major_code TEXT;
        RAISE NOTICE '✓ Added column: major_code';
    ELSE
        RAISE NOTICE 'ℹ Column major_code already exists';
    END IF;

    -- major_name (중분류명)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'major_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN major_name TEXT;
        RAISE NOTICE '✓ Added column: major_name';
    ELSE
        RAISE NOTICE 'ℹ Column major_name already exists';
    END IF;

    -- minor_code (소분류 코드)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'minor_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN minor_code TEXT;
        RAISE NOTICE '✓ Added column: minor_code';
    ELSE
        RAISE NOTICE 'ℹ Column minor_code already exists';
    END IF;

    -- minor_name (소분류명)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'minor_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN minor_name TEXT;
        RAISE NOTICE '✓ Added column: minor_name';
    ELSE
        RAISE NOTICE 'ℹ Column minor_name already exists';
    END IF;

    -- sub_code (세분류 코드)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'sub_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN sub_code TEXT;
        RAISE NOTICE '✓ Added column: sub_code';
    ELSE
        RAISE NOTICE 'ℹ Column sub_code already exists';
    END IF;

    -- sub_name (세분류명)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'sub_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN sub_name TEXT;
        RAISE NOTICE '✓ Added column: sub_name';
    ELSE
        RAISE NOTICE 'ℹ Column sub_name already exists';
    END IF;

    -- detail_code (세세분류 코드)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'detail_code'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN detail_code TEXT;
        RAISE NOTICE '✓ Added column: detail_code';
    ELSE
        RAISE NOTICE 'ℹ Column detail_code already exists';
    END IF;

    -- detail_name (세세분류명)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'detail_name'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN detail_name TEXT;
        RAISE NOTICE '✓ Added column: detail_name';
    ELSE
        RAISE NOTICE 'ℹ Column detail_name already exists';
    END IF;

    -- description (설명)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'description'
    ) THEN
        ALTER TABLE public.ksic_codes ADD COLUMN description TEXT;
        RAISE NOTICE '✓ Added column: description';
    ELSE
        RAISE NOTICE 'ℹ Column description already exists';
    END IF;
END $$;

-- =========================================
-- 2. Populate major_code if empty
-- =========================================

DO $$
DECLARE
    updated_count INTEGER;
    ksic_code_col_exists BOOLEAN;
    korean_col_exists BOOLEAN;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Populating major_code from ksic_code...';
    RAISE NOTICE '========================================';

    -- Check which column name exists (English or Korean)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'ksic_code'
    ) INTO ksic_code_col_exists;

    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = '산업코드'
    ) INTO korean_col_exists;

    -- Try to populate from English column name
    IF ksic_code_col_exists THEN
        UPDATE public.ksic_codes
        SET major_code = SUBSTRING(ksic_code, 1, 2)
        WHERE major_code IS NULL
        AND ksic_code IS NOT NULL
        AND LENGTH(ksic_code) >= 2;

        GET DIAGNOSTICS updated_count = ROW_COUNT;

        IF updated_count > 0 THEN
            RAISE NOTICE '✓ Updated % records with major_code from ksic_code', updated_count;
        ELSE
            RAISE NOTICE 'ℹ No records needed major_code update (from ksic_code)';
        END IF;

    -- Try to populate from Korean column name
    ELSIF korean_col_exists THEN
        EXECUTE 'UPDATE public.ksic_codes
                 SET major_code = SUBSTRING("산업코드", 1, 2)
                 WHERE major_code IS NULL
                 AND "산업코드" IS NOT NULL
                 AND LENGTH("산업코드") >= 2';

        GET DIAGNOSTICS updated_count = ROW_COUNT;

        IF updated_count > 0 THEN
            RAISE NOTICE '✓ Updated % records with major_code from 산업코드', updated_count;
        ELSE
            RAISE NOTICE 'ℹ No records needed major_code update (from 산업코드)';
        END IF;

    ELSE
        RAISE WARNING '⚠ Neither ksic_code nor 산업코드 column exists - cannot populate major_code';
    END IF;
END $$;

-- =========================================
-- 3. Ensure primary columns exist (ksic_code, ksic_name, top_industry)
-- =========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Ensuring primary columns exist...';
    RAISE NOTICE '========================================';

    -- Ensure ksic_code exists (might be named 산업코드)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'ksic_code'
    ) THEN
        -- Check if Korean column exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'ksic_codes'
            AND column_name = '산업코드'
        ) THEN
            -- Rename Korean to English
            ALTER TABLE public.ksic_codes RENAME COLUMN "산업코드" TO ksic_code;
            RAISE NOTICE '✓ Renamed 산업코드 → ksic_code';
        ELSE
            -- Create new column
            ALTER TABLE public.ksic_codes ADD COLUMN ksic_code TEXT;
            RAISE NOTICE '✓ Added column: ksic_code';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ Column ksic_code already exists';
    END IF;

    -- Ensure ksic_name exists (might be named 산업내용)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'ksic_name'
    ) THEN
        -- Check if Korean column exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'ksic_codes'
            AND column_name = '산업내용'
        ) THEN
            -- Rename Korean to English
            ALTER TABLE public.ksic_codes RENAME COLUMN "산업내용" TO ksic_name;
            RAISE NOTICE '✓ Renamed 산업내용 → ksic_name';
        ELSE
            -- Create new column
            ALTER TABLE public.ksic_codes ADD COLUMN ksic_name TEXT;
            RAISE NOTICE '✓ Added column: ksic_name';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ Column ksic_name already exists';
    END IF;

    -- Ensure top_industry exists (might be named 상위업종)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'top_industry'
    ) THEN
        -- Check if Korean column exists
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'ksic_codes'
            AND column_name = '상위업종'
        ) THEN
            -- Rename Korean to English
            ALTER TABLE public.ksic_codes RENAME COLUMN "상위업종" TO top_industry;
            RAISE NOTICE '✓ Renamed 상위업종 → top_industry';
        ELSE
            -- Create new column
            ALTER TABLE public.ksic_codes ADD COLUMN top_industry TEXT;
            RAISE NOTICE '✓ Added column: top_industry';
        END IF;
    ELSE
        RAISE NOTICE 'ℹ Column top_industry already exists';
    END IF;
END $$;

-- =========================================
-- 4. Ensure primary key on ksic_code
-- =========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Checking primary key...';
    RAISE NOTICE '========================================';

    -- Check if primary key exists on ksic_code
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = 'ksic_codes'
        AND kcu.column_name = 'ksic_code'
    ) THEN
        -- Try to add primary key
        BEGIN
            ALTER TABLE public.ksic_codes ADD CONSTRAINT ksic_codes_pkey PRIMARY KEY (ksic_code);
            RAISE NOTICE '✓ Added primary key constraint on ksic_code';
        EXCEPTION
            WHEN duplicate_table THEN
                RAISE NOTICE 'ℹ Primary key constraint already exists';
            WHEN others THEN
                RAISE NOTICE '⚠ Could not add primary key: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'ℹ Primary key on ksic_code already exists';
    END IF;
END $$;

-- =========================================
-- 5. Create or recreate indexes
-- =========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Creating indexes...';
    RAISE NOTICE '========================================';
END $$;

-- Drop existing indexes if they exist (to recreate them cleanly)
DROP INDEX IF EXISTS idx_ksic_codes_major;
DROP INDEX IF EXISTS idx_ksic_codes_top_industry;
DROP INDEX IF EXISTS idx_ksic_codes_name;

-- Recreate indexes
CREATE INDEX idx_ksic_codes_major ON public.ksic_codes(major_code);
CREATE INDEX idx_ksic_codes_top_industry ON public.ksic_codes(top_industry);
CREATE INDEX idx_ksic_codes_name ON public.ksic_codes(ksic_name);

-- =========================================
-- 6. Verify the fix
-- =========================================

DO $$
DECLARE
    major_code_exists BOOLEAN;
    index_exists BOOLEAN;
    sample_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Verifying fix...';
    RAISE NOTICE '========================================';

    -- Check if major_code column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND column_name = 'major_code'
    ) INTO major_code_exists;

    -- Check if index exists
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'ksic_codes'
        AND indexname = 'idx_ksic_codes_major'
    ) INTO index_exists;

    -- Count records with major_code
    SELECT COUNT(*) INTO sample_count
    FROM public.ksic_codes
    WHERE major_code IS NOT NULL;

    -- Report results
    IF major_code_exists THEN
        RAISE NOTICE '✓ Column major_code exists';
    ELSE
        RAISE WARNING '✗ Column major_code does NOT exist';
    END IF;

    IF index_exists THEN
        RAISE NOTICE '✓ Index idx_ksic_codes_major exists';
    ELSE
        RAISE WARNING '✗ Index idx_ksic_codes_major does NOT exist';
    END IF;

    RAISE NOTICE 'ℹ Records with major_code: %', sample_count;

    IF major_code_exists AND index_exists THEN
        RAISE NOTICE '========================================';
        RAISE NOTICE '✓✓✓ FIX COMPLETED SUCCESSFULLY ✓✓✓';
        RAISE NOTICE '========================================';
    ELSE
        RAISE WARNING '========================================';
        RAISE WARNING '⚠ FIX MAY BE INCOMPLETE - CHECK ABOVE';
        RAISE WARNING '========================================';
    END IF;
END $$;

-- =========================================
-- 7. Add column comments
-- =========================================

COMMENT ON COLUMN public.ksic_codes.division_code IS 'KSIC 대분류 코드 (1자리)';
COMMENT ON COLUMN public.ksic_codes.division_name IS 'KSIC 대분류명';
COMMENT ON COLUMN public.ksic_codes.major_code IS 'KSIC 중분류 코드 (2자리)';
COMMENT ON COLUMN public.ksic_codes.major_name IS 'KSIC 중분류명';
COMMENT ON COLUMN public.ksic_codes.minor_code IS 'KSIC 소분류 코드 (3자리)';
COMMENT ON COLUMN public.ksic_codes.minor_name IS 'KSIC 소분류명';
COMMENT ON COLUMN public.ksic_codes.sub_code IS 'KSIC 세분류 코드 (4자리)';
COMMENT ON COLUMN public.ksic_codes.sub_name IS 'KSIC 세분류명';
COMMENT ON COLUMN public.ksic_codes.detail_code IS 'KSIC 세세분류 코드 (5자리)';
COMMENT ON COLUMN public.ksic_codes.detail_name IS 'KSIC 세세분류명';
COMMENT ON COLUMN public.ksic_codes.description IS 'KSIC 코드 설명';


-- =========================================
-- Ensure KSIC Primary Key Constraint Exists
-- =========================================
-- Migration: 006_ensure_ksic_primary_key.sql
-- Description: Fixes the "there is no unique or exclusion constraint matching
--              the ON CONFLICT specification" error by ensuring a proper
--              primary key constraint exists on ksic_code column
--
-- This migration:
-- 1. Removes duplicate ksic_code values if any exist
-- 2. Ensures ksic_code is NOT NULL
-- 3. Drops and recreates the primary key constraint properly
-- =========================================

-- =========================================
-- 1. Remove duplicate ksic_code values
-- =========================================

DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Checking for duplicate ksic_code values...';
    RAISE NOTICE '========================================';

    -- Count duplicates
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT ksic_code, COUNT(*) as cnt
        FROM public.ksic_codes
        GROUP BY ksic_code
        HAVING COUNT(*) > 1
    ) duplicates;

    IF duplicate_count > 0 THEN
        RAISE NOTICE '⚠ Found % duplicate ksic_code values', duplicate_count;

        -- Keep only the most recent record for each ksic_code
        DELETE FROM public.ksic_codes
        WHERE ctid NOT IN (
            SELECT MAX(ctid)
            FROM public.ksic_codes
            GROUP BY ksic_code
        );

        RAISE NOTICE '✓ Removed duplicate ksic_code records';
    ELSE
        RAISE NOTICE 'ℹ No duplicate ksic_code values found';
    END IF;
END $$;

-- =========================================
-- 2. Remove NULL ksic_code values
-- =========================================

DO $$
DECLARE
    null_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Checking for NULL ksic_code values...';
    RAISE NOTICE '========================================';

    -- Count NULL values
    SELECT COUNT(*) INTO null_count
    FROM public.ksic_codes
    WHERE ksic_code IS NULL;

    IF null_count > 0 THEN
        RAISE NOTICE '⚠ Found % records with NULL ksic_code', null_count;

        -- Delete records with NULL ksic_code
        DELETE FROM public.ksic_codes
        WHERE ksic_code IS NULL;

        RAISE NOTICE '✓ Removed records with NULL ksic_code';
    ELSE
        RAISE NOTICE 'ℹ No NULL ksic_code values found';
    END IF;
END $$;

-- =========================================
-- 3. Drop existing primary key constraint (if exists)
-- =========================================

DO $$
DECLARE
    constraint_exists BOOLEAN;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Checking existing primary key constraint...';
    RAISE NOTICE '========================================';

    -- Check if any primary key exists on ksic_codes table
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'ksic_codes'
        AND constraint_type = 'PRIMARY KEY'
    ) INTO constraint_exists;

    IF constraint_exists THEN
        RAISE NOTICE '⚠ Existing primary key constraint found, dropping it...';

        -- Drop the constraint (using CASCADE to handle dependencies)
        ALTER TABLE public.ksic_codes DROP CONSTRAINT IF EXISTS ksic_codes_pkey CASCADE;

        RAISE NOTICE '✓ Dropped existing primary key constraint';
    ELSE
        RAISE NOTICE 'ℹ No existing primary key constraint found';
    END IF;
END $$;

-- =========================================
-- 4. Add PRIMARY KEY constraint on ksic_code
-- =========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Adding PRIMARY KEY constraint on ksic_code...';
    RAISE NOTICE '========================================';

    -- Add NOT NULL constraint first (if not already present)
    BEGIN
        ALTER TABLE public.ksic_codes ALTER COLUMN ksic_code SET NOT NULL;
        RAISE NOTICE '✓ Set ksic_code column to NOT NULL';
    EXCEPTION
        WHEN others THEN
            RAISE NOTICE 'ℹ ksic_code column already NOT NULL or error: %', SQLERRM;
    END;

    -- Add PRIMARY KEY constraint
    BEGIN
        ALTER TABLE public.ksic_codes ADD CONSTRAINT ksic_codes_pkey PRIMARY KEY (ksic_code);
        RAISE NOTICE '✓ Added PRIMARY KEY constraint on ksic_code';
    EXCEPTION
        WHEN duplicate_table THEN
            RAISE NOTICE 'ℹ Primary key constraint already exists';
        WHEN unique_violation THEN
            RAISE EXCEPTION '✗ Cannot add primary key: duplicate values exist in ksic_code column';
        WHEN others THEN
            RAISE EXCEPTION '✗ Failed to add primary key: %', SQLERRM;
    END;
END $$;

-- =========================================
-- 5. Verify the constraint
-- =========================================

DO $$
DECLARE
    pk_exists BOOLEAN;
    record_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Verifying PRIMARY KEY constraint...';
    RAISE NOTICE '========================================';

    -- Check if primary key exists on ksic_code
    SELECT EXISTS (
        SELECT 1 FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = 'ksic_codes'
        AND kcu.column_name = 'ksic_code'
    ) INTO pk_exists;

    -- Count total records
    SELECT COUNT(*) INTO record_count
    FROM public.ksic_codes;

    -- Report results
    IF pk_exists THEN
        RAISE NOTICE '✓ PRIMARY KEY constraint exists on ksic_code';
        RAISE NOTICE 'ℹ Total records in ksic_codes: %', record_count;
        RAISE NOTICE '========================================';
        RAISE NOTICE '✓✓✓ MIGRATION COMPLETED SUCCESSFULLY ✓✓✓';
        RAISE NOTICE '========================================';
    ELSE
        RAISE EXCEPTION '✗ PRIMARY KEY constraint does NOT exist on ksic_code - migration failed';
    END IF;
END $$;

-- =========================================
-- 6. Recreate foreign key constraints if needed
-- =========================================

-- Recreate foreign key from companies table to ksic_codes
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Checking foreign key constraints...';
    RAISE NOTICE '========================================';

    -- Check if foreign key exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_schema = 'public'
        AND table_name = 'companies'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%ksic_code%'
    ) THEN
        RAISE NOTICE 'ℹ Foreign key constraint already exists on companies.ksic_code';
    ELSE
        -- Check if companies table and ksic_code column exist
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'companies'
            AND column_name = 'ksic_code'
        ) THEN
            -- Add foreign key constraint
            BEGIN
                ALTER TABLE public.companies
                ADD CONSTRAINT companies_ksic_code_fkey
                FOREIGN KEY (ksic_code)
                REFERENCES public.ksic_codes(ksic_code);

                RAISE NOTICE '✓ Added foreign key constraint on companies.ksic_code';
            EXCEPTION
                WHEN foreign_key_violation THEN
                    RAISE NOTICE '⚠ Cannot add foreign key: invalid ksic_code values exist in companies table';
                WHEN others THEN
                    RAISE NOTICE '⚠ Could not add foreign key: %', SQLERRM;
            END;
        ELSE
            RAISE NOTICE 'ℹ companies.ksic_code column does not exist, skipping foreign key';
        END IF;
    END IF;
END $$;

-- =========================================
-- Complete
-- =========================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 006 Complete!';
    RAISE NOTICE '';
    RAISE NOTICE 'Summary:';
    RAISE NOTICE '  ✓ Removed duplicate ksic_code values';
    RAISE NOTICE '  ✓ Removed NULL ksic_code values';
    RAISE NOTICE '  ✓ Dropped old primary key constraint';
    RAISE NOTICE '  ✓ Added new PRIMARY KEY on ksic_code';
    RAISE NOTICE '  ✓ Verified constraint exists';
    RAISE NOTICE '';
    RAISE NOTICE 'The import script should now work correctly!';
    RAISE NOTICE '========================================';
END $$;


-- =========================================
-- Companies 테이블 정리
-- =========================================
-- Migration: 007_cleanup_companies_table.sql
-- Description: 중복 행 삭제, 불필요한 컬럼 제거, sector 초기화

-- =========================================
-- 1. 중복 행 삭제 (A가 붙은 코드 우선 삭제)
-- =========================================

-- 전략: code 컬럼에서 숫자만 추출하여 중복 찾기
-- 같은 숫자 코드에 대해 'A'가 붙은 것이 있으면 'A'가 붙은 것을 삭제

-- 1.1. 임시 테이블로 삭제할 행 식별
CREATE TEMP TABLE codes_to_delete AS
SELECT c1.code
FROM public.companies c1
WHERE c1.code LIKE 'A%'  -- 'A'로 시작하는 코드
  AND EXISTS (
    -- 'A'를 제거한 코드가 이미 존재하는 경우
    SELECT 1
    FROM public.companies c2
    WHERE c2.code = SUBSTRING(c1.code FROM 2)  -- 'A' 제거한 코드
  );

-- 1.2. 삭제 실행 전 확인 (로그 출력)
DO $$
DECLARE
  delete_count INTEGER;
  rec RECORD;
BEGIN
  SELECT COUNT(*) INTO delete_count FROM codes_to_delete;
  RAISE NOTICE '삭제할 중복 행 수: %', delete_count;

  IF delete_count > 0 THEN
    RAISE NOTICE '삭제할 코드 목록:';
    FOR rec IN SELECT code FROM codes_to_delete ORDER BY code LOOP
      RAISE NOTICE '  - %', rec.code;
    END LOOP;
  END IF;
END $$;

-- 1.3. 중복 행 삭제
DELETE FROM public.companies
WHERE code IN (SELECT code FROM codes_to_delete);

-- =========================================
-- 2. 불필요한 컬럼 삭제
-- =========================================

-- 2.1. industry_category 컬럼 삭제
ALTER TABLE public.companies
DROP COLUMN IF EXISTS industry_category CASCADE;

-- 2.2. corp_code 컬럼 삭제
ALTER TABLE public.companies
DROP COLUMN IF EXISTS corp_code CASCADE;

-- 2.3. ksic_name 컬럼 삭제
ALTER TABLE public.companies
DROP COLUMN IF EXISTS ksic_name CASCADE;

-- 2.4. ksic_updated_at 컬럼도 삭제 (ksic_code는 유지)
ALTER TABLE public.companies
DROP COLUMN IF EXISTS ksic_updated_at CASCADE;

-- =========================================
-- 3. sector 컬럼 초기화
-- =========================================

-- 3.1. sector 컬럼을 NULL로 초기화
UPDATE public.companies
SET sector = NULL;

-- 3.2. sector 컬럼 타입 확인 (이미 TEXT이지만 명시적으로 설정)
ALTER TABLE public.companies
ALTER COLUMN sector TYPE TEXT;

-- =========================================
-- 4. 관련 인덱스 정리
-- =========================================

-- 삭제된 컬럼의 인덱스는 CASCADE로 자동 삭제됨
-- 필요한 인덱스만 유지되는지 확인

DROP INDEX IF EXISTS idx_companies_industry_category;
DROP INDEX IF EXISTS idx_companies_corp_code;

-- =========================================
-- 5. 통계 뷰 업데이트
-- =========================================

-- industry_category를 사용하는 뷰 삭제
DROP VIEW IF EXISTS public.industry_statistics;

-- =========================================
-- 완료 및 결과 확인
-- =========================================

DO $$
DECLARE
  total_companies INTEGER;
  columns_list TEXT;
BEGIN
  -- 전체 기업 수 확인
  SELECT COUNT(*) INTO total_companies FROM public.companies;

  -- 현재 컬럼 목록 확인
  SELECT string_agg(column_name, ', ' ORDER BY ordinal_position)
  INTO columns_list
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'companies';

  RAISE NOTICE '✓ Companies 테이블 정리 완료';
  RAISE NOTICE '  - 중복 행 삭제 완료';
  RAISE NOTICE '  - 불필요한 컬럼 삭제: industry_category, corp_code, ksic_name, ksic_updated_at';
  RAISE NOTICE '  - sector 컬럼 NULL로 초기화 완료';
  RAISE NOTICE '  - 전체 기업 수: %', total_companies;
  RAISE NOTICE '  - 현재 컬럼: %', columns_list;
END $$;


-- =========================================
-- DART 기업코드(corp_code) 테이블 생성
-- =========================================
-- Migration: 008_add_dart_corp_codes_table.sql
-- Description: DART API에서 제공하는 corp_code 매핑 데이터를 DB에 저장
--              매번 XML 파일을 다운로드/파싱하지 않고 DB에서 조회하도록 개선

-- =========================================
-- 1. dart_corp_codes 테이블 생성
-- =========================================

CREATE TABLE IF NOT EXISTS public.dart_corp_codes (
  -- 기본 정보
  stock_code TEXT PRIMARY KEY,  -- 종목코드 (6자리, 예: "005930")
  corp_code TEXT NOT NULL,      -- 기업코드 (8자리, 예: "00126380")
  corp_name TEXT NOT NULL,      -- 기업명 (예: "삼성전자")
  modify_date TEXT,             -- DART 수정일자 (예: "20231201")

  -- 메타데이터
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- corp_code 유니크 제약 (하나의 corp_code는 여러 stock_code를 가질 수 없음)
  UNIQUE(corp_code)
);

-- =========================================
-- 2. 인덱스 생성
-- =========================================

-- corp_code로 빠른 검색
CREATE INDEX IF NOT EXISTS idx_dart_corp_codes_corp_code
  ON public.dart_corp_codes(corp_code);

-- corp_name으로 검색 (기업명 검색)
CREATE INDEX IF NOT EXISTS idx_dart_corp_codes_corp_name
  ON public.dart_corp_codes(corp_name);

-- modify_date로 검색 (최신 업데이트 확인용)
CREATE INDEX IF NOT EXISTS idx_dart_corp_codes_modify_date
  ON public.dart_corp_codes(modify_date DESC);

-- =========================================
-- 3. RLS (Row Level Security) 설정
-- =========================================

ALTER TABLE public.dart_corp_codes ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제 (재실행 시 충돌 방지)
DROP POLICY IF EXISTS "Authenticated users can view dart_corp_codes" ON public.dart_corp_codes;

-- ✅ 모든 로그인 사용자는 corp_code 정보 조회 가능 (읽기 전용)
CREATE POLICY "Authenticated users can view dart_corp_codes"
  ON public.dart_corp_codes
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- =========================================
-- 4. updated_at 자동 업데이트 트리거
-- =========================================

DROP TRIGGER IF EXISTS update_dart_corp_codes_updated_at ON public.dart_corp_codes;

CREATE TRIGGER update_dart_corp_codes_updated_at
  BEFORE UPDATE ON public.dart_corp_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================
-- 5. 헬퍼 함수: stock_code로 corp_code 조회
-- =========================================

CREATE OR REPLACE FUNCTION public.get_corp_code(p_stock_code TEXT)
RETURNS TABLE(corp_code TEXT, corp_name TEXT) AS $$
BEGIN
  -- 'A' 접두사 제거 (예: 'A005930' -> '005930')
  p_stock_code := REGEXP_REPLACE(p_stock_code, '^A', '');

  -- 6자리로 패딩
  p_stock_code := LPAD(p_stock_code, 6, '0');

  RETURN QUERY
  SELECT d.corp_code, d.corp_name
  FROM public.dart_corp_codes d
  WHERE d.stock_code = p_stock_code;
END;
$$ LANGUAGE plpgsql STABLE;

-- =========================================
-- 완료
-- =========================================

DO $$
BEGIN
  RAISE NOTICE '✓ dart_corp_codes 테이블 생성 완료';
  RAISE NOTICE '  - stock_code → corp_code 매핑용 테이블';
  RAISE NOTICE '  - 인덱스: stock_code (PK), corp_code, corp_name, modify_date';
  RAISE NOTICE '  - RLS: 인증된 사용자만 읽기 가능';
  RAISE NOTICE '  - 헬퍼 함수: get_corp_code(stock_code)';
END $$;


-- =========================================
-- Add Sectors Table
-- =========================================
-- 업종(Sector) 정보를 관리하는 테이블 추가
-- KSIC 중분류 기반의 업종 분류를 저장

-- 1. sectors 테이블 생성
CREATE TABLE IF NOT EXISTS public.sectors (
  name TEXT PRIMARY KEY,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 초기 업종 데이터 삽입 (rule_table.py 기반)
INSERT INTO public.sectors (name, description) VALUES
  ('반도체와 반도체장비', '전자부품, 컴퓨터, 영상, 음향 및 통신장비 제조업'),
  ('디스플레이·전자부품', '디스플레이 및 전자부품 제조업'),
  ('전기장비', '전기장비 제조업'),
  ('화학', '화학물질 및 화학제품 제조업'),
  ('바이오·제약', '의료용 물질 및 의약품 제조업'),
  ('고무·플라스틱', '고무 및 플라스틱 제품 제조업'),
  ('비금속광물', '비금속 광물제품 제조업'),
  ('2차전지·소재', '1차 금속 및 2차전지 소재 제조업'),
  ('금속가공', '금속가공제품 제조업'),
  ('자동차', '자동차 및 트레일러 제조업'),
  ('방산·항공', '항공기, 우주선 및 방산 제조업'),
  ('기계·설비', '기타 기계 및 장비 제조업'),
  ('식품', '식료품 제조업'),
  ('음료', '음료 제조업'),
  ('담배', '담배 제조업'),
  ('섬유', '섬유제품 제조업'),
  ('의복·패션', '의복, 의복액세서리 및 모피제품 제조업'),
  ('가죽·신발', '가죽, 가방 및 신발 제조업'),
  ('목재·종이', '목재 및 나무제품, 종이 제조업'),
  ('출판·인쇄', '인쇄 및 기록매체 복제업'),
  ('석유·화학제품', '코크스, 연탄 및 석유정제품 제조업'),
  ('1차금속', '1차 금속 제조업'),
  ('출판·미디어', '출판업'),
  ('영상·방송', '영상, 오디오 기록물 제작 및 배급업'),
  ('통신·방송', '방송업'),
  ('통신', '우편 및 통신업'),
  ('IT·소프트웨어', '컴퓨터 프로그래밍, 시스템 통합 및 관리업'),
  ('정보서비스', '정보서비스업'),
  ('금융', '금융업'),
  ('보험·연금', '보험 및 연금업'),
  ('금융지원서비스', '금융 및 보험 관련 서비스업'),
  ('건설', '종합 건설업'),
  ('도매', '도매 및 상품 중개업'),
  ('소매', '소매업'),
  ('운송', '육상운송 및 파이프라인 운송업'),
  ('창고·물류', '창고 및 운송관련 서비스업'),
  ('항공', '항공 운송업'),
  ('창고·운송', '보관 및 창고업'),
  ('숙박', '숙박업'),
  ('음식점', '음식점 및 주점업'),
  ('부동산', '부동산업'),
  ('전문·과학·기술서비스', '전문, 과학 및 기술 서비스업'),
  ('연구개발', '연구개발업'),
  ('광고·시장조사', '광고업 및 시장조사업'),
  ('전문서비스', '기타 전문, 과학 및 기술 서비스업'),
  ('사업지원서비스', '사업지원 서비스업'),
  ('공공행정', '공공행정, 국방 및 사회보장 행정'),
  ('교육', '교육 서비스업'),
  ('보건·의료', '보건업 및 사회복지 서비스업'),
  ('사회복지', '사회복지 서비스업'),
  ('예술·스포츠·여가', '예술, 스포츠 및 여가관련 서비스업'),
  ('창작·예술', '창작, 예술 및 여가관련 서비스업'),
  ('도서관·박물관', '도서관, 사적지 및 유사 여가관련 서비스업'),
  ('농업', '농업'),
  ('임업', '임업'),
  ('어업', '어업'),
  ('석탄·광업', '석탄, 원유 및 천연가스 광업'),
  ('원유·가스', '원유 및 천연가스 채굴업'),
  ('금속광업', '금속광업'),
  ('비금속광물', '비금속광물 광업'),
  ('전기·가스', '전기, 가스, 증기 및 공기조절 공급업'),
  ('수도', '수도업'),
  ('하수·폐기물', '하수, 폐수 및 분뇨 처리업'),
  ('환경·복원', '환경 정화 및 복원업'),
  ('환경정화', '환경 정화업'),
  ('토목', '토목 건설업'),
  ('전문건설', '전문직별 공사업'),
  ('기타', '기타 업종'),
  ('미분류', '업종 미분류')
ON CONFLICT (name) DO NOTHING;

-- 3. companies 테이블에 FK 추가
-- 기존 sector 값이 sectors 테이블에 없는 경우를 대비하여 '기타'로 업데이트
UPDATE public.companies
SET sector = '기타'
WHERE sector IS NOT NULL
  AND sector NOT IN (SELECT name FROM public.sectors);

-- FK 제약조건 추가
ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS fk_companies_sector;

ALTER TABLE public.companies
  ADD CONSTRAINT fk_companies_sector
  FOREIGN KEY (sector)
  REFERENCES public.sectors(name)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 4. RLS (Row Level Security) 설정
-- Sector는 민감한 정보가 아니므로 모든 사용자가 조회 가능
ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view sectors" ON public.sectors;

-- ✅ 인증 여부와 관계없이 모든 사용자가 업종 정보 조회 가능
CREATE POLICY "Anyone can view sectors"
  ON public.sectors
  FOR SELECT
  USING (true);

-- 5. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_companies_sector ON public.companies(sector);

-- 6. updated_at 트리거 추가
DROP TRIGGER IF EXISTS update_sectors_updated_at ON public.sectors;

CREATE TRIGGER update_sectors_updated_at
  BEFORE UPDATE ON public.sectors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =========================================
-- 완료
-- =========================================
-- sectors 테이블이 생성되었습니다.
-- - 모든 사용자가 업종 정보를 조회할 수 있습니다
-- - companies.sector는 sectors.name을 참조하는 FK입니다


-- =========================================
-- Service Role 전체 액세스 정책 추가
-- =========================================
-- Service Role은 RLS를 우회하고 모든 데이터에 접근할 수 있도록 설정

-- 1. sectors 테이블에 service_role 정책 추가
DROP POLICY IF EXISTS "Service role can do anything on sectors" ON public.sectors;

CREATE POLICY "Service role can do anything on sectors"
  ON public.sectors
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2. companies 테이블에 service_role 정책 추가
DROP POLICY IF EXISTS "Service role can do anything on companies" ON public.companies;

CREATE POLICY "Service role can do anything on companies"
  ON public.companies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 3. disclosure_insights 테이블에 service_role 정책 추가
DROP POLICY IF EXISTS "Service role can do anything on disclosure_insights" ON public.disclosure_insights;

CREATE POLICY "Service role can do anything on disclosure_insights"
  ON public.disclosure_insights
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. market_indices 테이블에 service_role 정책 추가
DROP POLICY IF EXISTS "Service role can do anything on market_indices" ON public.market_indices;

CREATE POLICY "Service role can do anything on market_indices"
  ON public.market_indices
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. users 테이블에 service_role 정책 추가
DROP POLICY IF EXISTS "Service role can do anything on users" ON public.users;

CREATE POLICY "Service role can do anything on users"
  ON public.users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =========================================
-- 완료
-- =========================================
-- Service Role이 모든 테이블에 전체 액세스할 수 있습니다.


-- =========================================
-- Add Missing Sectors
-- =========================================
-- rule_table.py에 추가된 모든 누락 업종 추가

INSERT INTO public.sectors (name, description) VALUES
  -- KSIC 32, 33, 34 (제조업)
  ('가구', '가구 제조업 (KSIC 32)'),
  ('기타 제조', '기타 제품 제조업 (KSIC 33)'),
  ('산업용 기계수리', '산업용 기계 및 장비 수리업 (KSIC 34)'),

  -- KSIC 09 (광업)
  ('광업지원서비스', '광업 지원 서비스업 (KSIC 09)'),

  -- KSIC 68, 76 (부동산/임대)
  ('임대업', '임대업; 부동산 제외 (KSIC 76)'),

  -- KSIC 92, 94, 95, 96 (기타 서비스)
  ('기타 오락', '오락 및 스포츠 관련 서비스업 (KSIC 92)'),
  ('협회·단체', '협회 및 단체 (KSIC 94)'),
  ('수리업', '개인 및 소비용품 수리업 (KSIC 95)'),
  ('기타 개인서비스', '기타 개인 서비스업 (KSIC 96)'),

  -- KSIC 소분류 특수 케이스 (5자리)
  ('지주회사', '지주회사 (KSIC 64992)'),
  ('투자회사', '신탁업, 집합투자업 (KSIC 6420, 64201, 64209)'),

  -- KSIC 31 (운송장비)
  ('운송장비', '기타 운송장비 제조업 - 선박, 철도, 항공기 등 (KSIC 31)')
ON CONFLICT (name) DO NOTHING;

-- =========================================
-- 완료
-- =========================================


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


-- Create waitlist table for collecting emails before launch
CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    source TEXT DEFAULT 'website',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    notified_at TIMESTAMPTZ,
    subscribed BOOLEAN DEFAULT true
);

-- Create index for email lookup
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist(email);

-- Create index for notification status
CREATE INDEX IF NOT EXISTS idx_waitlist_notified ON public.waitlist(notified_at) WHERE notified_at IS NULL;

-- Enable RLS
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- RLS Policies:
-- 1. Anonymous users can INSERT only (for signup)
-- 2. No SELECT/UPDATE/DELETE for anonymous users (protect email list)
-- 3. Service role has full access (for admin operations)

-- Allow anonymous users to insert (join waitlist)
CREATE POLICY "Allow anonymous insert to waitlist"
ON public.waitlist
FOR INSERT
TO anon
WITH CHECK (true);

-- Service role has full access
CREATE POLICY "Service role full access to waitlist"
ON public.waitlist
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Add comment
COMMENT ON TABLE public.waitlist IS 'Email waitlist for pre-launch signups';


-- Create mail_logs table for tracking email history
CREATE TABLE IF NOT EXISTS public.mail_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    resend_id TEXT,                          -- Resend에서 반환한 메시지 ID
    recipient TEXT NOT NULL,                  -- 받는 사람 이메일
    subject TEXT,                             -- 이메일 제목
    mail_type TEXT DEFAULT 'general',         -- 메일 유형: general, waitlist_notify, disclosure_alert 등
    corp_name TEXT,                           -- 관련 종목명 (공시 알림 등)
    stock_code TEXT,                          -- 관련 종목코드
    sector TEXT,                              -- 관련 섹터
    status TEXT DEFAULT 'sent',               -- 상태: sent, delivered, bounced, failed
    error_message TEXT,                       -- 실패 시 에러 메시지
    metadata JSONB DEFAULT '{}',              -- 추가 정보 (유연한 확장용)
    created_at TIMESTAMPTZ DEFAULT NOW(),     -- 발송 시간
    updated_at TIMESTAMPTZ DEFAULT NOW()      -- 상태 업데이트 시간
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_mail_logs_recipient ON public.mail_logs(recipient);
CREATE INDEX IF NOT EXISTS idx_mail_logs_resend_id ON public.mail_logs(resend_id);
CREATE INDEX IF NOT EXISTS idx_mail_logs_status ON public.mail_logs(status);
CREATE INDEX IF NOT EXISTS idx_mail_logs_mail_type ON public.mail_logs(mail_type);
CREATE INDEX IF NOT EXISTS idx_mail_logs_created_at ON public.mail_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mail_logs_corp_name ON public.mail_logs(corp_name) WHERE corp_name IS NOT NULL;

-- RLS 활성화
ALTER TABLE public.mail_logs ENABLE ROW LEVEL SECURITY;

-- RLS 정책: service_role만 전체 액세스 (관리자 전용 테이블)
CREATE POLICY "Service role full access to mail_logs"
ON public.mail_logs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- updated_at 자동 업데이트 트리거
CREATE TRIGGER update_mail_logs_updated_at
    BEFORE UPDATE ON public.mail_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 테이블 설명
COMMENT ON TABLE public.mail_logs IS 'Email sending history and tracking';
COMMENT ON COLUMN public.mail_logs.mail_type IS 'Type: general, waitlist_notify, disclosure_alert, weekly_digest';
COMMENT ON COLUMN public.mail_logs.status IS 'Status: sent, delivered, bounced, failed, opened, clicked';


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


-- =========================================
-- Migration 018: sector_signals 테이블 생성
-- 섹터별 투자 신호 (disclosure_insights 집계 결과)
-- compute_sector_signals.py 가 매일 INSERT
-- =========================================

CREATE TABLE IF NOT EXISTS public.sector_signals (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  date          DATE    NOT NULL,
  sector        TEXT    NOT NULL,   -- companies.sector (한글)
  sector_en     TEXT,               -- sectors.sector_en (영문)
  signal        TEXT    CHECK (signal IN ('Bullish', 'Bearish', 'Neutral')),
  confidence    NUMERIC(4,3),       -- 0.000 ~ 1.000
  disclosure_count INT DEFAULT 0,  -- 해당 섹터 당일 공시 수
  positive_count   INT DEFAULT 0,
  negative_count   INT DEFAULT 0,
  neutral_count    INT DEFAULT 0,
  drivers       TEXT[],             -- ["exports rising", "foreign inflow"]
  created_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (date, sector)             -- 날짜+섹터 중복 방지
);

-- RLS
ALTER TABLE public.sector_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view sector_signals" ON public.sector_signals;
CREATE POLICY "Authenticated users can view sector_signals"
  ON public.sector_signals FOR SELECT
  USING (auth.role() = 'authenticated');

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_sector_signals_date   ON public.sector_signals(date DESC);
CREATE INDEX IF NOT EXISTS idx_sector_signals_sector ON public.sector_signals(sector);
CREATE INDEX IF NOT EXISTS idx_sector_signals_signal ON public.sector_signals(signal);


-- =========================================
-- Migration 019: market_radar 테이블 생성
-- 한국 시장 일일 요약 (daily summary)
-- compute_market_radar.py 가 매일 INSERT
-- =========================================

CREATE TABLE IF NOT EXISTS public.market_radar (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  date            DATE  NOT NULL UNIQUE,   -- 기준일 (중복 방지)
  market_signal   TEXT  CHECK (market_signal IN ('Bullish', 'Bearish', 'Neutral')),
  top_sector      TEXT,                    -- 최고 confidence 섹터 (한글)
  top_sector_en   TEXT,                    -- 최고 confidence 섹터 (영문)
  foreign_flow    TEXT,                    -- 외국인 순매수 요약 ("+320M")
  kospi_change    NUMERIC(5,2),            -- 코스피 등락률 (%)
  kosdaq_change   NUMERIC(5,2),            -- 코스닥 등락률 (%)
  total_disclosures INT DEFAULT 0,         -- 당일 총 공시 수
  summary         TEXT,                    -- AI 생성 요약 문장
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.market_radar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view market_radar" ON public.market_radar;
CREATE POLICY "Authenticated users can view market_radar"
  ON public.market_radar FOR SELECT
  USING (auth.role() = 'authenticated');

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_market_radar_date ON public.market_radar(date DESC);


-- migration 020: users 테이블 B2B API 키 추가
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS api_key_created_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_api_key ON public.users(api_key)
  WHERE api_key IS NOT NULL;

COMMENT ON COLUMN public.users.api_key IS 'B2B API 접근용 API 키 (UUID 형식 권장)';


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


-- =========================================
-- Migration 024: event_stats 테이블 생성
-- 이벤트 타입별 수익률 통계 (BaseScore 계산용)
-- 데이터 소스: disclosure_events + 주가 데이터
-- =========================================

CREATE TABLE IF NOT EXISTS public.event_stats (
    event_type      TEXT    PRIMARY KEY,
    avg_1d_return   FLOAT,           -- 1일 평균 수익률 (%)
    avg_3d_return   FLOAT,           -- 3일 평균 수익률 (%)
    avg_5d_return   FLOAT,           -- 5일 평균 수익률 (%) ← BaseScore 계산에 사용
    avg_20d_return  FLOAT,           -- 20일 평균 수익률 (%)
    std_5d          FLOAT,           -- 5일 수익률 표준편차
    sample_size     INTEGER,         -- 표본 수
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE  public.event_stats               IS '이벤트 타입별 과거 수익률 통계 (BaseScore 계산용)';
COMMENT ON COLUMN public.event_stats.avg_5d_return IS 'BaseScore event component: min(max((avg_5d+3)/6*30, 0), 30)';
COMMENT ON COLUMN public.event_stats.sample_size   IS '통계 신뢰도 기준: 30건 미만이면 avg=0 fallback';

-- service role 정책
ALTER TABLE public.event_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access event_stats" ON public.event_stats;
CREATE POLICY "Service role full access event_stats"
    ON public.event_stats FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Authenticated users can view event_stats" ON public.event_stats;
CREATE POLICY "Authenticated users can view event_stats"
    ON public.event_stats FOR SELECT
    USING (auth.role() = 'authenticated');


-- =========================================
-- Migration 025: scores_log 테이블 생성
-- 스코어 히스토리 저장 (백테스트 + 성능 측정용)
-- =========================================

CREATE TABLE IF NOT EXISTS public.scores_log (
    id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_code      TEXT    NOT NULL,
    date            DATE    NOT NULL,
    disclosure_id   UUID    REFERENCES public.disclosure_insights(id) ON DELETE SET NULL,

    -- 점수
    base_score_raw  FLOAT,   -- s + i + e (0~100, 정규화 전)
    base_score      FLOAT,   -- sigmoid 정규화 후 (0~100)
    lps             FLOAT,   -- Loan Pressure Score (0~100)
    final_score     FLOAT,   -- BaseScore * (1 - min(LPS/100, 0.4))

    -- 보정 태그
    signal_tag      TEXT,    -- "⚠️ Smart Money Selling" 등

    -- 사후 검증 (배치로 업데이트)
    future_return_5d  FLOAT, -- 5일 후 실제 수익률 (%) - 사후 기입
    future_return_20d FLOAT, -- 20일 후 실제 수익률 (%) - 사후 기입

    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE (stock_code, date, disclosure_id)
);

COMMENT ON TABLE  public.scores_log                  IS '공시별 스코어 히스토리 (백테스트 및 모델 성능 측정)';
COMMENT ON COLUMN public.scores_log.future_return_5d IS '사후 기입: 공시일 +5영업일 수익률. 모델 검증에 사용';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_scores_log_stock_date
    ON public.scores_log(stock_code, date DESC);

CREATE INDEX IF NOT EXISTS idx_scores_log_date
    ON public.scores_log(date DESC);

CREATE INDEX IF NOT EXISTS idx_scores_log_final_score
    ON public.scores_log(final_score DESC NULLS LAST);

-- service role 정책
ALTER TABLE public.scores_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access scores_log" ON public.scores_log;
CREATE POLICY "Service role full access scores_log"
    ON public.scores_log FOR ALL
    USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Authenticated users can view scores_log" ON public.scores_log;
CREATE POLICY "Authenticated users can view scores_log"
    ON public.scores_log FOR SELECT
    USING (auth.role() = 'authenticated');


-- =========================================
-- Migration 026: disclosure_insights 스코어 컬럼 추가
-- BaseScore + FinalScore 계산 결과 저장
-- =========================================

ALTER TABLE public.disclosure_insights
    ADD COLUMN IF NOT EXISTS sentiment_score  FLOAT,   -- AI 연속값 -1.0 ~ +1.0 (auto_analyst.py)
    ADD COLUMN IF NOT EXISTS base_score_raw   FLOAT,   -- s + i + e (0~100, 정규화 전)
    ADD COLUMN IF NOT EXISTS base_score       FLOAT,   -- sigmoid 정규화 후 (0~100)
    ADD COLUMN IF NOT EXISTS final_score      FLOAT,   -- BaseScore * (1 - loan_weight)
    ADD COLUMN IF NOT EXISTS signal_tag       TEXT;    -- "⚠️ Smart Money Selling" 등

COMMENT ON COLUMN public.disclosure_insights.sentiment_score IS 'AI 연속 감성값 -1~+1. s = ((score+1)/2)*40';
COMMENT ON COLUMN public.disclosure_insights.base_score_raw  IS 'BaseScore 정규화 전: s(0~40) + i(0~30) + e(0~30)';
COMMENT ON COLUMN public.disclosure_insights.base_score      IS 'BaseScore 정규화 후: sigmoid((raw-50)/10)*100';
COMMENT ON COLUMN public.disclosure_insights.final_score     IS 'FinalScore: base_score * (1 - min(LPS/100, 0.4))';
COMMENT ON COLUMN public.disclosure_insights.signal_tag      IS '상황별 보정 태그 (Smart Money Selling 등)';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_insights_final_score
    ON public.disclosure_insights(final_score DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_insights_base_score
    ON public.disclosure_insights(base_score DESC NULLS LAST);


-- migration 027: 플랜 모델 업데이트
-- FREE / PRO → free / developer / pro (소문자 + developer 플랜 추가)

-- 1. 기존 constraint 제거
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_plan_check;

-- 2. 기존 대문자 값 소문자로 변환
UPDATE public.users SET plan = LOWER(plan) WHERE plan IS NOT NULL;

-- 3. 새 constraint 적용 (free / developer / pro)
ALTER TABLE public.users
  ADD CONSTRAINT users_plan_check
  CHECK (plan IN ('free', 'developer', 'pro'));

-- 4. 기본값 소문자로 변경
ALTER TABLE public.users
  ALTER COLUMN plan SET DEFAULT 'free';

COMMENT ON COLUMN public.users.plan IS '구독 플랜: free / developer / pro';
