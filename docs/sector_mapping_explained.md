# Sector 매핑 과정 설명

## 1. "매커스" 종목이 Sector "도매"로 매핑되는 과정

### 전체 프로세스

```
종목 "매커스" → DART API → KSIC 코드 → Rule Table → Sector "도매"
```

### 단계별 상세 설명

#### Step 1: 종목 코드 조회
- 종목명: 매커스
- 종목코드: (예: 123456)

#### Step 2: DART API를 통한 KSIC 코드 조회
`scripts/industry_classifier/pipeline.py`의 `classify()` 함수가 실행됨:

1. **종목코드 → 법인코드 변환**
   - `dart_api.py`의 `get_corp_code(stock_code)` 호출
   - DART의 corpCode.xml 파일을 다운로드하여 종목코드를 법인코드로 변환

2. **법인코드 → KSIC 코드 조회**
   - `dart_api.py`의 `get_company_overview(corp_code)` 호출
   - DART API에서 기업개요 정보를 가져옴
   - 응답에서 `induty_code` (KSIC 코드) 추출
   - **매커스의 경우: KSIC 코드가 `46xxx` 형태로 반환됨**
     - 예: `46110`, `46210`, `46390` 등

#### Step 3: KSIC 중분류 코드 추출
`scripts/industry_classifier/ksic_mapper.py`의 `get_middle_class()`:

- KSIC 코드에서 앞 2자리를 추출 (중분류)
- 예: `46110` → `46`
- 예: `C4621` → `46`

#### Step 4: Rule Table 매핑
`scripts/industry_classifier/rule_table.py`의 `KSIC_TOP_INDUSTRY_RULES`:

```python
KSIC_TOP_INDUSTRY_RULES = {
    ...
    "46": "도매",  # ← 이 규칙이 적용됨!
    "47": "소매",
    ...
}
```

- KSIC 중분류 `46`이 한국표준산업분류(KSIC)에서 "도매 및 상품 중개업"을 의미
- Rule Table에서 `46` → `"도매"` 매핑 규칙이 정의되어 있음
- **따라서 매커스는 KSIC 46xxx 코드를 가지고 있어서 "도매" 업종으로 분류됨**

#### Step 5: DB 업데이트
`scripts/map_companies_to_ksic.py`의 `update_company_ksic()`:

```python
update_data = {
    'sector': '도매',  # top_industry 값 (한글)
    'updated_at': datetime.utcnow().isoformat()
}
```

- `companies` 테이블의 `sector` 컬럼에 `"도매"` 저장

---

## 2. KSIC 코드와 업종 분류 체계

### KSIC 중분류 46의 의미
한국표준산업분류(통계청):
- **KSIC 대분류 G**: 도매 및 소매업
- **KSIC 중분류 46**: 도매 및 상품 중개업
  - 46110: 농축산물 도매업
  - 46210: 음식료품 도매업
  - 46390: 기타 생활용품 도매업
  - 46610: 산업용 기계 및 장비 도매업
  - 등등...

### Rule Table의 역할
- 총 **70여 개의 KSIC 중분류** → **60여 개의 서비스 업종**으로 매핑
- 투자자가 이해하기 쉬운 업종명 사용
- 파일: `scripts/industry_classifier/rule_table.py`

주요 매핑 예시:
```python
"26": "반도체와 반도체장비"
"21": "바이오·제약"
"46": "도매"
"47": "소매"
"64": "금융"
"62": "IT·소프트웨어"
```

---

## 3. Sector가 NULL이 되는 경우

### 3.1 DART API에서 데이터를 가져오지 못하는 경우

#### 원인 1: 해당 기업이 DART에 등록되어 있지 않음
- DART는 금융감독원 전자공시시스템
- **모든 상장기업이 의무적으로 등록되어야 하지만, 일부 예외 케이스 존재**:
  - 최근 상장된 기업 (아직 법인코드가 corpCode.xml에 반영되지 않음)
  - 상장폐지 예정 기업
  - KONEX 등 소규모 시장의 일부 기업

#### 원인 2: 종목코드 → 법인코드 매핑 실패
파일 위치: `scripts/industry_classifier/dart_api.py`의 `get_corp_code()`

```python
def get_corp_code(self, stock_code: str) -> Optional[str]:
    """
    종목코드로 법인코드 조회

    Returns:
        법인코드 또는 None (찾지 못한 경우)
    """
```

