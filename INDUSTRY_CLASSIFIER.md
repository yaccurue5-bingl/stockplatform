# Industry Classifier - 종목 업종 자동 분류 시스템

## 개요

`fetch_krx_from_datagokr.py`는 개별 종목의 업종을 가져오지 못하는 문제가 있었습니다.
이를 해결하기 위해 **공공데이터 기반 종목 → 업종 자동 분류 파이프라인**을 구축했습니다.

## 핵심 솔루션

### 문제

- 기존 `fetch_krx_from_datagokr.py`는 종목별 업종 정보를 제공하지 못함
- 웹 스크래핑은 저작권 및 안정성 문제

### 해결책

**공공데이터만 사용하는 업종 분류 파이프라인 구축**

1. **DART API**: 종목코드 → 기업코드 → KSIC 코드
2. **KSIC 중분류**: 투자자가 이해하기 쉬운 업종 분류
3. **룰 테이블**: 서비스 요구사항에 맞춘 상위 업종 매핑

## 시스템 구조

```
📁 scripts/
├── 📁 industry_classifier/          ← 새로 구축한 업종 분류 모듈
│   ├── __init__.py                 # 모듈 초기화
│   ├── config.py                   # 설정 (API 키, 경로 등)
│   ├── rule_table.py               # KSIC → 상위 업종 매핑 룰
│   ├── dart_api.py                 # DART API 클라이언트
│   ├── ksic_mapper.py              # KSIC 매핑 로직
│   ├── pipeline.py                 # 메인 파이프라인
│   └── README.md                   # 상세 문서
│
├── example_industry_classifier.py   # 사용 예제
│
└── 📁 data/
    ├── dart/                        # DART 데이터 (자동 생성)
    │   ├── corpCode.zip
    │   └── CORPCODE.xml
    └── ksic/                        # KSIC 데이터 (선택)
        ├── ksic_industry.xlsx       # 통계청 KSIC 엑셀
        └── rule_table.json          # 매핑 룰 (자동 생성)
```

## 빠른 시작

### 1. 환경 설정

```bash
# 의존성 설치
pip install -r requirements.txt

# .env 파일 생성
cp .env.example .env

# DART_API_KEY 설정
# .env 파일을 열어서 발급받은 API 키를 입력
```

### 2. DART API 키 발급

https://opendart.fss.or.kr/ 에서 무료 발급

### 3. 사용 예제

#### 단일 종목 분류

```python
from industry_classifier import classify_stock_industry

result = classify_stock_industry("005930")

print(f"기업명: {result['corp_name']}")        # 삼성전자
print(f"업종: {result['top_industry']}")       # 반도체와 반도체장비
print(f"KSIC: {result['ksic_code']}")          # 26110
```

#### 일괄 분류

```python
from industry_classifier import batch_classify_stocks

stocks = ["005930", "000660", "035420"]
results = batch_classify_stocks(stocks, save_path="results.json")

for r in results:
    print(f"{r['corp_name']}: {r['top_industry']}")
```

#### 효율적인 사용 (권장)

```python
from industry_classifier import IndustryClassifier

# 인스턴스 한 번 생성
classifier = IndustryClassifier()

# 여러 종목 처리 (corp_code 매핑 재사용)
for stock_code in ["005930", "000660", "035420"]:
    result = classifier.classify(stock_code)
    print(f"{result['corp_name']}: {result['top_industry']}")
```

## 주요 기능

### 1. stock_code → corp_code 매핑

```python
from industry_classifier import DARTClient

client = DARTClient()
corp = client.get_corp_code("005930")
# {'corp_code': '00126380', 'corp_name': '삼성전자', ...}
```

### 2. DART 기업개황 조회

```python
info = client.get_company_info("00126380")
# {'induty_code': '26110', 'induty_name': '반도체 제조업', ...}
```

### 3. KSIC 중분류 기반 업종 분류

```python
from industry_classifier.rule_table import get_top_industry

industry = get_top_industry("26110")  # → "반도체와 반도체장비"
```

### 4. 통합 파이프라인

```python
result = classify_stock_industry("005930")
# {
#   "stock_code": "005930",
#   "corp_name": "삼성전자",
#   "ksic_code": "26110",
#   "ksic_name": "반도체 제조업",
#   "top_industry": "반도체와 반도체장비",
#   "success": true
# }
```

## 실서비스 적용 예시

### FastAPI

```python
from fastapi import FastAPI
from industry_classifier import IndustryClassifier

app = FastAPI()
classifier = IndustryClassifier()

@app.get("/api/stocks/{stock_code}/industry")
async def get_industry(stock_code: str):
    return classifier.classify(stock_code)
```

### Batch / Cron

```bash
# daily_industry_update.sh
python -c "
from industry_classifier import batch_classify_stocks
import json

with open('stock_codes.txt') as f:
    stocks = [line.strip() for line in f]

results = batch_classify_stocks(stocks, save_path='industry_data.json')
print(f'Updated {len(results)} stocks')
"
```

