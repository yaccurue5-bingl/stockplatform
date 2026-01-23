/**
 * Data.go.kr API Client (공공데이터포털)
 *
 * Provides access to:
 * 1. KRX Listed Stock Information (KRX 상장종목정보)
 * 2. Company Basic Information V2 (기업기본정보 V2)
 *
 * API Documentation:
 * - KRX: https://www.data.go.kr/data/15094775/openapi.do
 * - Company: https://www.data.go.kr/data/15043184/openapi.do
 */

import {
  type KrxListedStockParams,
  type KrxListedStockItem,
  type CompanyAffiliateParams,
  type CompanyAffiliateItem,
  type ConsSubsCompParams,
  type ConsSubsCompItem,
  type CorpOutlineParams,
  type CorpOutlineItem,
  type DataGoKrResponse,
  type DataGoKrError,
} from '@/types/datagokr';

// ===== API Configuration =====

const KRX_BASE_URL =
  'https://apis.data.go.kr/1160100/service/GetKrxListedInfoService';
const COMPANY_BASE_URL =
  'https://apis.data.go.kr/1160100/service/GetCorpBasicInfoService_V2';

const DEFAULT_NUM_ROWS = 100;
const DEFAULT_PAGE_NO = 1;
const DEFAULT_RESULT_TYPE = 'json';

// ===== Helper Functions =====

/**
 * Build URL with query parameters
 */
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

/**
 * Format date to YYYYMMDD
 */
export function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Get yesterday's date in YYYYMMDD format
 */
export function getYesterdayYYYYMMDD(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return formatDateYYYYMMDD(yesterday);
}

/**
 * Parse data.go.kr response and extract items
 */
function parseResponse<T>(data: DataGoKrResponse<T>): T[] {
  try {
    const items = data.response?.body?.items?.item;

    if (!items) {
      console.log('No items in response');
      return [];
    }

    // Handle both single item and array of items
    return Array.isArray(items) ? items : [items];
  } catch (error) {
    console.error('Error parsing response:', error);
    return [];
  }
}

/**
 * Check if response is successful
 */
function isSuccessResponse(data: DataGoKrResponse<any>): boolean {
  const resultCode = data.response?.header?.resultCode;
  return resultCode === '00' || resultCode === '0';
}

// ===== 1. KRX Listed Stock Information =====

/**
 * Fetch KRX listed stock information
 *
 * @param params - Query parameters (see KrxListedStockParams)
 * @returns Array of stock information
 *
 * @example
 * ```ts
 * // Get all stocks for a specific date
 * const stocks = await fetchKrxListedStocks({
 *   serviceKey: process.env.DATA_GO_KR_API_KEY!,
 *   basDt: '20240115',
 *   numOfRows: 1000
 * });
 *
 * // Search for specific stock
 * const samsung = await fetchKrxListedStocks({
 *   serviceKey: process.env.DATA_GO_KR_API_KEY!,
 *   likeItmsNm: '삼성전자'
 * });
 * ```
 */
