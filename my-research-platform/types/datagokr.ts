/**
 * Types for data.go.kr (공공데이터포털) API
 *
 * Includes:
 * 1. KRX Listed Stock Information (KRX 상장종목정보)
 * 2. Company Basic Information (기업기본정보)
 */

// ===== Common Types =====

export interface DataGoKrResponse<T> {
  response: {
    header: {
      resultCode: string; // "00" for success
      resultMsg: string;
    };
    body: {
      items?: {
        item: T | T[];
      };
      numOfRows?: number;
      pageNo?: number;
      totalCount?: number;
    };
  };
}

// ===== 1. KRX Listed Stock Information (상장종목정보) =====

export interface KrxListedStockParams {
  serviceKey: string;
  numOfRows?: number;
  pageNo?: number;
  resultType?: 'xml' | 'json';
  basDt?: string;          // 기준일자 (YYYYMMDD)
  beginBasDt?: string;     // 기준일자 시작 (YYYYMMDD)
  endBasDt?: string;       // 기준일자 종료 (YYYYMMDD)
  likeBasDt?: string;      // 기준일자 포함 검색
  likeSrtnCd?: string;     // 단축코드 포함 검색
  isinCd?: string;         // ISIN 코드
  likeIsinCd?: string;     // ISIN 코드 포함 검색
  itmsNm?: string;         // 종목명
  likeItmsNm?: string;     // 종목명 포함 검색
  crno?: string;           // 법인등록번호
  corpNm?: string;         // 법인명
  likeCorpNm?: string;     // 법인명 포함 검색
}

export interface KrxListedStockItem {
  basDt: string;           // 기준일자
  srtnCd: string;          // 단축코드 (stock code)
  isinCd: string;          // ISIN 코드
  itmsNm: string;          // 종목명
  mrktCtg: string;         // 시장구분 (KOSPI, KOSDAQ, etc.)
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

// ===== 2. Company Basic Information V2 (기업기본정보 V2) =====

// 2.1 계열회사조회 (getAffiliate_V2)
export interface CompanyAffiliateParams {
  serviceKey: string;
  numOfRows?: number;
  pageNo?: number;
  resultType?: 'xml' | 'json';
  basDt?: string;          // 기준일자 (YYYYMMDD)
  crno?: string;           // 법인등록번호
  corpNm?: string;         // 법인명
  likeCorpNm?: string;     // 법인명 포함 검색
}

export interface CompanyAffiliateItem {
  basDt: string;           // 기준일자
  crno: string;            // 법인등록번호
  corpNm: string;          // 법인명
  fnclSccd: string;        // 재무제표구분코드
  fnclSccdc: string;       // 재무제표구분코드명
  affiliateCorpNm: string; // 계열회사명
  affiliateCrno: string;   // 계열회사 법인등록번호
  ownership: string;       // 지분율
}

// 2.2 연결대상종속기업조회 (getConsSubsComp_V2)
export interface ConsSubsCompParams {
  serviceKey: string;
  numOfRows?: number;
  pageNo?: number;
  resultType?: 'xml' | 'json';
  basDt?: string;          // 기준일자 (YYYYMMDD)
  crno?: string;           // 법인등록번호
  corpNm?: string;         // 법인명
  likeCorpNm?: string;     // 법인명 포함 검색
}

export interface ConsSubsCompItem {
  basDt: string;           // 기준일자
  crno: string;            // 법인등록번호
  corpNm: string;          // 법인명
  fnclSccd: string;        // 재무제표구분코드
  fnclSccdc: string;       // 재무제표구분코드명
  subsCorpNm: string;      // 종속회사명
  subsCrno: string;        // 종속회사 법인등록번호
  ownership: string;       // 지분율
}

// 2.3 기업개요조회 (getCorpOutline_V2)
export interface CorpOutlineParams {
  serviceKey: string;
  numOfRows?: number;
  pageNo?: number;
  resultType?: 'xml' | 'json';
  basDt?: string;          // 기준일자 (YYYYMMDD)
  crno?: string;           // 법인등록번호
  corpNm?: string;         // 법인명
  likeCorpNm?: string;     // 법인명 포함 검색
}

export interface CorpOutlineItem {
  basDt: string;           // 기준일자
  crno: string;            // 법인등록번호
  corpNm: string;          // 법인명
  corpEnsnNm: string;      // 법인영문명
  enpRprFnm: string;       // 대표자명
  corpRegMrktDcd: string;  // 법인등록시장구분코드
  corpRegMrktDcdNm: string;// 법인등록시장구분코드명
  corpScaleDcd: string;    // 기업규모구분코드
  corpScaleDcdNm: string;  // 기업규모구분코드명
  enpPbanCmpyNm: string;   // 주관회사명
  enpEstbDt: string;       // 설립일자
  enpStacMm: string;       // 결산월
  enpXchgLisDt: string;    // 상장일자
  enpDelistDt: string;     // 상장폐지일자
  enpHmpgUrl: string;      // 홈페이지URL
  enpTlno: string;         // 전화번호
  enpFxno: string;         // 팩스번호
  sicNm: string;           // 표준산업분류명
  enpMainBizNm: string;    // 주요사업명
}

// ===== Utility Types =====

export type DataGoKrEndpoint =
  | 'krx-stock-info'
  | 'company-affiliate'
  | 'company-subsidiary'
  | 'company-outline';

export interface DataGoKrError {
  endpoint: DataGoKrEndpoint;
  error: string;
  timestamp: Date;
}
