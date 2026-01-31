-- KONEX 종목 삭제 스크립트
-- 실행 전에 반드시 삭제될 종목을 확인하세요

-- 1. KONEX 종목 수 확인
SELECT COUNT(*) as konex_count
FROM companies
WHERE market = 'KONEX';

-- 2. KONEX 종목 목록 확인 (처음 100개)
SELECT stock_code, corp_name, market, sector
FROM companies
WHERE market = 'KONEX'
ORDER BY stock_code
LIMIT 100;

-- 3. KONEX 종목 삭제 (주의: 이 쿼리는 실제로 데이터를 삭제합니다)
-- 실행 전에 위의 SELECT 쿼리로 확인 후 진행하세요
DELETE FROM companies
WHERE market = 'KONEX';

-- 4. 삭제 결과 확인
SELECT COUNT(*) as remaining_konex_count
FROM companies
WHERE market = 'KONEX';

-- 5. 전체 종목 수 확인
SELECT
    market,
    COUNT(*) as count
FROM companies
GROUP BY market
ORDER BY market;
