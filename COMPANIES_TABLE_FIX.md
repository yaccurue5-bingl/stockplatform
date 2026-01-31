# Companies 테이블 오류 해결 가이드

## 문제 상황

```
Error: Failed to run sql query: ERROR: 42710: policy "Public read access for companies" for table "companies" already exists
```

이 오류는 다음 두 가지 문제 때문에 발생합니다:

1. **RLS Policy 중복**: companies 테이블에 동일한 이름의 정책이 이미 존재
2. **스키마 불일치**: companies 테이블 구조가 Python 스크립트와 맞지 않음

## 해결 방법

### 1단계: Supabase SQL Editor에서 스크립트 실행

1. Supabase 대시보드 접속
2. 왼쪽 메뉴에서 **SQL Editor** 클릭
3. 새 쿼리 생성
4. 아래 파일의 내용을 복사하여 붙여넣기:

```
my-research-platform/supabase/fix_companies_table.sql
```

5. **Run** 버튼 클릭

### 2단계: 스크립트가 수행하는 작업

✅ 기존 RLS policy 모두 삭제 (충돌 방지)
```sql
DROP POLICY IF EXISTS "Public read access to companies" ON companies;
DROP POLICY IF EXISTS "Public read access for companies" ON companies;
...
```

✅ 필요한 컬럼 추가
- `stock_code` - 종목코드 (code와 동일)
- `corp_name` - 회사명
- `market_cap` - 시가총액
- `listed_shares` - 상장주식수

✅ 기존 데이터 마이그레이션
- `name_kr` → `corp_name`으로 복사
- `code` → `stock_code`로 복사

✅ 새로운 RLS policy 생성
- `companies_public_read` - 모든 사용자 읽기 가능
- `companies_service_role_all` - Service role 모든 작업 가능

✅ 인덱스 생성 (성능 최적화)

### 3단계: 결과 확인

스크립트 실행 후 다음 메시지가 표시되어야 합니다:

```
✅ Companies 테이블 스키마 업데이트 및 RLS 수정 완료!
```

아래에 테이블 컬럼 목록과 정책 목록도 함께 표시됩니다.

### 4단계: Python 스크립트 실행

이제 KRX 데이터를 가져올 수 있습니다:

```bash
cd /home/user/stockplatform
python scripts/fetch_krx_from_datagokr.py
```

## Companies 테이블 최종 스키마

수정 후 companies 테이블은 다음 컬럼을 가집니다:

| 컬럼명 | 타입 | 설명 | 비고 |
|--------|------|------|------|
| code | TEXT | 종목코드 | PRIMARY KEY |
| stock_code | TEXT | 종목코드 | code와 동일 |
| corp_name | TEXT | 회사명 | 예: "삼성전자" |
| name_kr | TEXT | 회사명(한글) | 기존 컬럼 (유지) |
| name_en | TEXT | 회사명(영문) | 기존 컬럼 (유지) |
| market | TEXT | 시장구분 | KOSPI, KOSDAQ |
| sector | TEXT | 업종 | 예: "전자", "기타" |
| market_cap | BIGINT | 시가총액 | 단위: 원 |
| listed_shares | BIGINT | 상장주식수 | 단위: 주 |
| updated_at | TIMESTAMP | 업데이트 시간 | 자동 갱신 |

## 트러블슈팅

### Q1: 스크립트 실행 후에도 같은 오류가 발생

**해결:**
```sql
-- 수동으로 모든 정책 확인 및 삭제
SELECT policyname FROM pg_policies WHERE tablename = 'companies';

-- 위에서 나온 정책 이름을 모두 삭제
DROP POLICY IF EXISTS "정책이름" ON companies;
```

### Q2: 컬럼이 추가되지 않음

**해결:**
```sql
-- 컬럼 수동 추가
ALTER TABLE companies ADD COLUMN IF NOT EXISTS stock_code TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS corp_name TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS market_cap BIGINT DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS listed_shares BIGINT DEFAULT 0;
```

### Q3: 데이터가 없음

**원인:** 아직 KRX 데이터를 가져오지 않았음

**해결:**
```bash
# Python 스크립트로 데이터 수집
python scripts/fetch_krx_from_datagokr.py
```

### Q4: Python 스크립트 오류

```
❌ PUBLIC_DATA_API_KEY 환경 변수가 설정되지 않았습니다.
```

**해결:**
`my-research-platform/.env.local` 파일에 추가:
```bash
PUBLIC_DATA_API_KEY=your_api_key_here
```

API 키 발급: https://www.data.go.kr/data/15094775/openapi.do

## 데이터 확인

### Supabase SQL Editor에서 확인

```sql
-- 전체 종목 수 확인
SELECT COUNT(*) as total_companies FROM companies;

-- 시장별 종목 수
SELECT market, COUNT(*) as count
FROM companies
GROUP BY market;

-- 최근 업데이트된 종목 10개
SELECT code, corp_name, market, market_cap, updated_at
FROM companies
ORDER BY updated_at DESC
LIMIT 10;

-- 삼성전자 검색
SELECT * FROM companies
WHERE corp_name LIKE '%삼성전자%';
```

### API로 확인

```bash
# 종목 조회
curl "http://localhost:3000/api/datagokr/krx-stocks?likeItmsNm=삼성"

# 통합 검색
curl "http://localhost:3000/api/datagokr/search?q=삼성전자"
```

## 정기 업데이트

매일 자동으로 KRX 데이터를 업데이트하려면:

### Cron 설정

```bash
crontab -e

# 매일 오후 6시에 실행
0 18 * * * cd /home/user/stockplatform && python scripts/fetch_krx_from_datagokr.py >> logs/krx_fetch.log 2>&1
```

### Vercel Cron 설정

`vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/update-krx-stocks",
      "schedule": "0 18 * * *"
    }
  ]
}
```

## 참고 문서

- 스크립트 상세 가이드: `scripts/README.md`
- data.go.kr API 가이드: `DATA_GO_KR_API.md`
- Companies 테이블 수정 SQL: `my-research-platform/supabase/fix_companies_table.sql`
