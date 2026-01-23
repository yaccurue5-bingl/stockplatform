# Data.go.kr API 통합 가이드

공공데이터포털(data.go.kr)의 KRX 상장종목정보 및 기업기본정보 API 통합 문서입니다.

## 목차

1. [개요](#개요)
2. [API 키 발급](#api-키-발급)
3. [환경 설정](#환경-설정)
4. [사용 가능한 API](#사용-가능한-api)
5. [사용 예제](#사용-예제)
6. [API 엔드포인트](#api-엔드포인트)
7. [타입 정의](#타입-정의)

## 개요

이 통합은 다음 두 가지 공공데이터 API를 제공합니다:

1. **KRX 상장종목정보** - KRX에 상장된 종목의 실시간 정보
2. **기업기본정보 V2** - 기업개요, 계열회사, 종속기업 정보

### 왜 data.go.kr을 사용하나요?

- KRX API가 직접 접근이 제한되어 있어 공공데이터포털을 통해 접근
- JSON 형식 지원으로 쉬운 데이터 파싱
- 무료 API 키로 사용 가능
- 안정적인 정부 제공 서비스

## API 키 발급

### 1. 공공데이터포털 회원가입

https://www.data.go.kr 에서 회원가입

### 2. API 신청

#### KRX 상장종목정보 API
- URL: https://www.data.go.kr/data/15094775/openapi.do
- "활용신청" 버튼 클릭
- 승인 대기 (보통 1-2시간 소요)

#### 기업기본정보 V2 API
- URL: https://www.data.go.kr/data/15043184/openapi.do
- "활용신청" 버튼 클릭
- 승인 대기 (보통 1-2시간 소요)

### 3. 인증키 확인

- 마이페이지 > 오픈API > 개발계정
- "일반 인증키(Encoding)" 복사

## 환경 설정

### .env.local 파일에 추가

```bash
DATA_GO_KR_API_KEY=your_api_key_here
```

**주의:** 동일한 API 키로 여러 API 사용 가능

## 사용 가능한 API

### 1. KRX 상장종목정보 API

**제공 데이터:**
- 종목 기본정보 (종목명, 종목코드, ISIN 코드)
- 가격 정보 (시가, 고가, 저가, 종가)
- 거래 정보 (거래량, 거래대금)
- 시장 정보 (시가총액, 상장주식수)

**서비스 함수:**
```typescript
import {
  fetchKrxListedStocks,
  fetchAllKrxStocks
} from '@/lib/api/datagokr';
```

### 2. 기업기본정보 V2 API

**제공 데이터:**
- 기업개요 (설립일, 대표자, 업종, 홈페이지 등)
- 계열회사 정보 (계열사명, 지분율)
- 종속기업 정보 (종속회사명, 지분율)

**서비스 함수:**
```typescript
import {
  fetchCorpOutline,
  fetchCompanyAffiliates,
  fetchConsSubsCompanies,
  fetchCompleteCompanyInfo,
  searchStockWithCompanyInfo
} from '@/lib/api/datagokr';
```

## 사용 예제

### 예제 1: 특정 날짜의 모든 KRX 종목 조회

```typescript
import { fetchAllKrxStocks } from '@/lib/api/datagokr';

const stocks = await fetchAllKrxStocks(
  process.env.DATA_GO_KR_API_KEY!,
  '20240115'
);

console.log(`총 ${stocks.length}개 종목 조회됨`);
```

### 예제 2: 종목명으로 검색

```typescript
import { fetchKrxListedStocks } from '@/lib/api/datagokr';

const samsungStocks = await fetchKrxListedStocks({
  serviceKey: process.env.DATA_GO_KR_API_KEY!,
  likeItmsNm: '삼성',
  basDt: '20240115'
});

samsungStocks.forEach(stock => {
  console.log(`${stock.itmsNm}: ${stock.clpr}원`);
});
```

### 예제 3: 기업 정보 조회

```typescript
import { fetchCorpOutline } from '@/lib/api/datagokr';

const companies = await fetchCorpOutline({
  serviceKey: process.env.DATA_GO_KR_API_KEY!,
  likeCorpNm: '삼성전자',
  basDt: '20240115'
});

companies.forEach(company => {
  console.log(`회사명: ${company.corpNm}`);
  console.log(`대표자: ${company.enpRprFnm}`);
  console.log(`설립일: ${company.enpEstbDt}`);
  console.log(`홈페이지: ${company.enpHmpgUrl}`);
});
```

### 예제 4: 통합 검색 (종목 + 기업정보)

```typescript
import { searchStockWithCompanyInfo } from '@/lib/api/datagokr';

const result = await searchStockWithCompanyInfo(
  process.env.DATA_GO_KR_API_KEY!,
  '삼성전자'
);

if (result) {
  console.log('종목 정보:', result.stock);
  console.log('기업 개요:', result.outline);
  console.log('계열사:', result.affiliates);
  console.log('종속회사:', result.subsidiaries);
}
```

## API 엔드포인트

### 1. KRX 종목 조회

**Endpoint:** `GET /api/datagokr/krx-stocks`

**Parameters:**
- `basDt` (optional): 기준일자 (YYYYMMDD), 기본값: 어제
- `likeItmsNm` (optional): 종목명 검색
- `likeSrtnCd` (optional): 종목코드 검색
- `numOfRows` (optional): 조회 건수, 기본값: 100
- `pageNo` (optional): 페이지 번호, 기본값: 1
- `all` (optional): 'true'로 설정 시 모든 종목 자동 조회

**Examples:**
```bash
# 어제 날짜의 모든 종목 조회 (100개)
curl http://localhost:3000/api/datagokr/krx-stocks

# 특정 날짜의 종목 조회
curl http://localhost:3000/api/datagokr/krx-stocks?basDt=20240115

# 삼성 종목 검색
curl http://localhost:3000/api/datagokr/krx-stocks?likeItmsNm=삼성

# 모든 종목 조회 (자동 pagination)
curl http://localhost:3000/api/datagokr/krx-stocks?all=true&basDt=20240115
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "basDt": "20240115",
  "data": [
    {
      "basDt": "20240115",
      "srtnCd": "005930",
      "isinCd": "KR7005930003",
      "itmsNm": "삼성전자",
      "mrktCtg": "KOSPI",
      "clpr": "75000",
      "vs": "1000",
      "fltRt": "1.35",
      "mkp": "74500",
      "hipr": "75500",
      "lopr": "74000",
      "trqu": "15234567",
      "trPrc": "1142593925000",
      "lstgStCnt": "5969782550",
      "mrktTotAmt": "447733691250000"
    }
  ]
}
```

### 2. 기업 정보 조회

**Endpoint:** `GET /api/datagokr/company`

**Parameters:**
- `type` (required): 조회 유형
  - `outline`: 기업개요
  - `affiliate`: 계열회사
  - `subsidiary`: 종속기업
- `basDt` (optional): 기준일자 (YYYYMMDD), 기본값: 어제
- `likeCorpNm` (optional): 법인명 검색
- `crno` (optional): 법인등록번호
- `corpNm` (optional): 법인명 정확 일치
- `numOfRows` (optional): 조회 건수, 기본값: 100
- `pageNo` (optional): 페이지 번호, 기본값: 1

**Examples:**
```bash
# 기업개요 조회
curl "http://localhost:3000/api/datagokr/company?type=outline&likeCorpNm=삼성전자"

# 계열회사 조회
curl "http://localhost:3000/api/datagokr/company?type=affiliate&likeCorpNm=현대"

# 종속기업 조회
curl "http://localhost:3000/api/datagokr/company?type=subsidiary&crno=1101110012345"
```

**Response (outline):**
```json
{
  "success": true,
  "type": "기업개요",
  "count": 1,
  "basDt": "20240115",
  "data": [
    {
      "basDt": "20240115",
      "crno": "1301110006246",
      "corpNm": "삼성전자주식회사",
      "corpEnsnNm": "SAMSUNG ELECTRONICS CO.,LTD.",
      "enpRprFnm": "한종희",
      "corpRegMrktDcd": "Y",
      "corpRegMrktDcdNm": "유가증권시장",
      "enpEstbDt": "19690113",
      "enpStacMm": "12",
      "enpXchgLisDt": "19751111",
      "enpHmpgUrl": "http://www.samsung.com/sec",
      "enpTlno": "031-200-1114",
      "sicNm": "전자부품 제조업",
      "enpMainBizNm": "전자제품 제조 및 판매"
    }
  ]
}
```

### 3. 통합 검색

**Endpoint:** `GET /api/datagokr/search`

**Parameters:**
- `q` (required): 검색어 (종목명 또는 기업명)
- `basDt` (optional): 기준일자 (YYYYMMDD), 기본값: 어제

**Examples:**
```bash
# 삼성전자 통합 검색
curl "http://localhost:3000/api/datagokr/search?q=삼성전자"

# 특정 날짜로 검색
curl "http://localhost:3000/api/datagokr/search?q=현대차&basDt=20240115"
```

**Response:**
```json
{
  "success": true,
  "query": "삼성전자",
  "basDt": "20240115",
  "found": true,
  "stock": {
    "basDt": "20240115",
    "srtnCd": "005930",
    "itmsNm": "삼성전자",
    "clpr": "75000",
    ...
  },
  "outline": [ ... ],
  "affiliates": [ ... ],
  "subsidiaries": [ ... ]
}
```

## 타입 정의

모든 타입은 `@/types/datagokr.ts`에 정의되어 있습니다.

### 주요 타입

```typescript
// KRX 종목 정보
interface KrxListedStockItem {
  basDt: string;           // 기준일자
  srtnCd: string;          // 단축코드 (종목코드)
  isinCd: string;          // ISIN 코드
  itmsNm: string;          // 종목명
  mrktCtg: string;         // 시장구분 (KOSPI, KOSDAQ)
  clpr: string;            // 종가
  vs: string;              // 전일대비
  fltRt: string;           // 등락률
  mkp: string;             // 시가
  hipr: string;            // 고가
  lopr: string;            // 저가
  trqu: string;            // 거래량
  trPrc: string;           // 거래대금
  lstgStCnt: string;       // 상장주식수
  mrktTotAmt: string;      // 시가총액
}

// 기업 개요
interface CorpOutlineItem {
  basDt: string;           // 기준일자
  crno: string;            // 법인등록번호
  corpNm: string;          // 법인명
  corpEnsnNm: string;      // 법인영문명
  enpRprFnm: string;       // 대표자명
  enpEstbDt: string;       // 설립일자
  enpStacMm: string;       // 결산월
  enpXchgLisDt: string;    // 상장일자
  enpHmpgUrl: string;      // 홈페이지URL
  enpTlno: string;         // 전화번호
  sicNm: string;           // 표준산업분류명
  enpMainBizNm: string;    // 주요사업명
}
```

## 유틸리티 함수

```typescript
import {
  formatDateYYYYMMDD,
  getYesterdayYYYYMMDD
} from '@/lib/api/datagokr';

// 날짜 포맷팅
const today = new Date();
const formattedDate = formatDateYYYYMMDD(today);
// "20240115"

// 어제 날짜 가져오기
const yesterday = getYesterdayYYYYMMDD();
// "20240114"
```

## 주의사항

1. **API 호출 제한**: 공공데이터포털은 일일 호출 제한이 있을 수 있습니다. 대량 조회 시 주의하세요.

2. **데이터 갱신 시간**: KRX 데이터는 영업일 기준으로 갱신됩니다. 주말/공휴일에는 데이터가 없을 수 있습니다.

3. **날짜 형식**: 모든 날짜는 YYYYMMDD 형식 (예: 20240115)

4. **인코딩된 API 키**: 일반 인증키가 아닌 "일반 인증키(Encoding)"를 사용해야 합니다.

5. **응답 데이터 타입**: 모든 숫자 값이 문자열로 반환됩니다. 필요시 파싱하세요.

```typescript
const price = parseInt(stock.clpr.replace(/,/g, ''));
const marketCap = parseFloat(stock.mrktTotAmt);
```

## 트러블슈팅

### 1. API 키 오류

```
Error: DATA_GO_KR_API_KEY not configured
```

**해결:** `.env.local` 파일에 API 키가 설정되어 있는지 확인

### 2. 승인되지 않은 서비스

```
resultCode: "30", resultMsg: "SERVICE_KEY_IS_NOT_REGISTERED_ERROR"
```

**해결:** 공공데이터포털에서 해당 API 승인 여부 확인

### 3. 데이터가 없음

```
{
  "success": true,
  "count": 0,
  "data": []
}
```

**해결:**
- 날짜가 영업일인지 확인
- 검색어가 정확한지 확인
- basDt를 최근 영업일로 변경

## 참고 링크

- [공공데이터포털](https://www.data.go.kr)
- [KRX 상장종목정보 API](https://www.data.go.kr/data/15094775/openapi.do)
- [기업기본정보 V2 API](https://www.data.go.kr/data/15043184/openapi.do)