### Database 업데이트

```python
from industry_classifier import IndustryClassifier
from supabase import create_client

classifier = IndustryClassifier()
supabase = create_client(url, key)

stocks = supabase.table('companies').select('stock_code').execute()

for stock in stocks.data:
    result = classifier.classify(stock['stock_code'])

    if result['success']:
        supabase.table('companies').update({
            'industry_category': result['top_industry'],
            'ksic_code': result['ksic_code'],
            'ksic_name': result['ksic_name']
        }).eq('stock_code', stock['stock_code']).execute()
```

## 왜 KSIC 중분류(2자리)를 사용하는가?

- **대분류(1자리)**: 너무 광범위 (예: C = 제조업 전체)
- **소분류(3자리)**: 너무 세분화 → 서비스 운영 복잡
- **중분류(2자리)**: 투자자가 이해하기 쉬운 적절한 수준 ✅

예시:
- KSIC `26` → "반도체와 반도체장비"
- KSIC `21` → "바이오·제약"
- KSIC `64` → "금융"

## 상위 업종 커스터마이징

서비스 요구사항에 맞게 매핑 룰을 수정할 수 있습니다.

```python
# scripts/industry_classifier/rule_table.py

KSIC_TOP_INDUSTRY_RULES = {
    "26": "반도체와 반도체장비",
    "21": "바이오·제약",
    "64": "금융",
    # ... 원하는 대로 수정 가능
}
```

## 데이터 소스

### 1. DART Open API (필수)

- **제공**: 금융감독원
- **사용**: 종목코드 → 기업코드 → KSIC 코드
- **요구사항**: API 키 발급 (무료)
- **URL**: https://opendart.fss.or.kr/

### 2. KSIC 데이터 (선택)

- **제공**: 통계청
- **사용**: KSIC 코드 → 산업명 (상세)
- **요구사항**: 엑셀 파일 다운로드
- **URL**: https://kssc.kostat.go.kr

**참고**: KSIC 파일이 없어도 중분류 기반 매핑은 정상 작동합니다.

## 파일 설명

| 파일 | 역할 | 핵심 기능 |
|------|------|----------|
| `config.py` | 설정 관리 | API 키, 파일 경로, 캐시 설정 |
| `rule_table.py` | 매핑 룰 | KSIC 중분류 → 상위 업종 매핑 |
| `dart_api.py` | DART 클라이언트 | corpCode, 기업개황 API |
| `ksic_mapper.py` | KSIC 매핑 | KSIC 데이터 로드 및 분류 |
| `pipeline.py` | 메인 파이프라인 | 통합 분류 로직 |
| `example_industry_classifier.py` | 예제 | 6가지 사용 예시 |

## API 레퍼런스

### classify_stock_industry(stock_code)

단일 종목 분류

```python
result = classify_stock_industry("005930")
# Returns: dict with industry classification
```

### batch_classify_stocks(stock_codes, save_path=None)

일괄 분류

```python
results = batch_classify_stocks(["005930", "000660"], save_path="output.json")
# Returns: list of classification results
```

### IndustryClassifier

재사용 가능한 분류기

```python
classifier = IndustryClassifier()
result = classifier.classify("005930")
```

## 테스트

```bash
# 예제 실행
cd scripts
python example_industry_classifier.py

# 개별 모듈 테스트
python -m industry_classifier.rule_table
python -m industry_classifier.dart_api
python -m industry_classifier.ksic_mapper
python -m industry_classifier.pipeline
```

## FAQ

**Q: DART API 키가 없으면?**
→ https://opendart.fss.or.kr/ 에서 무료 발급

**Q: KSIC 파일이 꼭 필요한가?**
→ 아니오. 없어도 중분류 기반 매핑 가능

**Q: 상위 업종을 수정하려면?**
→ `rule_table.py`의 `KSIC_TOP_INDUSTRY_RULES` 수정

**Q: API 호출 제한은?**
→ DART는 초당 1회 제한 (자동 처리됨)

**Q: 프로덕션에서 사용 가능한가?**
→ 네, FastAPI/Django/Flask 등 모든 환경 지원

## 다음 단계

1. ✅ DART API 키 발급
2. ✅ 환경 설정 (.env)
3. ✅ 예제 실행 및 테스트
4. 📌 k-marketinsight 서비스 통합
5. 📌 DB 스키마에 업종 필드 추가
6. 📌 정기 업데이트 배치 작업 설정

## 참고 자료

- [상세 문서](scripts/industry_classifier/README.md)
- [DART API 문서](https://opendart.fss.or.kr/guide/main.do)
- [통계청 KSIC](https://kssc.kostat.go.kr)
- [사용 예제](scripts/example_industry_classifier.py)

---

**Made with ❤️ for K-Market Insight**
