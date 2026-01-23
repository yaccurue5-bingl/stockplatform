# KRX 종목 데이터 수집 스크립트

## 개요

KRX(한국거래소) 상장 종목 정보를 수집하여 Supabase에 저장하는 Python 스크립트입니다.

## 스크립트 종류

### 1. fetch_krx_from_datagokr.py (권장) ✅

**data.go.kr 공공데이터 API 사용**

```bash
python scripts/fetch_krx_from_datagokr.py
```

**장점:**
- ✅ 안정적인 공공 API
- ✅ JSON 형식으로 파싱 쉬움
- ✅ 정부 제공 서비스로 신뢰도 높음
- ✅ OTP 인증 불필요

**단점:**
- ⚠️ 업종(sector) 정보 미제공 (기본값 '기타'로 설정)
- ⚠️ API 신청 및 승인 필요 (1-2시간 소요)

### 2. fetch_all_krx_stocks_with_sector.py (구버전)

**KRX 웹사이트 직접 크롤링 (OTP 방식)**

```bash
python scripts/fetch_all_krx_stocks_with_sector.py
```

**문제점:**
- ❌ KRX OTP 인증 방식 변경으로 자주 실패
- ❌ 세션 관리 복잡
- ❌ 에러 처리 어려움

**장점:**
- ✅ 업종(sector) 정보 포함

## 설치 및 설정

### 1. Python 패키지 설치

```bash
pip install requests python-dotenv supabase
```

### 2. 환경 변수 설정

`my-research-platform/.env.local` 파일에 다음을 추가:

```bash
# Supabase (이미 설정되어 있음)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# data.go.kr API 키 (새로 추가 필요)
PUBLIC_DATA_API_KEY=your_api_key_here
```

### 3. data.go.kr API 키 발급

1. https://www.data.go.kr 회원가입
2. [KRX 상장종목정보 API](https://www.data.go.kr/data/15094775/openapi.do) 활용신청
3. 승인 대기 (1-2시간)
4. 승인 후 "일반 인증키(Encoding)" 복사
5. `.env.local`에 `PUBLIC_DATA_API_KEY`로 추가

## 사용법

### fetch_krx_from_datagokr.py 실행

```bash
# 프로젝트 루트에서 실행
cd /home/user/stockplatform
python scripts/fetch_krx_from_datagokr.py
```

**실행 결과 예시:**
```
============================================================
🚀 KRX 종목 정보 수집 시작 (data.go.kr API)
============================================================
✅ 환경 변수 로드 완료: /home/user/stockplatform/my-research-platform/.env.local
📅 기준일자: 20240122

📊 data.go.kr API를 통해 KRX 종목 정보 수집 중 (기준일: 20240122)...
   📡 API 호출 중 (페이지 1)...
   ✅ 페이지 1: 1000개 조회 (누적: 1000개)
   📡 API 호출 중 (페이지 2)...
   ✅ 페이지 2: 1000개 조회 (누적: 2000개)
   📡 API 호출 중 (페이지 3)...
   ✅ 페이지 3: 523개 조회 (누적: 2523개)

✅ 총 2523개 종목 조회 완료
✅ 2523개 종목 변환 완료

💾 Supabase 저장 중 (2523개)...
   ✅ Batch 1 저장 완료 (100개)
   ✅ Batch 2 저장 완료 (100개)
   ...
   ✅ Batch 26 저장 완료 (23개)

============================================================
🎉 최종 완료
   ✅ 성공: 2523개
   ❌ 실패: 0개
============================================================
```

## 데이터 구조

### Supabase companies 테이블

```sql
CREATE TABLE companies (
  code TEXT PRIMARY KEY,          -- 종목코드 (예: "005930")
  stock_code TEXT,                -- 종목코드 (중복)
  corp_name TEXT,                 -- 회사명 (예: "삼성전자")
  market TEXT,                    -- 시장 (KOSPI, KOSDAQ)
  sector TEXT,                    -- 업종 (fetch_krx_from_datagokr.py는 '기타'로 설정)
  market_cap BIGINT,              -- 시가총액
  listed_shares BIGINT,           -- 상장주식수
  updated_at TIMESTAMP            -- 마지막 업데이트 시간
);
```

## 데이터 비교

| 항목 | fetch_krx_from_datagokr.py | fetch_all_krx_stocks_with_sector.py |
|------|---------------------------|-------------------------------------|
| 종목코드 | ✅ | ✅ |
| 회사명 | ✅ | ✅ |
| 시장구분 | ✅ | ✅ |
| 업종정보 | ❌ (기본값 '기타') | ✅ |
| 시가총액 | ✅ | ✅ |
| 상장주식수 | ✅ | ✅ |
| 안정성 | ✅ 높음 | ⚠️ 낮음 |

## 자동화 (Cron)

### 매일 자동 실행 설정

```bash
# crontab 편집
crontab -e

# 매일 오후 6시에 실행
0 18 * * * cd /home/user/stockplatform && python scripts/fetch_krx_from_datagokr.py >> logs/krx_fetch.log 2>&1
```

### Vercel Cron 사용 (Next.js)

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

API 라우트 생성 (`app/api/cron/update-krx-stocks/route.ts`):
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  // Cron secret 확인
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { stdout, stderr } = await execAsync(
      'python scripts/fetch_krx_from_datagokr.py',
      { cwd: '/home/user/stockplatform' }
    );

    return NextResponse.json({
      success: true,
      stdout,
      stderr
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}
```

## 트러블슈팅

### 1. API 키 오류

```
❌ PUBLIC_DATA_API_KEY 환경 변수가 설정되지 않았습니다.
```

**해결:** `.env.local` 파일에 `PUBLIC_DATA_API_KEY` 추가

### 2. 조회된 종목이 없음

```
❌ 조회된 종목이 없습니다.
💡 팁: 영업일이 아니거나 API 키가 잘못되었을 수 있습니다.
```

**해결:**
- 영업일 확인 (주말/공휴일은 데이터 없음)
- API 키 승인 여부 확인
- API 키가 "일반 인증키(Encoding)" 인지 확인

### 3. Supabase 연결 실패

```
❌ Supabase 환경 변수 누락
```

**해결:** `.env.local` 파일에 Supabase 설정 확인

### 4. 업종 정보가 '기타'로 표시됨

**원인:** data.go.kr API는 업종 정보를 제공하지 않음

**해결 방법:**
1. 기존 `fetch_all_krx_stocks_with_sector.py`를 수정하여 사용 (OTP 문제 해결 필요)
2. 별도로 업종 정보 API 사용 (DART, KIS 등)
3. 수동으로 업종 매핑 테이블 생성

## 권장 사항

1. **초기 데이터 수집:** `fetch_krx_from_datagokr.py` 사용 (안정적)
2. **업종 정보 필요:** DART API 또는 별도 업종 DB 연동
3. **일일 업데이트:** Cron으로 자동화
4. **모니터링:** 로그 파일 확인 및 Slack/Discord 알림 연동

## 참고 링크

- [data.go.kr 공공데이터포털](https://www.data.go.kr)
- [KRX 상장종목정보 API](https://www.data.go.kr/data/15094775/openapi.do)
- [Supabase Python Client](https://github.com/supabase-community/supabase-py)
