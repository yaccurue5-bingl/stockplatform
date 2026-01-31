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
