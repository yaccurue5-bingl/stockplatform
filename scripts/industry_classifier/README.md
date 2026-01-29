# Industry Classifier for K-Market Insight

공공데이터 기반 한국 주식 종목 업종 자동 분류 파이프라인

## 목차

- [개요](#개요)
- [주요 기능](#주요-기능)
- [시스템 아키텍처](#시스템-아키텍처)
- [설치](#설치)
- [설정](#설정)
- [사용법](#사용법)
- [파일 구조](#파일-구조)
- [API 레퍼런스](#api-레퍼런스)
- [FAQ](#faq)

---

## 개요

**Industry Classifier**는 k-marketinsight 서비스를 위한 종목 업종 자동 분류 시스템입니다.

### 목표

**입력**: 종목코드 (예: 005930)

**출력**:
- KSIC 산업코드
- KSIC 산업명
- 상위 업종 (예: 반도체와 반도체장비)

### 핵심 원칙

✅ **저작권 문제 없는 공공데이터만 사용**
- 금융감독원 DART Open API
- 통계청 KSIC (한국표준산업분류)

✅ **웹 스크래핑 금지**

✅ **실서비스에 바로 적용 가능한 구조**

---

## 주요 기능

### 1. 종목코드 → 기업코드 매핑

DART의 `corpCode.zip`을 활용하여 종목코드(stock_code)를 기업코드(corp_code)로 변환합니다.

```python
from industry_classifier import DARTClient

client = DARTClient()
corp_info = client.get_corp_code("005930")
# → {"corp_code": "00126380", "corp_name": "삼성전자", ...}
```

### 2. DART 기업개황 API

기업개황 API를 통해 KSIC 코드와 산업명을 추출합니다.

```python
company_info = client.get_company_info("00126380")
# → {"induty_code": "26110", "induty_name": "반도체 제조업", ...}
```

### 3. KSIC 중분류 기반 상위 업종 매핑

**왜 KSIC 중분류(2자리)를 사용하는가?**

- **대분류(1자리)**: 너무 광범위 (예: C = 제조업 전체)
- **소분류(3자리)**: 너무 세분화되어 서비스 운영이 복잡
- **중분류(2자리)**: 투자자가 이해하기 쉬운 적절한 수준

```python
from industry_classifier import get_top_industry

industry = get_top_industry("26110")
# → "반도체와 반도체장비"
```

### 4. 통합 파이프라인

전체 프로세스를 하나의 함수로 실행합니다.

```python
from industry_classifier import classify_stock_industry

result = classify_stock_industry("005930")
# {
#   "stock_code": "005930",
#   "corp_name": "삼성전자",
#   "ksic_code": "26110",
#   "ksic_name": "반도체 제조업",
#   "top_industry": "반도체와 반도체장비",
#   "success": True
# }
```

---

## 시스템 아키텍처

```
종목코드 (005930)
    ↓
┌─────────────────────────────────────┐
│  1. stock_code → corp_code 매핑     │
│     (DART corpCode.xml)             │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  2. DART 기업개황 API 호출          │
│     → induty_code, induty_name      │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  3. KSIC 코드 추출                  │
│     (예: "26110")                   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  4. KSIC 중분류(2자리) 추출         │
│     (예: "26")                      │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  5. 상위 업종 매핑 (RULE TABLE)     │
│     "26" → "반도체와 반도체장비"    │
└─────────────────────────────────────┘
    ↓
최종 결과 반환
```

---

## 설치

### 1. 의존성 설치

```bash
cd /home/user/stockplatform
pip install -r requirements.txt
```

필수 패키지:
- `requests` - DART API 호출
- `pandas` - KSIC 데이터 처리
- `openpyxl` - KSIC 엑셀 파일 읽기
- `python-dotenv` - 환경변수 관리

### 2. DART API 키 발급

1. [DART Open API](https://opendart.fss.or.kr/) 접속
2. 회원가입 및 로그인
3. API 인증키 발급
4. 발급받은 키를 환경변수에 설정

---

## 설정

### 환경변수 설정

프로젝트 루트에 `.env` 파일 생성:

```bash
# .env
DART_API_KEY=your_dart_api_key_here
```

또는 환경변수로 직접 설정:

```bash
export DART_API_KEY="your_dart_api_key_here"
```

### KSIC 데이터 (선택)

KSIC 엑셀 파일이 있으면 더 정확한 산업명을 얻을 수 있습니다.

1. [통계청 KSIC](https://kssc.kostat.go.kr:8443/ksscNew_web/index.jsp)에서 엑셀 파일 다운로드
2. `scripts/data/ksic/ksic_industry.xlsx`에 저장

**주의**: KSIC 파일이 없어도 중분류 기반 매핑은 정상 작동합니다.

---

## 사용법

### 기본 사용법

#### 1. 단일 종목 분류

```python
from industry_classifier import classify_stock_industry

result = classify_stock_industry("005930")

print(f"기업명: {result['corp_name']}")
print(f"업종: {result['top_industry']}")
```

#### 2. 일괄 분류

```python
from industry_classifier import batch_classify_stocks

stock_codes = ["005930", "000660", "035420"]
results = batch_classify_stocks(
    stock_codes,
    save_path="results.json"
)

for r in results:
    print(f"{r['corp_name']}: {r['top_industry']}")
```

#### 3. Classifier 인스턴스 재사용 (권장)

많은 종목을 분류할 때는 인스턴스를 재사용하세요.

```python
from industry_classifier import IndustryClassifier

classifier = IndustryClassifier()

# corp_code 매핑을 한 번만 로드
for stock_code in ["005930", "000660", "035420"]:
    result = classifier.classify(stock_code)
    print(f"{result['corp_name']}: {result['top_industry']}")
```

### 고급 사용법

#### FastAPI 통합

```python
from fastapi import FastAPI
from industry_classifier import IndustryClassifier

app = FastAPI()
classifier = IndustryClassifier()

@app.get("/api/stocks/{stock_code}/industry")
async def get_industry(stock_code: str):
    result = classifier.classify(stock_code)
    return result
```

#### 배치 작업 / Cron

```python
#!/usr/bin/env python3
from industry_classifier import batch_classify_stocks
from datetime import datetime

# 모든 종목 분류
with open("stock_codes.txt") as f:
    stock_codes = [line.strip() for line in f]

results = batch_classify_stocks(
    stock_codes,
    save_path=f"industry_classification_{datetime.now():%Y%m%d}.json"
)

print(f"분류 완료: {len(results)}개")
```

#### 데이터베이스 저장

```python
from industry_classifier import IndustryClassifier
import psycopg2

classifier = IndustryClassifier()
conn = psycopg2.connect("dbname=mydb user=myuser")
cur = conn.cursor()

stock_codes = ["005930", "000660"]

for stock_code in stock_codes:
    result = classifier.classify(stock_code)

    if result['success']:
        cur.execute("""
            UPDATE companies
            SET industry_category = %s,
                ksic_code = %s,
                ksic_name = %s,
                updated_at = NOW()
            WHERE stock_code = %s
        """, (
            result['top_industry'],
            result['ksic_code'],
            result['ksic_name'],
            stock_code
        ))

conn.commit()
```

### 예제 파일 실행

```bash
cd scripts
python example_industry_classifier.py
```

---

## 파일 구조

```
scripts/
├── industry_classifier/          # 메인 모듈
│   ├── __init__.py              # 모듈 초기화
│   ├── config.py                # 설정 관리
│   ├── rule_table.py            # KSIC → 상위 업종 매핑 룰
│   ├── dart_api.py              # DART API 클라이언트
│   ├── ksic_mapper.py           # KSIC 매핑 로직
│   ├── pipeline.py              # 메인 파이프라인
│   └── README.md                # 이 문서
│
├── example_industry_classifier.py  # 사용 예제
│
└── data/                        # 데이터 디렉토리
    ├── dart/
    │   ├── corpCode.zip         # DART 기업코드 (자동 다운로드)
    │   └── CORPCODE.xml         # 압축 해제된 XML
    └── ksic/
        ├── ksic_industry.xlsx   # KSIC 데이터 (선택)
        └── rule_table.json      # 매핑 룰 (자동 생성)
```

---

## API 레퍼런스

### classify_stock_industry()

단일 종목 분류 (간편 함수)

```python
def classify_stock_industry(
    stock_code: str,
    dart_api_key: str = None
) -> Optional[dict]
```

**파라미터**:
- `stock_code`: 종목코드 (예: "005930")
- `dart_api_key`: DART API 키 (선택, 없으면 환경변수 사용)

**반환값**:
```python
{
    "stock_code": "005930",
    "corp_code": "00126380",
    "corp_name": "삼성전자",
    "ksic_code": "26110",
    "ksic_name": "반도체 제조업",
    "middle_class": "26",
    "top_industry": "반도체와 반도체장비",
    "success": True,
    "error": None
}
```

### batch_classify_stocks()

일괄 분류 (간편 함수)

```python
def batch_classify_stocks(
    stock_codes: List[str],
    dart_api_key: str = None,
    save_path: str = None
) -> List[dict]
```

**파라미터**:
- `stock_codes`: 종목코드 리스트
- `dart_api_key`: DART API 키 (선택)
- `save_path`: 결과 저장 경로 (선택)

**반환값**: 분류 결과 리스트

### IndustryClassifier

메인 분류 클래스

```python
class IndustryClassifier:
    def __init__(self, dart_api_key: str = None)
    def classify(self, stock_code: str) -> Optional[dict]
    def batch_classify(self, stock_codes: List[str], save_path: str = None) -> List[dict]
```

### DARTClient

DART API 클라이언트

```python
class DARTClient:
    def __init__(self, api_key: str = None)
    def download_corp_code(self, force_refresh: bool = False) -> Path
    def load_corp_code_map(self, force_refresh: bool = False) -> dict
    def get_corp_code(self, stock_code: str) -> Optional[dict]
    def get_company_info(self, corp_code: str) -> Optional[dict]
    def get_company_industry(self, stock_code: str) -> Optional[dict]
```

### KSICMapper

KSIC 매핑 클래스

```python
class KSICMapper:
    def __init__(self, excel_path: Path = None)
    def load_ksic_data(self, sheet_name: str = 0) -> pd.DataFrame
    def build_ksic_map(self) -> dict
    def get_ksic_info(self, ksic_code: str) -> Optional[dict]
    def classify_industry(self, ksic_code: str) -> dict
```

---

## FAQ

### Q1. DART API 키가 없으면 사용할 수 없나요?

A: 네, DART API 키는 필수입니다. [DART 홈페이지](https://opendart.fss.or.kr/)에서 무료로 발급받을 수 있습니다.

### Q2. KSIC 엑셀 파일이 꼭 필요한가요?

A: 아니오. KSIC 파일이 없어도 중분류 기반 매핑은 정상 작동합니다. 다만 KSIC 파일이 있으면 더 정확한 산업명을 얻을 수 있습니다.

### Q3. 상위 업종 매핑을 커스터마이징할 수 있나요?

A: 네, `rule_table.py`의 `KSIC_TOP_INDUSTRY_RULES` 딕셔너리를 수정하면 됩니다.

```python
# rule_table.py
KSIC_TOP_INDUSTRY_RULES = {
    "26": "반도체와 반도체장비",  # 원하는 대로 수정
    "21": "바이오·제약",
    # ...
}
```

### Q4. API 호출 속도 제한이 있나요?

A: DART API는 초당 1회 제한이 있습니다. `DARTClient`에서 자동으로 처리합니다.

### Q5. 캐시 기능이 있나요?

A: corp_code 매핑은 한 번 로드하면 인스턴스가 살아있는 동안 재사용됩니다. 파일 캐시는 `config.py`에서 설정할 수 있습니다.

### Q6. 에러 처리는 어떻게 되나요?

A: 모든 함수는 성공/실패 상태를 반환합니다.

```python
result = classify_stock_industry("999999")  # 존재하지 않는 종목

if not result['success']:
    print(f"오류: {result['error']}")
```

### Q7. 프로덕션 환경에서 사용해도 되나요?

A: 네, FastAPI, Django, Flask 등 어떤 프레임워크에서든 사용 가능합니다. 다만 다음 사항을 권장합니다:

- `IndustryClassifier` 인스턴스를 싱글톤으로 관리
- 결과를 DB에 캐싱
- 비동기 처리 고려

### Q8. 업종 분류 정확도는?

A: DART에서 제공하는 공식 KSIC 코드를 사용하므로 정확도는 DART 데이터의 정확도와 동일합니다.

### Q9. 상위 업종 목록을 확인하려면?

```python
from industry_classifier.rule_table import get_all_top_industries

industries = get_all_top_industries()
print(industries)
# ['IT·소프트웨어', '금융', '반도체와 반도체장비', ...]
```

### Q10. 비상장사도 분류할 수 있나요?

A: DART에 등록된 법인이라면 가능합니다. 다만 `stock_code` 대신 `corp_code`를 사용해야 합니다.

```python
client = DARTClient()
company_info = client.get_company_info("00126380")  # corp_code 직접 사용
```

---

## 라이선스

이 프로젝트는 k-marketinsight 서비스의 일부입니다.

## 문의

기술적인 문의사항이나 버그 리포트는 프로젝트 리포지토리의 Issues를 이용해주세요.

---

**Made with ❤️ for K-Market Insight**
