# DART API 통합 가이드

이 문서는 DART API의 기업코드(corp_code) 데이터를 데이터베이스에 저장하고 활용하는 방법을 설명합니다.

## 📋 개요

기존에는 DART API에서 `corpCode.xml` 파일을 매번 다운로드하여 파싱했지만, 이제는 DB에 저장하여 빠르게 조회할 수 있습니다.

### 주요 개선 사항

1. **성능 향상**: XML 파일 다운로드/파싱 없이 DB에서 즉시 조회
2. **환경변수 관리**: DART_API_KEY를 항상 `.env.local`에서 읽음
3. **간편한 사용**: `DARTDBClient`로 쉽게 corp_code 조회

## 🚀 빠른 시작

### 1. 환경변수 설정

`.env.local` 파일에 DART API 키가 설정되어 있는지 확인하세요:

```bash
DART_API_KEY=your_dart_api_key_here
```

> DART API 키는 [DART 오픈 API](https://opendart.fss.or.kr/)에서 발급받을 수 있습니다.

### 2. 통합 설정 실행

다음 스크립트를 실행하여 모든 설정을 자동으로 완료합니다:

```bash
python scripts/setup_dart_integration.py
```

이 스크립트는 다음 작업을 수행합니다:
1. ✅ 환경변수 확인
2. ✅ `dart_corp_codes` 테이블 생성 (필요시 SQL 제공)
3. ✅ DART API에서 데이터 다운로드 및 DB 저장
4. ✅ DB 클라이언트 테스트

## 📂 파일 구조

```
stockplatform/
├── supabase/
│   └── migrations/
│       └── 008_add_dart_corp_codes_table.sql  # DB 마이그레이션
│
├── scripts/
│   ├── setup_dart_integration.py              # 통합 설정 스크립트
│   ├── sync_dart_corp_codes.py                # 데이터 동기화 스크립트
│   │
│   └── industry_classifier/
│       ├── config.py                          # 설정 (.env.local 로드)
│       ├── dart_api.py                        # 기존 XML 기반 클라이언트
│       └── dart_db_client.py                  # 새로운 DB 기반 클라이언트
│
└── utils/
    └── env_loader.py                          # 환경변수 로더
```

## 📊 데이터베이스 스키마

### `dart_corp_codes` 테이블

| 컬럼명        | 타입      | 설명                     |
|---------------|-----------|--------------------------|
| stock_code    | TEXT (PK) | 종목코드 (6자리, 예: "005930") |
| corp_code     | TEXT      | 기업코드 (8자리, 예: "00126380") |
| corp_name     | TEXT      | 기업명 (예: "삼성전자")    |
| modify_date   | TEXT      | DART 수정일자             |
| created_at    | TIMESTAMP | 생성일시                  |
| updated_at    | TIMESTAMP | 수정일시                  |

### 인덱스

- `stock_code` (Primary Key)
- `corp_code` (Unique)
- `corp_name` (검색용)
- `modify_date` (정렬용)

## 💻 사용 방법

### 기본 사용 (DB 기반 클라이언트)

```python
from scripts.industry_classifier.dart_db_client import DARTDBClient

# 클라이언트 생성
client = DARTDBClient()

# 1. 종목코드로 기업코드 조회
corp_info = client.get_corp_code("005930")
print(corp_info)
# {
#     'stock_code': '005930',
#     'corp_code': '00126380',
#     'corp_name': '삼성전자',
#     'modify_date': '20231201'
# }

# 2. 종목코드로 업종 정보 조회 (DART API 호출 포함)
industry_info = client.get_company_industry("005930")
print(industry_info)
# {
#     'stock_code': '005930',
#     'corp_code': '00126380',
#     'corp_name': '삼성전자',
#     'induty_code': '264',
#     'induty_name': '반도체 및 기타 전자부품 제조업'
# }

# 3. 기업명으로 검색
results = client.search_by_name("삼성", limit=5)
for company in results:
    print(f"{company['corp_name']} ({company['stock_code']})")
```

### 데이터 동기화

DART API에서 최신 데이터를 다운로드하여 DB를 업데이트합니다:

```bash
# 캐시된 XML 파일 사용 (빠름)
python scripts/sync_dart_corp_codes.py

# DART API에서 새로 다운로드 (느림)
python scripts/sync_dart_corp_codes.py --force-refresh
```

## 🔄 기존 코드와의 호환성

기존 `dart_api.py`의 `DARTClient`는 그대로 유지됩니다.

### 기존 방식 (XML 기반)

```python
from scripts.industry_classifier.dart_api import DARTClient

client = DARTClient()
corp_code_map = client.load_corp_code_map()  # XML 다운로드/파싱
corp_info = client.get_corp_code("005930")
```

### 새로운 방식 (DB 기반) ⭐️ 권장

```python
from scripts.industry_classifier.dart_db_client import DARTDBClient

client = DARTDBClient()
corp_info = client.get_corp_code("005930")  # DB에서 즉시 조회
```

## 📝 스크립트 설명

### 1. `setup_dart_integration.py` (통합 설정)

모든 설정을 자동으로 수행하는 올인원 스크립트입니다.

```bash
python scripts/setup_dart_integration.py
```

### 2. `sync_dart_corp_codes.py` (데이터 동기화)

DART API에서 corp_code 데이터를 다운로드하여 DB에 저장합니다.

```bash
# 기본 실행 (캐시 사용)
python scripts/sync_dart_corp_codes.py

# 강제 새로고침 (DART API에서 새로 다운로드)
python scripts/sync_dart_corp_codes.py --force-refresh
```

**실행 흐름:**
1. `.env.local`에서 `DART_API_KEY` 읽기
2. DART API에서 `corpCode.xml` 다운로드 (또는 캐시 사용)
3. XML 파싱하여 `dart_corp_codes` 테이블에 저장
4. 검증 (삼성전자 데이터 확인)

### 3. `apply_dart_migration.py` (마이그레이션 적용)

`dart_corp_codes` 테이블을 생성하는 마이그레이션을 적용합니다.

```bash
python scripts/apply_dart_migration.py
```

> **참고:** Supabase에서 직접 SQL 실행 권한이 없을 수 있습니다.
> 이 경우 `setup_dart_integration.py`가 SQL을 출력하므로,
> Supabase SQL Editor에서 수동으로 실행하세요.

## ⚙️ 환경변수 설정

### `.env.local`

프로젝트 루트의 `.env.local` 파일:

```bash
# DART API
DART_API_KEY=ee85e03f1d3874bb3c1b41284d77cfbba123f34a

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://rxcwqsolfrjhomeusyza.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### 환경변수 로드 우선순위

`utils/env_loader.py`는 다음 순서로 `.env.local`을 찾습니다:

1. `{PROJECT_ROOT}/.env.local`
2. `/home/user/stockplatform/.env.local` (Linux)
3. `C:/stockplatform/.env.local` (Windows)
4. `{PROJECT_ROOT}/.env` (fallback)

## 🔧 트러블슈팅

### 1. DART_API_KEY 오류

```
ValueError: DART_API_KEY가 설정되지 않았습니다.
```

**해결:** `.env.local` 파일에 `DART_API_KEY`를 추가하세요.

### 2. Supabase 연결 오류

```
Supabase 연결 실패
```

**해결:** `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`를 확인하세요.

### 3. 테이블이 존재하지 않음

```
relation "dart_corp_codes" does not exist
```

**해결:**
1. Supabase Dashboard → SQL Editor
2. `supabase/migrations/008_add_dart_corp_codes_table.sql` 파일의 내용을 복사
3. SQL Editor에 붙여넣고 실행

### 4. 데이터 동기화 실패

```
배치 저장 실패
```

**해결:**
- 인터넷 연결 확인
- DART API 서버 상태 확인
- `--force-refresh` 플래그로 재시도

## 📅 데이터 업데이트 주기

DART에서 제공하는 `corpCode.xml`은 정기적으로 업데이트됩니다.

**권장 업데이트 주기:**
- 월 1회: `python scripts/sync_dart_corp_codes.py --force-refresh`
- 또는 Cron Job으로 자동화:
  ```bash
  # 매월 1일 오전 2시에 실행
  0 2 1 * * cd /home/user/stockplatform && python scripts/sync_dart_corp_codes.py --force-refresh
  ```

## 🎯 다음 단계

1. **업종 분류 자동화**: `map_companies_to_ksic.py`와 통합하여 KSIC 코드 자동 매핑
2. **캐싱**: Redis를 사용하여 자주 조회되는 데이터 캐싱
3. **API 엔드포인트**: Next.js API 라우트에서 `DARTDBClient` 사용
4. **모니터링**: 데이터 동기화 상태 모니터링 및 알림

## 📚 참고 자료

- [DART 오픈 API 가이드](https://opendart.fss.or.kr/guide/main.do)
- [DART API 기업개황 조회](https://opendart.fss.or.kr/api/company.json)
- [Supabase Python 클라이언트](https://supabase.com/docs/reference/python)

---

**문제가 발생하면:**
- GitHub Issues에 문제를 보고해주세요
- 로그 파일을 확인하세요
- `setup_dart_integration.py`를 다시 실행해보세요
