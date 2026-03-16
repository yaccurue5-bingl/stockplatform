# Companies 테이블 PK 마이그레이션 가이드

## 개요

이 가이드는 `companies` 테이블의 Primary Key를 `code`에서 `stock_code`로 변경하고,
`fetch_krx_from_datagokr.py` 스크립트를 업데이트하는 전체 과정을 설명합니다.

## 문제 상황

### 에러 메시지
```
null value in column 'code' violates not-null constraint
```

### 원인
- 기존 스키마: `code` 컬럼이 PRIMARY KEY (NOT NULL)
- Python 스크립트: `stock_code`와 `code` 모두 사용하여 혼란 발생
- 데이터 불일치: 일부 레코드에서 `code` 값이 NULL

## 해결 방법

### 1단계: SQL 마이그레이션 실행

#### Supabase SQL Editor에서 실행

1. **Supabase 대시보드** 접속
2. 왼쪽 메뉴에서 **SQL Editor** 클릭
3. 새 쿼리 생성
4. 다음 파일 내용 복사 & 실행:

```
my-research-platform/supabase/migrate_companies_to_stock_code_pk.sql
```

#### 마이그레이션이 수행하는 작업

✅ **기존 PRIMARY KEY 제거**
- `code` 컬럼의 PRIMARY KEY 제약 제거

✅ **stock_code를 PRIMARY KEY로 설정**
- `stock_code` 컬럼 생성 (없는 경우)
- `code` 값을 `stock_code`로 복사
- `stock_code`를 NOT NULL로 설정
- `stock_code`를 PRIMARY KEY로 설정

✅ **code 컬럼 NOT NULL 제약 해제**
- `code` 컬럼은 유지하되 NOT NULL 제약만 제거
- 기존 데이터 보존

✅ **필수 컬럼 확인 및 추가**
- `corp_name` (회사명)
- `market` (시장 구분)
- `sector` (업종)
- `market_cap` (시가총액)
- `listed_shares` (상장 주식수)
- `updated_at` (업데이트 시간)

✅ **인덱스 생성**
- `stock_code`, `corp_name`, `market`, `sector`에 인덱스 생성

✅ **RLS 정책 재생성**
- 중복 정책 모두 제거
- 새로운 정책 2개 생성:
  - `companies_select_public`: 모든 사용자 읽기 가능
  - `companies_all_service_role`: Service role 모든 작업 가능

### 2단계: Python 스크립트 수정 사항

#### fetch_krx_from_datagokr.py 주요 변경사항

##### 1. 날짜 자동 탐색 기능 추가
```python
def get_recent_dates(days=5):
    """최근 5일간의 날짜를 역순으로 반환"""
    dates = []
    for i in range(days):
        date = datetime.now() - timedelta(days=i+1)
        dates.append(date.strftime('%Y%m%d'))
    return dates
```

##### 2. transform_to_db_format 함수 수정
**변경 전:**
```python
company = {
    'code': stock_code,              # PRIMARY KEY
    'stock_code': stock_code,
    'corp_name': stock_name,
    ...
}
```

**변경 후:**
```python
company = {
    'stock_code': stock_code,        # PRIMARY KEY (code 제거)
    'corp_name': corp_name,          # stock_name -> corp_name
    'sector': '기타',               # industry -> sector
    ...
}
```

##### 3. save_to_supabase 함수 수정
**변경 전:**
```python
supabase.table("companies").upsert(batch, on_conflict="code").execute()
```

**변경 후:**
```python
supabase.table("companies").upsert(batch, on_conflict="stock_code").execute()
```

##### 4. run 함수에 날짜 자동 탐색 로직 추가
```python
# 최근 5일간 날짜를 역순으로 시도
recent_dates = get_recent_dates(days=5)

for bas_dt in recent_dates:
    stocks = fetch_all_krx_stocks(bas_dt)
    if stocks:
        successful_date = bas_dt
        break
```

### 3단계: 스크립트 실행 및 검증

#### 실행
```bash
cd /home/user/stockplatform
python scripts/fetch_krx_from_datagokr.py
```

#### 기대 결과
```
============================================================
🚀 KRX 종목 정보 수집 시작 (data.go.kr API)
============================================================
✅ 데이터베이스 스키마 검증 완료 (stock_code 컬럼 존재)
📅 최근 5일 날짜 자동 탐색: 20260123, 20260122, 20260121, 20260120, 20260119

📅 기준일자 20260123로 시도 중...
📊 data.go.kr API를 통해 KRX 종목 정보 수집 중...
   ✅ 페이지 1: 1000개 조회 (누적: 1000개)
   ✅ 페이지 2: 500개 조회 (누적: 1500개)
✅ 총 1500개 종목 조회 완료

✅ 1500개 종목 변환 완료

💾 Supabase 저장 중 (1500개)...
   ✅ Batch 1 저장 완료 (100개)
   ✅ Batch 2 저장 완료 (100개)
   ...
   ✅ Batch 15 저장 완료 (100개)

============================================================
🎉 최종 완료
   📅 기준일자: 20260123
   ✅ 성공: 1500개
   ❌ 실패: 0개
============================================================
```

