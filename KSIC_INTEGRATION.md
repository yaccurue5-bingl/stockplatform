# KSIC (한국표준산업분류) 통합 가이드

## 📋 목차

1. [개요](#개요)
2. [시스템 구조](#시스템-구조)
3. [데이터베이스 스키마](#데이터베이스-스키마)
4. [설치 및 설정](#설치-및-설정)
5. [사용 방법](#사용-방법)
6. [스크립트 상세](#스크립트-상세)
7. [API 레퍼런스](#api-레퍼런스)
8. [문제 해결](#문제-해결)

---

## 개요

이 프로젝트는 **KSIC (한국표준산업분류)** 데이터를 데이터베이스에 통합하고, KRX 상장 기업들에 KSIC 코드를 자동으로 매핑하는 시스템입니다.

### 주요 기능

- ✅ **KSIC 코드 데이터베이스**: 한국표준산업분류 코드 저장 및 관리
- ✅ **자동 매핑**: DART API를 통한 기업-KSIC 자동 매핑
- ✅ **업종 분류**: 투자자 친화적인 상위 업종 분류 시스템
- ✅ **데이터 검증**: 무결성 검증 및 통계 제공
- ✅ **기존 시스템 통합**: `industry_classifier` 모듈과 완벽 통합

### 데이터 흐름

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ DART API    │ --> │ Industry     │ --> │ companies   │
│ (KSIC 코드) │     │ Classifier   │     │ table       │
└─────────────┘     └──────────────┘     └─────────────┘
                            │
                            v
                    ┌──────────────┐
                    │ ksic_codes   │
                    │ table        │
                    └──────────────┘
```

---

## 시스템 구조

### 파일 구조

```
📁 stockplatform/
├── 📁 supabase/
│   └── 📁 migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_disclosure_insights_rcept_dt_nullable.sql
│       └── 003_add_ksic_support.sql          # ⭐ KSIC 지원 추가
│
├── 📁 scripts/
│   ├── 📁 industry_classifier/               # 기존 모듈
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── dart_api.py
│   │   ├── ksic_mapper.py
│   │   ├── pipeline.py
│   │   └── rule_table.py
│   │
│   ├── import_ksic_data.py                   # ⭐ KSIC 데이터 임포트
│   ├── validate_ksic_data.py                 # ⭐ 데이터 검증
│   └── map_companies_to_ksic.py              # ⭐ 기업-KSIC 매핑
│
├── INDUSTRY_CLASSIFIER.md                    # 기존 문서
├── KSIC_INTEGRATION.md                       # ⭐ 이 문서
└── .env                                      # 환경변수 설정
```

---

## 데이터베이스 스키마

### 1. `ksic_codes` 테이블

KSIC 코드 마스터 테이블입니다.

```sql
CREATE TABLE public.ksic_codes (
  ksic_code TEXT PRIMARY KEY,           -- KSIC 코드 (예: "26110", "21")
  ksic_name TEXT NOT NULL,              -- KSIC 분류명
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
  top_industry TEXT,                    -- 상위 업종 (서비스용)
  description TEXT,                     -- 설명
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 2. `companies` 테이블 확장

기존 `companies` 테이블에 KSIC 관련 필드가 추가되었습니다.

```sql
ALTER TABLE public.companies
  ADD COLUMN ksic_code TEXT REFERENCES public.ksic_codes(ksic_code),
  ADD COLUMN ksic_name TEXT,
  ADD COLUMN industry_category TEXT,
  ADD COLUMN corp_code TEXT,
  ADD COLUMN ksic_updated_at TIMESTAMP WITH TIME ZONE;
```

**필드 설명:**
- `ksic_code`: DART에서 가져온 KSIC 산업분류코드
- `ksic_name`: KSIC 산업분류명
- `industry_category`: 상위 업종 (반도체, 바이오 등)
- `corp_code`: DART 기업코드 (8자리)
- `ksic_updated_at`: KSIC 정보 최종 업데이트 시각

### 3. 통계 뷰

#### `industry_statistics` - 업종별 기업 통계

```sql
SELECT * FROM public.industry_statistics;
-- industry_category | company_count | market_count | markets
-- ------------------+---------------+--------------+---------
-- 반도체와 반도체장비 |            45 |            2 | {KOSPI,KOSDAQ}
-- 바이오·제약       |            38 |            2 | {KOSPI,KOSDAQ}
```

#### `ksic_major_statistics` - KSIC 중분류별 통계

```sql
SELECT * FROM public.ksic_major_statistics;
-- major_code | major_name | industry_category | company_count
-- -----------+------------+-------------------+--------------
-- 26         | ...        | 반도체와 반도체장비 |            45
```

### 4. Helper 함수

#### `get_ksic_major_code(ksic_code)` - 중분류 추출

```sql
SELECT get_ksic_major_code('26110');  -- Returns: '26'
SELECT get_ksic_major_code('C2611');  -- Returns: '26'
```

#### `update_company_ksic(...)` - 기업 KSIC 정보 업데이트

```sql
SELECT update_company_ksic(
  p_stock_code := '005930',
  p_ksic_code := '26110',
  p_ksic_name := '반도체 제조업',
  p_industry_category := '반도체와 반도체장비',
  p_corp_code := '00126380'
);
```

---

## 설치 및 설정

### 1. 환경변수 설정

`.env` 파일에 다음 환경변수를 추가하세요:

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key

# DART API (필수)
DART_API_KEY=your-dart-api-key
```

**DART API 키 발급**: https://opendart.fss.or.kr/

### 2. 데이터베이스 마이그레이션

```bash
# Supabase CLI를 사용하는 경우
supabase db push

# 또는 SQL 파일 직접 실행
psql -h your-db-host -U postgres -d postgres -f supabase/migrations/003_add_ksic_support.sql
```

### 3. 의존성 확인

필요한 Python 패키지가 설치되어 있는지 확인하세요:

```bash
pip install supabase python-dotenv pandas openpyxl
```

---

## 사용 방법

### 전체 워크플로우

```bash
# 1. 데이터베이스 마이그레이션 (최초 1회)
supabase db push

# 2. KSIC 코드 데이터 임포트
python scripts/import_ksic_data.py

# 3. 기업-KSIC 매핑 (자동)
python scripts/map_companies_to_ksic.py --unmapped-only

# 4. 데이터 검증
python scripts/validate_ksic_data.py
```

### 주요 시나리오

#### 시나리오 1: 신규 설정 (처음 사용)

```bash
# Step 1: 환경변수 설정 확인
cat .env | grep -E "SUPABASE_URL|DART_API_KEY"

# Step 2: DB 마이그레이션
supabase db push

# Step 3: KSIC 코드 데이터 임포트
python scripts/import_ksic_data.py

# Step 4: 전체 기업 KSIC 매핑
python scripts/map_companies_to_ksic.py

# Step 5: 검증
python scripts/validate_ksic_data.py
```

#### 시나리오 2: 특정 기업만 매핑

```bash
# 삼성전자, SK하이닉스, 네이버만 매핑
python scripts/map_companies_to_ksic.py --stock-codes 005930 000660 035420
```

#### 시나리오 3: KSIC가 없는 기업만 매핑

```bash
# KSIC 코드가 없는 기업만 자동 매핑
python scripts/map_companies_to_ksic.py --unmapped-only
```

#### 시나리오 4: Dry-run 테스트

```bash
# 실제 DB 업데이트 없이 테스트
python scripts/map_companies_to_ksic.py --dry-run --stock-codes 005930
```

#### 시나리오 5: 정기 업데이트 (Cron)

```bash
# crontab에 추가 (매일 새벽 2시)
0 2 * * * cd /path/to/stockplatform && python scripts/map_companies_to_ksic.py --unmapped-only >> /var/log/ksic_update.log 2>&1
```

---

## 스크립트 상세

### 1. `import_ksic_data.py` - KSIC 데이터 임포트

**목적**: KSIC 코드 데이터를 데이터베이스에 임포트

**사용법**:
```bash
python scripts/import_ksic_data.py
```

**동작**:
1. `industry_classifier/rule_table.py`에서 중분류 매핑 로드
2. KSIC 엑셀 파일이 있으면 상세 데이터 로드 (선택)
3. 데이터베이스의 `ksic_codes` 테이블에 upsert
4. 검증 및 통계 출력

**출력 예제**:
```
KSIC 데이터 임포트 시작
✓ KSIC 엑셀 파일 발견: scripts/data/ksic/ksic_industry.xlsx
임포트 완료!
✓ 총 처리 레코드: 1,234
✓ DB 총 레코드: 1,234
✓ 중분류 코드 수: 87
```

---

### 2. `validate_ksic_data.py` - 데이터 검증

**목적**: KSIC 데이터의 무결성 검증

**사용법**:
```bash
# 기본 검증
python scripts/validate_ksic_data.py

# 상세 로깅
python scripts/validate_ksic_data.py --verbose
```

**검증 항목**:
- ✅ KSIC 코드 형식 (숫자, 길이)
- ✅ 필수 필드 누락 검사
- ✅ 중분류 코드 일관성
- ✅ `rule_table.py`와 DB 데이터 일관성
- ✅ 기업-KSIC 매핑 상태

**출력 예제**:
```
KSIC 데이터 검증 리포트
검증 시각: 2026-01-25 10:30:00

✅ 오류 없음
⚠️  경고 (3개):
  1. 125개 기업의 KSIC 코드가 매핑되지 않음 (매핑률: 85.3%)
  2. 중분류 38 상위 업종 불일치: DB='환경·복원', rule_table='환경정화'

📊 통계:
  ksic_codes:
    - total: 1234
    - valid: 1234
    - invalid: 0
  companies_mapping:
    - total_companies: 2500
    - mapped_companies: 2134
    - mapping_rate: 85.36%

✅ 검증 성공! 데이터 무결성 확인됨
```

---

### 3. `map_companies_to_ksic.py` - 기업-KSIC 자동 매핑

**목적**: companies 테이블의 기업들에 KSIC 코드 자동 매핑

**사용법**:
```bash
# 전체 기업 매핑
python scripts/map_companies_to_ksic.py

# 특정 기업만 매핑
python scripts/map_companies_to_ksic.py --stock-codes 005930 000660 035420

# KSIC가 없는 기업만 매핑
python scripts/map_companies_to_ksic.py --unmapped-only

# Dry-run (테스트)
python scripts/map_companies_to_ksic.py --dry-run

# 배치 크기 조절
python scripts/map_companies_to_ksic.py --batch-size 50

# 상세 로깅
python scripts/map_companies_to_ksic.py --verbose
```

**처리 흐름**:
1. DB에서 기업 목록 조회
2. `industry_classifier`를 사용하여 DART API 호출
3. KSIC 코드, 업종 분류 결과 획득
4. companies 테이블 업데이트
5. 통계 출력

**출력 예제**:
```
기업-KSIC 자동 매핑 시작
조회 완료: 250개 기업
진행률: 10/250 (4.0%)
매핑 중: 005930 (삼성전자)
  ✓ 005930: 26110 - 반도체와 반도체장비
...
진행률: 250/250 (100.0%)

기업-KSIC 매핑 결과
처리 시각: 2026-01-25 10:45:00

총 처리 대상:     250개
  ✓ 성공:         235개
  ✗ 실패:          15개
  - 건너뜀:         0개

성공률: 94.0%
```

**API 호출 제한**:
- DART API는 초당 1회 제한
- 스크립트가 자동으로 1초 딜레이 적용
- 대량 처리 시 시간이 소요될 수 있음 (1000개 기업 ≈ 17분)

---

## API 레퍼런스

### Python API

#### `IndustryClassifier.classify(stock_code)`

종목코드로 업종 분류 및 KSIC 코드 조회

```python
from scripts.industry_classifier import IndustryClassifier

classifier = IndustryClassifier()
result = classifier.classify("005930")

print(result)
# {
#   "stock_code": "005930",
#   "corp_code": "00126380",
#   "corp_name": "삼성전자",
#   "ksic_code": "26110",
#   "ksic_name": "반도체 제조업",
#   "middle_class": "26",
#   "top_industry": "반도체와 반도체장비",
#   "success": True,
#   "error": None
# }
```

### SQL API

#### 기업의 KSIC 정보 조회

```sql
-- 기본 조회
SELECT code, name_kr, ksic_code, ksic_name, industry_category
FROM companies
WHERE ksic_code IS NOT NULL;

-- 특정 업종 조회
SELECT code, name_kr, industry_category
FROM companies
WHERE industry_category = '반도체와 반도체장비';

-- 업종별 통계
SELECT * FROM industry_statistics
ORDER BY company_count DESC;
```

#### KSIC 코드 조회

```sql
-- 중분류로 조회
SELECT * FROM ksic_codes
WHERE major_code = '26';

-- 상위 업종으로 조회
SELECT * FROM ksic_codes
WHERE top_industry = '반도체와 반도체장비';

-- 키워드 검색
SELECT ksic_code, ksic_name, top_industry
FROM ksic_codes
WHERE ksic_name LIKE '%반도체%';
```

---

## 문제 해결

### Q1: DART API 키 오류

**증상**:
```
ValueError: DART_API_KEY가 설정되지 않았습니다.
```

**해결**:
1. https://opendart.fss.or.kr/ 에서 API 키 발급
2. `.env` 파일에 `DART_API_KEY=your-key` 추가
3. 스크립트 재실행

---

### Q2: Supabase 연결 오류

**증상**:
```
ValueError: SUPABASE_URL과 SUPABASE_SERVICE_KEY 환경변수가 필요합니다.
```

**해결**:
1. Supabase 프로젝트 설정에서 URL과 키 확인
2. `.env` 파일에 추가:
   ```
   SUPABASE_URL=https://xxx.supabase.co
   SUPABASE_SERVICE_KEY=your-service-key
   ```

---

### Q3: KSIC 매핑 실패율이 높음

**증상**:
```
성공률: 45.0%  (기대치: 90% 이상)
```

**원인**:
- 종목코드가 DART에 등록되지 않음
- 비상장사 또는 특수 종목
- DART API 일시적 오류

**해결**:
1. 로그 확인: `--verbose` 옵션 사용
2. 실패 종목 확인:
   ```python
   # 실패 종목 조회
   SELECT code, name_kr
   FROM companies
   WHERE ksic_code IS NULL;
   ```
3. 수동 매핑 또는 재시도

---

### Q4: 데이터 불일치 경고

**증상**:
```
⚠️  경고: 중분류 38 상위 업종 불일치
```

**해결**:
1. `scripts/industry_classifier/rule_table.py` 확인
2. 필요시 룰 테이블 수정
3. KSIC 데이터 재임포트:
   ```bash
   python scripts/import_ksic_data.py
   ```

---

### Q5: 마이그레이션 실패

**증상**:
```
relation "ksic_codes" already exists
```

**해결**:
이미 테이블이 존재하는 경우입니다. 문제 없습니다.

만약 스키마를 초기화하려면:
```sql
-- 주의: 데이터가 삭제됩니다!
DROP TABLE IF EXISTS ksic_codes CASCADE;
DROP VIEW IF EXISTS industry_statistics CASCADE;
DROP VIEW IF EXISTS ksic_major_statistics CASCADE;

-- 그 다음 마이그레이션 재실행
```

---

## 다음 단계

1. ✅ 환경 설정 완료
2. ✅ DB 마이그레이션 완료
3. ✅ KSIC 데이터 임포트
4. ✅ 기업-KSIC 매핑
5. ✅ 데이터 검증
6. 📌 **서비스 통합**: FastAPI/Next.js에서 KSIC 데이터 활용
7. 📌 **정기 업데이트**: Cron job 설정
8. 📌 **모니터링**: 매핑률 추적 및 알림

---

## 참고 자료

- [Industry Classifier 문서](INDUSTRY_CLASSIFIER.md)
- [DART Open API](https://opendart.fss.or.kr/)
- [통계청 KSIC](https://kssc.kostat.go.kr/)
- [Supabase 문서](https://supabase.com/docs)

---

**문의 및 피드백**

문제가 발생하거나 개선 제안이 있으시면 이슈를 등록해주세요.

**Made with ❤️ for K-Market Insight**
