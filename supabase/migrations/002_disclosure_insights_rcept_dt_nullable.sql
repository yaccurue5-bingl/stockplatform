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