**실패 케이스**:
- corpCode.xml 파일이 최신이 아님
- 종목코드 형식이 맞지 않음 (예: "A005930" vs "005930")
- XML 파싱 오류

#### 원인 3: DART API 응답에 KSIC 코드가 없음
파일 위치: `scripts/industry_classifier/dart_api.py`의 `get_company_overview()`

```python
def get_company_overview(self, corp_code: str) -> Optional[dict]:
    """
    기업 개황 조회

    응답 예시:
    {
        "corp_name": "삼성전자",
        "induty_code": "26110",  # ← 이 값이 없으면 NULL
        "induty_name": "반도체 제조업",
        ...
    }
    """
```

**실패 케이스**:
- DART에 등록되어 있지만 `induty_code` 필드가 비어있음
- API 응답 오류 (Rate Limit, 네트워크 오류 등)

### 3.2 아직 매핑 스크립트를 실행하지 않은 경우

#### Migration 007의 영향
파일: `supabase/migrations/007_cleanup_companies_table.sql`

```sql
-- sector 컬럼을 NULL로 리셋 (재매핑을 위함)
UPDATE companies SET sector = NULL;
```

- 이 마이그레이션 이후 모든 종목의 `sector`가 `NULL`로 초기화됨
- **반드시 `scripts/map_companies_to_ksic.py`를 실행하여 재매핑 필요**

#### 매핑 스크립트 실행 방법
```bash
# 전체 종목 매핑
python scripts/map_companies_to_ksic.py

# NULL인 종목만 매핑
python scripts/map_companies_to_ksic.py --unmapped-only

# 특정 종목만 매핑
python scripts/map_companies_to_ksic.py --stock-codes 005930 000660
```

### 3.3 Rule Table에 매핑이 없는 경우

#### KSIC 코드는 있지만 Rule Table에 없는 경우
파일: `scripts/industry_classifier/rule_table.py`의 `get_top_industry()`

```python
def get_top_industry(ksic_code: str) -> str:
    """
    Returns:
        상위 업종명 또는 "기타" (매핑이 없을 경우)
    """
    middle_class = numeric_code[:2]
    return KSIC_TOP_INDUSTRY_RULES.get(middle_class, "기타")  # ← "기타" 반환
```

**"기타"로 분류되는 경우**:
- KSIC 중분류가 Rule Table에 정의되지 않음
- 예: KSIC `09` (기타 광업), KSIC `98` (가구 내 고용활동) 등
- **주의**: "기타"는 NULL이 아니라 문자열 "기타"로 저장됨

### 3.4 데이터 검증 실패

#### Sector 값이 유효하지 않은 경우
파일: `scripts/map_companies_to_ksic.py`의 `update_company_ksic()`

```python
# sector 값 유효성 검사
if sector_value and ('http' in sector_value.lower() or
                     any(m in sector_value for m in ['KOSPI', 'KOSDAQ', 'KONEX'])):
    sector_value = '기타'  # ← 잘못된 값이면 '기타'로 처리
```

**검증 실패 케이스**:
- Sector 값이 URL 주소인 경우 (예: "http://...")
- Sector 값이 시장 정보인 경우 (예: "KOSPI", "KOSDAQ")

---

## 요약

### 매커스 → 도매 매핑
1. DART API에서 매커스의 KSIC 코드 조회 → `46xxx`
2. 중분류 추출 → `46`
3. Rule Table 매핑 → `"도매"`
4. DB 업데이트 → `sector = "도매"`

### NULL이 되는 4가지 경우
1. **DART API 실패**: 법인코드 없음, KSIC 코드 없음, API 오류
2. **매핑 스크립트 미실행**: Migration 007 이후 재매핑 필요
3. **Rule Table 미정의**: KSIC 중분류가 없음 (→ "기타"로 저장, NULL 아님)
4. **데이터 검증 실패**: URL이나 시장 정보가 들어감 (→ "기타"로 저장)

### 해결 방법
```bash
# NULL인 종목 재매핑
python scripts/map_companies_to_ksic.py --unmapped-only
```

---

## 참고 자료

- 한국표준산업분류(KSIC): https://kssc.kostat.go.kr
- DART 오픈API: https://opendart.fss.or.kr
- 프로젝트 파일:
  - `scripts/industry_classifier/pipeline.py`
  - `scripts/industry_classifier/rule_table.py`
  - `scripts/map_companies_to_ksic.py`