export async function fetchKrxListedStocks(
  params: KrxListedStockParams
): Promise<KrxListedStockItem[]> {
  const endpoint = `${KRX_BASE_URL}/getItemInfo`;

  const queryParams = {
    serviceKey: params.serviceKey,
    numOfRows: params.numOfRows || DEFAULT_NUM_ROWS,
    pageNo: params.pageNo || DEFAULT_PAGE_NO,
    resultType: params.resultType || DEFAULT_RESULT_TYPE,
    basDt: params.basDt,
    beginBasDt: params.beginBasDt,
    endBasDt: params.endBasDt,
    likeBasDt: params.likeBasDt,
    likeSrtnCd: params.likeSrtnCd,
    isinCd: params.isinCd,
    likeIsinCd: params.likeIsinCd,
    itmsNm: params.itmsNm,
    likeItmsNm: params.likeItmsNm,
    crno: params.crno,
    corpNm: params.corpNm,
    likeCorpNm: params.likeCorpNm,
  };

  try {
    const url = buildUrl(endpoint, queryParams);
    console.log(`📡 Fetching KRX stocks from data.go.kr...`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: DataGoKrResponse<KrxListedStockItem> = await response.json();

    if (!isSuccessResponse(data)) {
      const errorMsg = data.response?.header?.resultMsg || 'Unknown error';
      console.error(`❌ API Error: ${errorMsg}`);
      return [];
    }

    const items = parseResponse(data);
    console.log(`✅ Fetched ${items.length} KRX stock items`);

    return items;
  } catch (error) {
    console.error('❌ Failed to fetch KRX stocks:', error);
    throw error;
  }
}

/**
 * Fetch all KRX stocks for a specific date
 * Automatically handles pagination
 */
export async function fetchAllKrxStocks(
  serviceKey: string,
  basDt: string
): Promise<KrxListedStockItem[]> {
  const allStocks: KrxListedStockItem[] = [];
  let pageNo = 1;
  let hasMore = true;
  const numOfRows = 1000; // Max per page

  while (hasMore) {
    const stocks = await fetchKrxListedStocks({
      serviceKey,
      basDt,
      numOfRows,
      pageNo,
      resultType: 'json',
    });

    if (stocks.length === 0) {
      hasMore = false;
    } else {
      allStocks.push(...stocks);
      pageNo++;

      // If we got less than numOfRows, we've reached the end
      if (stocks.length < numOfRows) {
        hasMore = false;
      }
    }
  }

  console.log(`✅ Total KRX stocks fetched: ${allStocks.length}`);
  return allStocks;
}

// ===== 2. Company Basic Information =====

/**
 * Fetch company affiliate information (계열회사)
 *
 * @example
 * ```ts
 * const affiliates = await fetchCompanyAffiliates({
 *   serviceKey: process.env.DATA_GO_KR_API_KEY!,
 *   likeCorpNm: '삼성',
 *   basDt: '20240115'
 * });
 * ```
 */
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
    console.log(`📡 Fetching company affiliates from data.go.kr...`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: DataGoKrResponse<CompanyAffiliateItem> = await response.json();

    if (!isSuccessResponse(data)) {
      const errorMsg = data.response?.header?.resultMsg || 'Unknown error';
      console.error(`❌ API Error: ${errorMsg}`);
      return [];
    }

    const items = parseResponse(data);
    console.log(`✅ Fetched ${items.length} affiliate items`);

    return items;
  } catch (error) {
    console.error('❌ Failed to fetch affiliates:', error);
    throw error;
  }
}

/**
 * Fetch consolidated subsidiary company information (연결대상종속기업)
 *
 * @example
 * ```ts
 * const subsidiaries = await fetchConsSubsCompanies({
 *   serviceKey: process.env.DATA_GO_KR_API_KEY!,
 *   crno: '1101110012345',
 *   basDt: '20240115'
 * });
 * ```
 */
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
    console.log(`📡 Fetching subsidiary companies from data.go.kr...`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: DataGoKrResponse<ConsSubsCompItem> = await response.json();

    if (!isSuccessResponse(data)) {
      const errorMsg = data.response?.header?.resultMsg || 'Unknown error';
      console.error(`❌ API Error: ${errorMsg}`);
      return [];
    }

    const items = parseResponse(data);
    console.log(`✅ Fetched ${items.length} subsidiary items`);

    return items;
  } catch (error) {
    console.error('❌ Failed to fetch subsidiaries:', error);
    throw error;
  }
}

/**
 * Fetch company outline information (기업개요)
 *
 * @example
 * ```ts
 * const outline = await fetchCorpOutline({
 *   serviceKey: process.env.DATA_GO_KR_API_KEY!,
 *   likeCorpNm: '삼성전자',
 *   basDt: '20240115'
 * });
 * ```
 */
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
    console.log(`📡 Fetching company outline from data.go.kr...`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: DataGoKrResponse<CorpOutlineItem> = await response.json();

    if (!isSuccessResponse(data)) {
      const errorMsg = data.response?.header?.resultMsg || 'Unknown error';
      console.error(`❌ API Error: ${errorMsg}`);
      return [];
    }

    const items = parseResponse(data);
    console.log(`✅ Fetched ${items.length} outline items`);

    return items;
  } catch (error) {
    console.error('❌ Failed to fetch company outline:', error);
    throw error;
  }
}

// ===== Convenience Functions =====

/**
 * Fetch complete company information (all endpoints)
 */
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

  return {
    outline,
    affiliates,
    subsidiaries,
  };
}

/**
 * Search stock by name and get combined info
 */
export async function searchStockWithCompanyInfo(
  serviceKey: string,
  searchTerm: string,
  basDt?: string
) {
  const date = basDt || getYesterdayYYYYMMDD();

  // Fetch stock info
  const stocks = await fetchKrxListedStocks({
    serviceKey,
    likeItmsNm: searchTerm,
    basDt: date,
  });

  if (stocks.length === 0) {
    return null;
  }

  // Get first matching stock
  const stock = stocks[0];

  // Fetch company info using corp name
  const companyInfo = await fetchCompleteCompanyInfo(
    serviceKey,
    stock.itmsNm,
    date
  );

  return {
    stock,
    ...companyInfo,
  };
}
