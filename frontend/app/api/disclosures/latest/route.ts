import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { isSuperAdmin } from '@/lib/constants';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// 공시 데이터를 프론트엔드 형식으로 변환
function transformDisclosure(item: any, corpNameEnMap: Record<string, string>, sectorMap: Record<string, string>, sectorEnMap: Record<string, string>) {
  const safeString = (value: any, defaultValue: string = ''): string =>
    value != null ? String(value) : defaultValue;

  const sentimentScore = typeof item.sentiment_score === 'number' ? item.sentiment_score : 0;
  const sentiment = sentimentScore >= 0.3 ? 'POSITIVE' : sentimentScore <= -0.3 ? 'NEGATIVE' : 'NEUTRAL';
  const impactScore = typeof item.short_term_impact_score === 'number' ? item.short_term_impact_score : 3;
  const importance = impactScore >= 4 ? 'HIGH' : impactScore >= 2 ? 'MEDIUM' : 'LOW';
  const corpNameEn = corpNameEnMap[item.stock_code] || null;
  const sectorKr = sectorMap[item.stock_code] || null;
  const sectorEn = sectorKr ? (sectorEnMap[sectorKr] || 'Others') : null;

  const KR_REPORT_MAP: Record<string, string> = {
    '감사보고서': 'Audit Report',
    '사업보고서': 'Annual Business Report',
    '반기보고서': 'Semi-Annual Report',
    '분기보고서': 'Quarterly Report',
    '주요사항보고서': 'Material Fact Report',
    '주주총회소집공고': "General Shareholders' Meeting Notice",
    '임시주주총회소집공고': "Extraordinary Shareholders' Meeting Notice",
    '공개매수신고서': 'Tender Offer Statement',
    '자기주식취득결정': 'Treasury Stock Acquisition',
    '자기주식처분결정': 'Treasury Stock Disposal',
    '유상증자결정': 'Rights Offering Decision',
    '무상증자결정': 'Bonus Issue Decision',
    '전환사채권발행결정': 'Convertible Bond Issuance',
    '신주인수권부사채권발행결정': 'Bond with Warrant Issuance',
    '단기차입금변동': 'Short-term Borrowing Change',
    '영업정지': 'Business Suspension',
    '합병결정': 'Merger Decision',
    '분할결정': 'Spin-off Decision',
    '주식교환결정': 'Stock Swap Decision',
    '대규모내부거래': 'Large-scale Internal Transaction',
    '최대주주변경': 'Largest Shareholder Change',
    '임원ㆍ주요주주특정증권등소유상황보고서': 'Executive/Major Shareholder Holdings Report',
  };
  const reportNmKr = item.report_nm || '';
  const mappedEn = Object.entries(KR_REPORT_MAP).find(([kr]) => reportNmKr.includes(kr))?.[1] || null;
  const translated = item.report_nm_en || mappedEn;

  // key_numbers: DB에서 JSON string 또는 object로 올 수 있음
  const keyNumbers = (() => {
    try {
      const raw = item.key_numbers;
      if (!raw) return null;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return typeof parsed === 'object' && parsed !== null ? parsed as Record<string, string> : null;
    } catch { return null; }
  })();

  return {
    id: item.id,
    rcept_no: safeString(item.rcept_no, ''),
    corp_name: safeString(item.corp_name, 'Unknown'),
    corp_name_en: corpNameEn,
    stock_code: safeString(item.stock_code, '000000'),
    market: safeString(item.market, 'KOSPI'),
    report_name: translated ?? safeString(item.report_nm, 'Disclosure Report'),
    report_name_ko: safeString(item.report_nm, ''),
    summary: safeString(item.ai_summary),
    sentiment,
    sentiment_score: sentimentScore,
    importance,
    updated_at: safeString(item.updated_at, new Date().toISOString()),
    sector: sectorKr,
    sector_en: sectorEn,
    detailed_analysis: safeString(item.financial_impact || item.ai_summary),
    risk_factors: item.risk_factors ? [item.risk_factors] : [],
    key_numbers: keyNumbers,
  };
}

// 주어진 stock_code 목록에 대한 corp_name_en, sector, sector_en 조회
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function enrichStockCodes(supabase: any, stockCodes: string[]) {
  let corpNameEnMap: Record<string, string> = {};
  let sectorMap: Record<string, string> = {};
  let sectorEnMap: Record<string, string> = {};

  if (stockCodes.length === 0) return { corpNameEnMap, sectorMap, sectorEnMap };

  const [corpData, companiesData] = await Promise.all([
    supabase.from('dart_corp_codes').select('stock_code, corp_name_en').in('stock_code', stockCodes),
    supabase.from('companies').select('stock_code, sector').in('stock_code', stockCodes),
  ]);

  if (corpData.data) {
    corpData.data.forEach((item: any) => {
      if (item.corp_name_en) corpNameEnMap[item.stock_code] = item.corp_name_en;
    });
  }
  if (companiesData.data) {
    companiesData.data.forEach((item: any) => {
      if (item.sector) sectorMap[item.stock_code] = item.sector;
    });
  }

  const uniqueSectors = [...new Set(Object.values(sectorMap).filter(Boolean))];
  if (uniqueSectors.length > 0) {
    const { data: sectorsData } = await supabase
      .from('sectors').select('name, sector_en').in('name', uniqueSectors);
    if (sectorsData) {
      sectorsData.forEach((item: any) => {
        if (item.sector_en) sectorEnMap[item.name] = item.sector_en;
      });
    }
  }

  return { corpNameEnMap, sectorMap, sectorEnMap };
}

