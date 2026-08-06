import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    if (!query || query.length < 1) {
      return NextResponse.json({ results: [] });
    }

    console.log(`🔍 [Search API] Searching for: "${query}"`);

    // 스팩/기업인수목적 종목 제외 키워드
    const SPAC_KEYWORDS = ['스팩', '기업인수목적', '인수목적', 'SPAC'];

    // dart_corp_codes 테이블에서 검색
    // 종목코드, 한글명, 영문명으로 검색
    // ⚠️ ORDER BY 없이 .limit(limit*2)만 걸면 "삼성"/"현대"처럼 계열사가 많은
    // 그룹명 검색 시 DB가 반환하는 임의 순서에 따라 삼성전자/현대자동차 같은
    // 대표 종목이 그 컷 밖으로 밀려 아예 안 보이는 문제가 있었음 (재현 확인됨).
    // 테이블 자체가 작아(4천 행 미만) 넉넉히 가져온 뒤 관련도로 직접 정렬한다.
    const CANDIDATE_FETCH_LIMIT = 300;
    let candidateQuery = supabase
      .from('dart_corp_codes')
      .select('stock_code, corp_code, corp_name, corp_name_en')
      .or(`stock_code.ilike.%${query}%,corp_name.ilike.%${query}%,corp_name_en.ilike.%${query}%`);
    for (const keyword of SPAC_KEYWORDS) {
      candidateQuery = candidateQuery
        .not('corp_name', 'ilike', `%${keyword}%`)
        .not('corp_name_en', 'ilike', `%${keyword}%`);
    }
    const { data: rawCompanies, error } = await candidateQuery.limit(CANDIDATE_FETCH_LIMIT);

    if (error) {
      console.error('❌ [Search API] Error:', error);
      return NextResponse.json({ results: [], error: error.message });
    }

    const candidates = rawCompanies || [];
    console.log(`✅ [Search API] Found ${candidates.length} candidate companies (after SPAC filtering)`);

    // 후보 전체(최대 300개)에 대해 공시 존재 여부/최근 활동량을 먼저 조회한다.
    // ⚠️ 예전엔 relevance 정렬 없이 상위 limit개만 자른 뒤에야 공시 유무를 확인해서,
    // "삼성전자"처럼 실제로는 공시가 많은 대표 종목이 임의 순서상 그 limit 밖으로
    // 밀려나면 아예 검색 결과에서 사라지는 문제가 있었음. 여기서는 후보 전체를 먼저
    // 조회해 공시가 있는 종목만 추린 뒤 관련도로 정렬한다.
    type DisclosureRow = { id: string; stock_code: string; report_nm: string; sentiment: string; importance: string; updated_at: string; rcept_dt: string };
    const stockCodes = candidates.map(c => c.stock_code).filter(Boolean);
    let disclosures: DisclosureRow[] = [];
    if (stockCodes.length > 0) {
      // is_visible=true를 명시해야 idx_di_stock_updated_visible 커버링 인덱스를 탄다 —
      // 빠지면 plain idx_disclosure_insights_stock_code로 떨어져 훨씬 느려짐 (955ms → 465ms 실측).
      const { data } = await supabase
        .from('disclosure_insights')
        .select('id, stock_code, report_nm, sentiment, importance, updated_at, rcept_dt')
        .in('stock_code', stockCodes)
        .eq('analysis_status', 'completed')
        .eq('is_visible', true)
        .order('updated_at', { ascending: false })
        .limit(stockCodes.length * 5); // 종목당 여러 건 확보 — 최신 1건 + 활동량 집계용
      disclosures = (data as DisclosureRow[]) || [];
    }

    // stock_code → 최신 공시 + 최근 공시 건수 (활동량 — relevance tie-break에 사용)
    const latestByStock = new Map<string, DisclosureRow>();
    const countByStock = new Map<string, number>();
    for (const d of disclosures) {
      if (!d.stock_code) continue;
      if (!latestByStock.has(d.stock_code)) latestByStock.set(d.stock_code, d);
      countByStock.set(d.stock_code, (countByStock.get(d.stock_code) ?? 0) + 1);
    }

    // 공시가 있는 종목만 남긴다
    const withDisclosure = candidates.filter(c => latestByStock.has(c.stock_code));

    // 관련도 순 정렬: 정확히 일치 > 접두어 일치 > 부분 일치, 동률이면 최근 공시 활동량이
    // 많은(더 활발히 커버되는) 종목을 우선 — "삼성증권"보다 "삼성전자"가 앞에 오도록.
    const q = query.toLowerCase();
    const matchRank = (name: string | null): number => {
      const n = (name || '').toLowerCase();
      if (!n) return 3;
      if (n === q) return 0;
      if (n.startsWith(q)) return 1;
      return 2;
    };
    const results = withDisclosure
      .sort((a, b) => {
        const rankA = Math.min(matchRank(a.corp_name), matchRank(a.corp_name_en));
        const rankB = Math.min(matchRank(b.corp_name), matchRank(b.corp_name_en));
        if (rankA !== rankB) return rankA - rankB;
        const countDiff = (countByStock.get(b.stock_code) ?? 0) - (countByStock.get(a.stock_code) ?? 0);
        if (countDiff !== 0) return countDiff;
        return (a.corp_name || '').length - (b.corp_name || '').length;
      })
      .slice(0, limit)
      .map(company => ({
        stock_code: company.stock_code,
        corp_code: company.corp_code,
        corp_name: company.corp_name,
        corp_name_en: company.corp_name_en,
        latest_disclosure: latestByStock.get(company.stock_code) ?? null,
      }));

    console.log(`✅ [Search API] Returning ${results.length} companies with disclosures`);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('❌ [Search API] Unexpected error:', error);
    return NextResponse.json({ results: [], error: 'Search failed' });
  }
}
