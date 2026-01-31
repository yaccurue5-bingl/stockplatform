# 기업-KSIC 매핑 가이드

## ✅ 준비 완료

다음 작업이 완료되었습니다:

1. **dart_api.py 수정**: 'A' 접두사 제거 로직 추가
2. **map_companies_to_ksic.py 수정**: sector 컬럼에 한글 업종명 저장
3. **SQL 마이그레이션 준비**: 007_cleanup_companies_table.sql

## 📋 실행 순서

### 1단계: SQL 마이그레이션 실행

먼저 데이터베이스를 정리합니다:

```bash
# Supabase Dashboard에서 실행
https://supabase.com/dashboard/project/rxcwqsolfrjhomeusyza/editor/sql
```

아래 SQL을 실행하세요 (`migration_007.sql` 파일 내용):

```sql
-- 중복 행 삭제 (A 접두사 코드)
-- 불필요한 컬럼 삭제 (industry_category, corp_code, ksic_name, ksic_updated_at)
-- sector 컬럼 NULL 초기화
```

### 2단계: 기업-KSIC 매핑 실행

**방법 1: 간편 실행 스크립트 사용**

```bash
./run_mapping.sh
```

**방법 2: Python 스크립트 직접 실행**

```bash
# 전체 기업 매핑 (unmapped_only=False)
python3 scripts/map_companies_to_ksic.py --verbose --batch-size 50

# 특정 기업만 테스트
python3 scripts/map_companies_to_ksic.py --stock-codes 005930 207940 035420 --verbose

# Dry-run (테스트)
python3 scripts/map_companies_to_ksic.py --dry-run --verbose
```

## 📊 매핑 결과 확인

### sector 컬럼에 저장되는 값

| 종목코드 | 기업명 | KSIC | sector (한글 업종명) |
|---------|--------|------|---------------------|
| 005930 | 삼성전자 | 26110 | 반도체와 반도체장비 |
| 207940 | 삼성바이오로직스 | 21 | 바이오·제약 |
| 035420 | NAVER | 62010 | IT·소프트웨어 |
| 005380 | 현대차 | 30120 | 방산·항공 |
| 051910 | LG화학 | 20 | 화학 |

### 로그 예시

```
2026-01-27 08:30:15,123 - __main__ - INFO - 매핑 중: 005930 (삼성전자)
2026-01-27 08:30:15,456 - __main__ - INFO -   ✓ 005930: 26110 - 반도체와 반도체장비
2026-01-27 08:30:15,789 - __main__ - DEBUG -   ✓ DB 업데이트 완료: 005930 -> 반도체와 반도체장비

2026-01-27 08:30:16,123 - __main__ - INFO - 매핑 중: 207940 (삼성바이오로직스)
2026-01-27 08:30:16,456 - __main__ - INFO -   ✓ 207940: 21 - 바이오·제약
2026-01-27 08:30:16,789 - __main__ - DEBUG -   ✓ DB 업데이트 완료: 207940 -> 바이오·제약
```

## ⚠️ 주의사항

### Rate Limit

DART API는 초당 1회 제한이 있습니다:
- 2000개 기업 처리 시 약 30분 소요
- batch_size를 조절해서 중간 통계 확인 가능

### 네트워크 연결

Claude Code 환경에서는 네트워크 제한으로 실행이 안 될 수 있습니다.
로컬 터미널에서 실행하세요:

```bash
cd /path/to/stockplatform
./run_mapping.sh
```

## 🔍 결과 검증

매핑 완료 후 Supabase Dashboard에서 확인:

```sql
-- sector 컬럼 값 확인
SELECT code, corp_name, sector
FROM companies
WHERE sector IS NOT NULL
LIMIT 10;

-- 업종별 기업 수 통계
SELECT sector, COUNT(*) as count
FROM companies
WHERE sector IS NOT NULL
GROUP BY sector
ORDER BY count DESC;
```

## 📝 예상 결과

```
======================================================================
기업-KSIC 매핑 결과
======================================================================
처리 시각: 2026-01-27 08:45:23

총 처리 대상:      2456개
  ✓ 성공:          2398개
  ✗ 실패:            58개
  - 건너뜀:           0개
    (이미 매핑됨:     0개)

성공률: 97.6%
======================================================================
```
