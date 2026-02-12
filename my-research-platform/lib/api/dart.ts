/**
 * DART (전자공시시스템) API 유틸리티
 *
 * 금융감독원 전자공시시스템 OpenAPI
 * https://opendart.fss.or.kr/
 */

const DART_API_URL = 'https://opendart.fss.or.kr/api';

// 중요 공시 키워드 (실시간 처리 대상)
const IMPORTANT_KEYWORDS = [
  '대규모',
  '단일판매',
  '영업',
  '잠정',
  '정정',
  '특수관계인',
  '자회사',
  '공정공시',
  '매출',
  '계약',
  '투자',
  '결정',
];

export interface DartDisclosure {
  corp_code: string;        // 기업 고유번호
  corp_name: string;        // 회사명
  stock_code?: string;      // 종목코드 (상장사만)
  report_nm: string;        // 공시명
  rcept_no: string;         // 접수번호 (고유 ID)
  rcept_dt: string;         // 접수일자 (YYYYMMDD)
  rm?: string;              // 비고
  // DB 연동 및 AI 분석 결과 컬럼
  corp_name_en?: string;    // 👈 추가: dart_corp_codes 테이블 JOIN 결과
  sector?: string;          // 👈 추가: AI 분석 결과 (가이드주신 변수명 반영)
  
}

export interface DartDisclosureDetail {
  rcept_no: string;
  corp_name: string;
  report_nm: string;
  rcept_dt: string;
  stock_code?: string;
  content: string;          // 공시 원문
}

/**
 * 최신 공시 목록 조회
 * @param days 최근 N일간 공시 (기본: 1일)
 * @param onlyListed true면 상장사만 (stock_code 있는 것만)
 */
export async function fetchRecentDisclosures(
  days: number = 1,
  onlyListed: boolean = true
): Promise<DartDisclosure[]> {
  const apiKey = process.env.DART_API_KEY;

  if (!apiKey) {
    throw new Error('DART_API_KEY is not configured');
  }

  // 오늘 날짜 계산
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const startDateStr = formatDate(startDate);
  const endDateStr = formatDate(endDate);

  const url = `${DART_API_URL}/list.json`;
  const params = new URLSearchParams({
    crtfc_key: apiKey,
    bgn_de: startDateStr,
    end_de: endDateStr,
    page_count: '100',  // 최대 100개
  });

  try {
    const response = await fetch(`${url}?${params}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`DART API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== '000') {
      console.error('DART API error:', data.message);
      return [];
    }

    let disclosures: DartDisclosure[] = data.list || [];

    // 상장사만 필터링 (stock_code가 있는 것만)
    if (onlyListed) {
      disclosures = disclosures.filter(d => d.stock_code && d.stock_code.trim() !== '');
    }

    console.log(`📋 DART: Fetched ${disclosures.length} disclosures (listed companies only)`);

    return disclosures;
  } catch (error) {
    console.error('❌ Failed to fetch DART disclosures:', error);
    throw error;
  }
}

/**
 * 중요 공시만 필터링
 * "대규모", "단일판매", "영업", "잠정" 등 키워드 포함
 */
export function filterImportantDisclosures(disclosures: DartDisclosure[]): DartDisclosure[] {
  return disclosures.filter(d => {
    const reportName = d.report_nm.toLowerCase();
    return IMPORTANT_KEYWORDS.some(keyword =>
      reportName.includes(keyword.toLowerCase())
    );
  });
}

/**
 * 공시 상세 내용 조회
 * @param rcept_no 접수번호
 */
export async function fetchDisclosureDetail(rcept_no: string): Promise<DartDisclosureDetail | null> {
  const apiKey = process.env.DART_API_KEY;

  if (!apiKey) {
    throw new Error('DART_API_KEY is not configured');
  }

  const url = `${DART_API_URL}/document.xml`;
  const params = new URLSearchParams({
    crtfc_key: apiKey,
    rcept_no: rcept_no,
  });

  try {
    const response = await fetch(`${url}?${params}`);

    if (!response.ok) {
      throw new Error(`DART API error: ${response.status}`);
    }

    const xmlContent = await response.text();

    // XML에서 텍스트 추출 (간단한 방식)
    const textContent = extractTextFromXml(xmlContent);

    return {
      rcept_no,
      corp_name: '',  // 상세 조회에는 없으므로 나중에 채워야 함
      report_nm: '',
      rcept_dt: '',
      content: textContent,
    };
  } catch (error) {
    console.error(`❌ Failed to fetch disclosure detail (${rcept_no}):`, error);
    return null;
  }
}

/**
 * 종목별 최신 공시 묶음 조회
 * 같은 종목의 오늘 공시들을 그룹화
 */
export function groupDisclosuresByStock(disclosures: DartDisclosure[]): Map<string, DartDisclosure[]> {
  const grouped = new Map<string, DartDisclosure[]>();

  for (const disclosure of disclosures) {
    if (!disclosure.stock_code) continue;

    const existing = grouped.get(disclosure.stock_code) || [];
    existing.push(disclosure);
    grouped.set(disclosure.stock_code, existing);
  }

  return grouped;
}

/**
 * 공시 요약 생성 (종목별 묶음)
 * 예: "[삼성전자] Today's Disclosure Summary"
 */
export function createDisclosureSummary(stockCode: string, disclosures: DartDisclosure[]): string {
  if (disclosures.length === 0) return '';

  const displayName = disclosures[0].corp_name_en || disclosures[0].corp_name;
  const summaryLines = disclosures.map((d, i) =>
    `${i + 1}. ${d.report_nm} (${formatDateKorean(d.rcept_dt)})`
  );

  return `[${displayName}] Today's Disclosure Summary\n\n${summaryLines.join('\n')}`;
}

// ========== 유틸리티 함수 ==========

/**
 * Date를 YYYYMMDD 형식으로 변환
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * YYYYMMDD를 YYYY-MM-DD 형식으로 변환
 */
function formatDateKorean(dateStr: string): string {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

/**
 * XML에서 텍스트 추출 (간단한 방식)
 * 실제로는 더 정교한 파싱 필요
 */
function extractTextFromXml(xml: string): string {
  // HTML/XML 태그 제거
  let text = xml.replace(/<[^>]*>/g, ' ');

  // 연속된 공백 제거
  text = text.replace(/\s+/g, ' ').trim();

  // 1000자로 제한 (Groq 입력용)
  return text.slice(0, 1000);
}

/**
 * 공시가 중요한지 판단
 */
export function isImportantDisclosure(reportName: string): boolean {
  const lowerName = reportName.toLowerCase();
  return IMPORTANT_KEYWORDS.some(keyword =>
    lowerName.includes(keyword.toLowerCase())
  );
}

/**
 * 분기/반기보고서인지 확인 (실시간 처리 제외 대상)
 */
export function isPeriodicReport(reportName: string): boolean {
  const periodicKeywords = ['분기보고서', '반기보고서', '사업보고서', '정기보고'];
  return periodicKeywords.some(keyword => reportName.includes(keyword));
}
