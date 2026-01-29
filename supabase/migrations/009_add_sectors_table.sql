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
