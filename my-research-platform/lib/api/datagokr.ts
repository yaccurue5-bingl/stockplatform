/**
 * Data.go.kr API Client (공공데이터포털)
 *
 * Provides access to:
 * - Company Basic Information V2 (기업기본정보 V2)
 *
 * API Documentation:
 * - Company: https://www.data.go.kr/data/15043184/openapi.do
 *
 * Note: KRX stock data removed (상업적 이용 불가)
 * Stock/company info is sourced from DART API instead.
 */

import {
  type CompanyAffiliateParams,
  type CompanyAffiliateItem,
  type ConsSubsCompParams,
  type ConsSubsCompItem,
  type CorpOutlineParams,
  type CorpOutlineItem,
  type DataGoKrResponse,
} from '@/types/datagokr';

// ===== API Configuration =====

const COMPANY_BASE_URL =
  'https://apis.data.go.kr/1160100/service/GetCorpBasicInfoService_V2';

const DEFAULT_NUM_ROWS = 100;
const DEFAULT_PAGE_NO = 1;
const DEFAULT_RESULT_TYPE = 'json';

// ===== Helper Functions =====

function buildUrl(
  baseUrl: string,
  params: Record<string, string | number | undefined>
): string {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });
  return url.toString();
}

export function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

export function getYesterdayYYYYMMDD(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return formatDateYYYYMMDD(yesterday);
}

function parseResponse<T>(data: DataGoKrResponse<T>): T[] {
  try {
    const items = data.response?.body?.items?.item;
    if (!items) return [];
    return Array.isArray(items) ? items : [items];
  } catch (error) {
    console.error('Error parsing response:', error);
    return [];
  }
}

function isSuccessResponse(data: DataGoKrResponse<any>): boolean {
  const resultCode = data.response?.header?.resultCode;
  return resultCode === '00' || resultCode === '0';
}

// ===== Company Basic Information =====

export async function fetchCompanyAffiliates(
  params: CompanyAffiliateParams
): Promise<CompanyAffiliateItem[]> {
  const endpoint = `${COMPANY_BASE_URL}/getAffiliate_V2`;
  const queryParams = {
    serviceKey: params.serviceKey,
    numOfRows: params.numOfRows || DEFAULT_NUM_ROWS,
    pageNo: params.pageNo || DEFAULT_PAGE_NO,
    resultType: params.resultType || DEFAULT_RESULT_TYPE,
    basDt: params.basDt,
    crno: params.crno,
    corpNm: params.corpNm,
    likeCorpNm: params.likeCorpNm,
  };

  try {
    const url = buildUrl(endpoint, queryParams);
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const data: DataGoKrResponse<CompanyAffiliateItem> = await response.json();
    if (!isSuccessResponse(data)) return [];
    return parseResponse(data);
  } catch (error) {
    console.error('Failed to fetch affiliates:', error);
    throw error;
  }
}

export async function fetchConsSubsCompanies(
  params: ConsSubsCompParams
): Promise<ConsSubsCompItem[]> {
  const endpoint = `${COMPANY_BASE_URL}/getConsSubsComp_V2`;
  const queryParams = {
    serviceKey: params.serviceKey,
    numOfRows: params.numOfRows || DEFAULT_NUM_ROWS,
    pageNo: params.pageNo || DEFAULT_PAGE_NO,
    resultType: params.resultType || DEFAULT_RESULT_TYPE,
    basDt: params.basDt,
    crno: params.crno,
    corpNm: params.corpNm,
    likeCorpNm: params.likeCorpNm,
  };

  try {
    const url = buildUrl(endpoint, queryParams);
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const data: DataGoKrResponse<ConsSubsCompItem> = await response.json();
    if (!isSuccessResponse(data)) return [];
    return parseResponse(data);
  } catch (error) {
    console.error('Failed to fetch subsidiaries:', error);
    throw error;
  }
}

export async function fetchCorpOutline(
  params: CorpOutlineParams
): Promise<CorpOutlineItem[]> {
  const endpoint = `${COMPANY_BASE_URL}/getCorpOutline_V2`;
  const queryParams = {
    serviceKey: params.serviceKey,
    numOfRows: params.numOfRows || DEFAULT_NUM_ROWS,
    pageNo: params.pageNo || DEFAULT_PAGE_NO,
    resultType: params.resultType || DEFAULT_RESULT_TYPE,
    basDt: params.basDt,
    crno: params.crno,
    corpNm: params.corpNm,
    likeCorpNm: params.likeCorpNm,
  };

  try {
    const url = buildUrl(endpoint, queryParams);
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const data: DataGoKrResponse<CorpOutlineItem> = await response.json();
    if (!isSuccessResponse(data)) return [];
    return parseResponse(data);
  } catch (error) {
    console.error('Failed to fetch company outline:', error);
    throw error;
  }
}

export async function fetchCompleteCompanyInfo(
  serviceKey: string,
  corpNm: string,
  basDt?: string
) {
  const date = basDt || getYesterdayYYYYMMDD();
  const [outline, affiliates, subsidiaries] = await Promise.all([
    fetchCorpOutline({ serviceKey, likeCorpNm: corpNm, basDt: date }),
    fetchCompanyAffiliates({ serviceKey, likeCorpNm: corpNm, basDt: date }),
    fetchConsSubsCompanies({ serviceKey, likeCorpNm: corpNm, basDt: date }),
  ]);
  return { outline, affiliates, subsidiaries };
}