#### 검증: Supabase에서 데이터 확인

```sql
-- 전체 종목 수 확인
SELECT COUNT(*) as total_companies FROM companies;

-- stock_code가 PRIMARY KEY인지 확인
SELECT
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'companies'
  AND constraint_type = 'PRIMARY KEY';

-- updated_at이 최근 시간으로 업데이트되었는지 확인
SELECT
  stock_code,
  corp_name,
  market,
  sector,
  market_cap,
  updated_at
FROM companies
ORDER BY updated_at DESC
LIMIT 10;

-- 삼성전자 검색
SELECT * FROM companies
WHERE corp_name LIKE '%삼성전자%';
```

## 최종 스키마

### companies 테이블 구조

| 컬럼명 | 타입 | 제약 | 설명 |
|--------|------|------|------|
| **stock_code** | TEXT | **PRIMARY KEY, NOT NULL** | 종목 코드 (예: "005930") |
| code | TEXT | NULL | 레거시 컬럼 (선택적) |
| corp_name | TEXT | - | 회사명 (예: "삼성전자") |
| market | TEXT | - | 시장 구분 (KOSPI/KOSDAQ) |
| sector | TEXT | - | 업종 (예: "전자", "기타") |
| market_cap | BIGINT | - | 시가총액 (단위: 원) |
| listed_shares | BIGINT | - | 상장 주식수 (단위: 주) |
| updated_at | TIMESTAMP | DEFAULT NOW() | 업데이트 시간 |

### 인덱스
- `idx_companies_stock_code` on `stock_code` (PRIMARY KEY)
- `idx_companies_corp_name` on `corp_name`
- `idx_companies_market` on `market`
- `idx_companies_sector` on `sector`

## 주요 변경사항 요약

### 데이터베이스
1. ✅ `stock_code`가 PRIMARY KEY
2. ✅ `code` 컬럼 NOT NULL 제약 해제
3. ✅ 변수명 통일: `sector` 사용 (industry 대신)
4. ✅ RLS 정책 정리 및 재생성

### Python 스크립트
1. ✅ `code` 필드 제거
2. ✅ `stock_code`를 핵심 식별자로 사용
3. ✅ `on_conflict="stock_code"` 사용
4. ✅ 변수명 통일: `corp_name`, `sector` 사용
5. ✅ 최근 5일간 날짜 자동 탐색 기능 추가

## 트러블슈팅

### Q1: 마이그레이션 실행 후 에러 발생

**에러:**
```
ERROR: column "stock_code" contains null values
```

**해결:**
```sql
-- stock_code가 NULL인 레코드 확인
SELECT * FROM companies WHERE stock_code IS NULL;

-- code 값을 stock_code로 복사
UPDATE companies SET stock_code = code WHERE stock_code IS NULL;

-- 그래도 NULL이면 삭제
DELETE FROM companies WHERE stock_code IS NULL OR stock_code = '';
```

### Q2: Python 스크립트 실행 시 에러

**에러:**
```
❌ 데이터베이스 스키마 검증 실패
```

**해결:**
1. Supabase SQL Editor에서 `migrate_companies_to_stock_code_pk.sql` 재실행
2. 스키마가 올바른지 확인:
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'companies'
ORDER BY column_name;
```

### Q3: 데이터가 조회되지 않음

**에러:**
```
❌ 최근 5일간 조회된 종목이 없습니다.
```

**해결:**
1. API 키 확인:
```bash
# .env.local 파일 확인
cat my-research-platform/.env.local | grep PUBLIC_DATA_API_KEY
```

2. API 키 발급: https://www.data.go.kr/data/15094775/openapi.do

3. 수동으로 날짜 지정:
```python
# fetch_krx_from_datagokr.py 수정
bas_dt = '20260120'  # 특정 날짜 직접 지정
```

### Q4: 일부 종목만 저장됨

**원인:** Batch 처리 중 일부 실패

**해결:**
```python
# fetch_krx_from_datagokr.py에서 batch_size 조정
batch_size = 50  # 기본값 100에서 50으로 감소
```

## 참고 문서

- SQL 마이그레이션: `my-research-platform/supabase/migrate_companies_to_stock_code_pk.sql`
- Python 스크립트: `scripts/fetch_krx_from_datagokr.py`
- data.go.kr API 가이드: `DATA_GO_KR_API.md`
- 기존 가이드: `COMPANIES_TABLE_FIX.md`

## 롤백 방법

만약 마이그레이션을 되돌려야 한다면:

```sql
-- 1. 기존 PRIMARY KEY 제거
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_pkey CASCADE;

-- 2. code를 PRIMARY KEY로 복원
ALTER TABLE companies ADD CONSTRAINT companies_pkey PRIMARY KEY (code);

-- 3. code NOT NULL 제약 복원
ALTER TABLE companies ALTER COLUMN code SET NOT NULL;
```

단, Python 스크립트도 함께 원래대로 되돌려야 합니다.
