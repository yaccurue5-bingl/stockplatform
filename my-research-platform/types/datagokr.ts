/**
 * Types for data.go.kr (공공데이터포털) API
 *
 * Company Basic Information (기업기본정보) only.
 * KRX stock data removed (상업적 이용 불가)
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

// ===== Company Basic Information V2 (기업기본정보 V2) =====

// 계열회사조회 (getAffiliate_V2)
export interface CompanyAffiliateParams {
  serviceKey: string;
  numOfRows?: number;
  pageNo?: number;
  resultType?: 'xml' | 'json';
  basDt?: string;
  crno?: string;
  corpNm?: string;
  likeCorpNm?: string;
}

export interface CompanyAffiliateItem {
  basDt: string;
  crno: string;
  corpNm: string;
  fnclSccd: string;
  fnclSccdc: string;
  affiliateCorpNm: string;
  affiliateCrno: string;
  ownership: string;
}

// 연결대상종속기업조회 (getConsSubsComp_V2)
export interface ConsSubsCompParams {
  serviceKey: string;
  numOfRows?: number;
  pageNo?: number;
  resultType?: 'xml' | 'json';
  basDt?: string;
  crno?: string;
  corpNm?: string;
  likeCorpNm?: string;
}

export interface ConsSubsCompItem {
  basDt: string;
  crno: string;
  corpNm: string;
  fnclSccd: string;
  fnclSccdc: string;
  subsCorpNm: string;
  subsCrno: string;
  ownership: string;
}

// 기업개요조회 (getCorpOutline_V2)
export interface CorpOutlineParams {
  serviceKey: string;
  numOfRows?: number;
  pageNo?: number;
  resultType?: 'xml' | 'json';
  basDt?: string;
  crno?: string;
  corpNm?: string;
  likeCorpNm?: string;
}

export interface CorpOutlineItem {
  basDt: string;
  crno: string;
  corpNm: string;
  corpEnsnNm: string;
  enpRprFnm: string;
  corpRegMrktDcd: string;
  corpRegMrktDcdNm: string;
  corpScaleDcd: string;
  corpScaleDcdNm: string;
  enpPbanCmpyNm: string;
  enpEstbDt: string;
  enpStacMm: string;
  enpXchgLisDt: string;
  enpDelistDt: string;
  enpHmpgUrl: string;
  enpTlno: string;
  enpFxno: string;
  sicNm: string;
  enpMainBizNm: string;
}

// ===== Utility Types =====

export type DataGoKrEndpoint =
  | 'company-affiliate'
  | 'company-subsidiary'
  | 'company-outline';

export interface DataGoKrError {
  endpoint: DataGoKrEndpoint;
  error: string;
  timestamp: Date;
}
