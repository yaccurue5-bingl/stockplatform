# Stock Platform - KSIC 데이터 관리 API

KSIC (한국표준산업분류) 데이터 관리 및 기업 분류를 위한 FastAPI 서버

## 🚀 빠른 시작

### 1. 의존성 설치

```bash
pip install -r requirements.txt
```

### 2. 환경변수 설정

`.env` 파일을 생성하고 다음 내용을 입력하세요:

```env
# Supabase 설정
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
SUPABASE_ANON_KEY=your_anon_key

# DART API 설정
DART_API_KEY=your_dart_api_key

# 로깅 레벨
LOG_LEVEL=INFO
```

### 3. 서버 실행

```bash
# 방법 1: Python으로 직접 실행
python main.py

# 방법 2: uvicorn으로 실행
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

서버가 실행되면 다음 URL에서 확인할 수 있습니다:
- **API 문서**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## 📡 API 엔드포인트

### 🏥 헬스 체크

```bash
curl http://localhost:8000/health
```

### 🎯 전체 셋업 (1, 2, 3 모두 실행)

**기존 방식**: 3개 스크립트 개별 실행
```bash
# 1. KSIC 데이터 임포트
python scripts/import_ksic_data.py

# 2. KSIC 데이터 검증
python scripts/validate_ksic_data.py

# 3. 기업-KSIC 매핑
python scripts/map_companies_to_ksic.py
```

**새로운 방식**: API 한 번 호출로 모두 실행 ✨
```bash
curl -X POST http://localhost:8000/api/ksic/setup-all \
  -H "Content-Type: application/json" \
  -d '{
    "skip_import": false,
    "skip_validation": false,
    "skip_mapping": false,
    "unmapped_only": true
  }'
```

### 1️⃣ KSIC 데이터 임포트

KSIC 코드 데이터를 데이터베이스에 임포트합니다.

```bash
curl -X POST http://localhost:8000/api/ksic/import \
  -H "Content-Type: application/json" \
  -d '{"use_excel": true}'
```

### 2️⃣ KSIC 데이터 검증

KSIC 데이터의 무결성을 검증합니다.

```bash
# 기본 검증
curl http://localhost:8000/api/ksic/validate

# 상세 검증
curl http://localhost:8000/api/ksic/validate?verbose=true
```

### 3️⃣ 기업-KSIC 매핑

기업에 KSIC 코드를 자동으로 매핑합니다.

```bash
# 전체 기업 매핑
curl -X POST http://localhost:8000/api/ksic/map-companies \
  -H "Content-Type: application/json" \
  -d '{
    "unmapped_only": true,
    "batch_size": 100,
    "dry_run": false
  }'

# 특정 기업만 매핑
curl -X POST http://localhost:8000/api/ksic/map-companies \
  -H "Content-Type: application/json" \
  -d '{
    "stock_codes": ["005930", "000660", "035420"],
    "unmapped_only": false,
    "dry_run": false
  }'

# Dry-run (테스트)
curl -X POST http://localhost:8000/api/ksic/map-companies \
  -H "Content-Type: application/json" \
  -d '{
    "unmapped_only": true,
    "dry_run": true
  }'
```

### 📊 KSIC 통계

KSIC 및 기업 매핑 통계를 조회합니다.

```bash
curl http://localhost:8000/api/ksic/stats
```

**응답 예시**:
```json
{
  "success": true,
  "message": "KSIC 통계 조회 완료",
  "data": {
    "ksic": {
      "total_codes": 1234,
      "industry_distribution": {
        "제조업": 450,
        "금융업": 89,
        "IT·서비스": 156,
        "...": "..."
      }
    },
    "companies": {
      "total": 2500,
      "mapped": 2350,
      "unmapped": 150,
      "mapping_rate": 94.0
    }
  },
  "timestamp": "2026-01-25T10:30:00.000Z"
}
```

---

## 🗂️ 프로젝트 구조

```
stockplatform/
├── main.py                          # FastAPI 서버 (✨ NEW!)
├── requirements.txt                 # Python 의존성
├── .env                            # 환경변수 (git ignore)
├── .env.example                    # 환경변수 예제
│
├── scripts/                        # 개별 스크립트
│   ├── import_ksic_data.py        # 1. KSIC 데이터 임포트
│   ├── validate_ksic_data.py      # 2. KSIC 데이터 검증
│   ├── map_companies_to_ksic.py   # 3. 기업-KSIC 매핑
│   │
│   └── industry_classifier/        # 산업 분류 모듈
│       ├── __init__.py
│       ├── config.py
│       ├── dart_api.py
│       ├── ksic_mapper.py
│       ├── pipeline.py
│       └── rule_table.py
│
└── README.md                       # 이 파일
```

---

## 💡 주요 기능

### ✅ 전체 자동화
- **기존**: 3개 스크립트를 순서대로 수동 실행
- **개선**: `/api/ksic/setup-all` 한 번 호출로 모든 작업 완료

### 🔄 배치 처리
- API 호출 제한을 준수하는 배치 처리
- 실시간 진행률 추적
- 오류 복구 및 재시도 로직

### 📈 통계 및 모니터링
- KSIC 데이터 분포 확인
- 기업 매핑률 추적
- 검증 리포트 자동 생성

### 🧪 테스트 모드
- Dry-run 모드로 안전하게 테스트
- 실제 DB 업데이트 없이 시뮬레이션

---

## 🛠️ 개발

### API 문서 접속

서버 실행 후 http://localhost:8000/docs 에서 Swagger UI를 통해 모든 API를 테스트할 수 있습니다.

### 로깅

로그 레벨은 `.env` 파일의 `LOG_LEVEL`로 조정할 수 있습니다:
- `DEBUG`: 상세한 디버그 정보
- `INFO`: 일반 정보 (기본값)
- `WARNING`: 경고
- `ERROR`: 오류

---

## 📝 라이선스

MIT License

---

## 🤝 기여

버그 리포트 및 기능 제안은 이슈로 등록해주세요.