export async function GET(request: Request) {
  try {
    // ── 세션 검증 ──
    const cookieStore = await cookies();
    const authClient = createServerClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {},
        },
      }
    );

    // getUser() validates JWT against Supabase server — getSession() only reads cookie
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const email = user.email ?? '';
    if (!isSuperAdmin(email)) {
      const { data: userData } = await authClient
        .from('users')
        .select('plan, subscription_status')
        .eq('id', user.id)
        .single() as { data: { plan: string | null; subscription_status: string | null } | null };

      const isPaid = userData?.plan && userData.plan !== 'free' && userData?.subscription_status === 'active';
      if (!isPaid) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);
    const stockParam = searchParams.get('stock');

    // ── 특정 종목 조회 (기존 동작 유지) ──
    if (stockParam) {
      const { data: rawDisclosures, error } = await supabase
        .from('disclosure_insights')
        .select('*')
        .eq('analysis_status', 'completed')
        .eq('is_visible', true)
        .eq('stock_code', stockParam)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) return NextResponse.json([]);

      const stockCodes = [...new Set((rawDisclosures || []).map((d: any) => d.stock_code).filter(Boolean))];
      const { corpNameEnMap, sectorMap, sectorEnMap } = await enrichStockCodes(supabase, stockCodes);

      const transformed = (rawDisclosures || []).map((item: any) =>
        transformDisclosure(item, corpNameEnMap, sectorMap, sectorEnMap)
      );

      return NextResponse.json(transformed);
    }

    // ── 전체 목록 조회: 서버사이드 페이지네이션 ──
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(50, Math.max(5, parseInt(searchParams.get('pageSize') || '15', 10)));

    const SPAC_KEYWORDS = ['스팩', '기업인수목적', '인수목적', 'SPAC'];

    // Step 1: DB DISTINCT ON RPC로 고유 회사 목록 취득 (구: 5000행 풀로드 → JS 중복제거)
    const { data: allRows, error: allRowsError } = await supabase
      .rpc('get_disclosure_companies');

    if (allRowsError) return NextResponse.json({ disclosures: [], total: 0, page, pageSize, totalPages: 0 });

    // SPAC 필터 + 최신순 정렬 (RPC 결과는 stock_code 순 → updated_at 기준 재정렬)
    const orderedCompanies: string[] = (allRows || [])
      .filter((row: any) => row.stock_code && !SPAC_KEYWORDS.some(kw => (row.corp_name || '').includes(kw)))
      .sort((a: any, b: any) => new Date(b.max_updated_at).getTime() - new Date(a.max_updated_at).getTime())
      .map((row: any) => row.stock_code as string);

    const total = orderedCompanies.length;
    const totalPages = Math.ceil(total / pageSize);
    const pageStockCodes = orderedCompanies.slice((page - 1) * pageSize, page * pageSize);

    if (pageStockCodes.length === 0) {
      return NextResponse.json({ disclosures: [], total, page, pageSize, totalPages });
    }

    // Step 2 & 3: 페이지 공시 데이터 + 메타 데이터 병렬 조회
    const [discResult, enrichResult] = await Promise.all([
      supabase
        .from('disclosure_insights')
        .select('*')
        .eq('analysis_status', 'completed')
        .eq('is_visible', true)
        .in('stock_code', pageStockCodes)
        .order('updated_at', { ascending: false })
        .limit(pageSize * 20),
      enrichStockCodes(supabase, pageStockCodes),
    ]);

    if (discResult.error) return NextResponse.json({ disclosures: [], total, page, pageSize, totalPages });

    const { corpNameEnMap, sectorMap, sectorEnMap } = enrichResult;

    // Step 4: 변환
    const transformed = (discResult.data || []).map((item: any) =>
      transformDisclosure(item, corpNameEnMap, sectorMap, sectorEnMap)
    );

    console.log(`✅ [API] Page ${page}/${totalPages} — ${pageStockCodes.length} companies, ${transformed.length} disclosures`);

    return NextResponse.json(
      { disclosures: transformed, total, page, pageSize, totalPages },
      // 1분 CDN 캐시 — 공시 목록은 실시간성 낮음
      { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' } },
    );

  } catch (error) {
    console.error('❌ [API] Unexpected error:', error);
    return NextResponse.json({ disclosures: [], total: 0, page: 1, pageSize: 15, totalPages: 0 });
  }
}
