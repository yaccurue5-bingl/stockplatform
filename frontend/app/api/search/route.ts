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
    // 스팩 필터링을 위해 더 많이 가져옴
    const { data: rawCompanies, error } = await supabase
      .from('dart_corp_codes')
      .select('stock_code, corp_code, corp_name, corp_name_en')
      .or(`stock_code.ilike.%${query}%,corp_name.ilike.%${query}%,corp_name_en.ilike.%${query}%`)
      .limit(limit * 2);

    if (error) {
      console.error('❌ [Search API] Error:', error);
      return NextResponse.json({ results: [], error: error.message });
    }

    // 스팩/기업인수목적 종목 필터링
    const companies = (rawCompanies || []).filter((company) => {
      const corpName = company.corp_name || '';
      // 스팩 키워드가 포함된 종목 제외
      return !SPAC_KEYWORDS.some(keyword =>
        corpName.includes(keyword)
      );
    }).slice(0, limit);

    console.log(`✅ [Search API] Found ${companies?.length || 0} companies (after SPAC filtering)`);

    // 단일 IN 쿼리로 최신 공시 일괄 조회 (N+1 → 1 쿼리)
    type DisclosureRow = { id: string; stock_code: string; report_nm: string; sentiment: string; importance: string; updated_at: string; rcept_dt: string };
    const stockCodes = companies.map(c => c.stock_code).filter(Boolean);
    let disclosures: DisclosureRow[] = [];
    if (stockCodes.length > 0) {
      const { data } = await supabase
        .from('disclosure_insights')
        .select('id, stock_code, report_nm, sentiment, importance, updated_at, rcept_dt')
        .in('stock_code', stockCodes)
        .eq('analysis_status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(stockCodes.length * 3); // 종목당 최대 3건 조회 후 최신 1건 선택
      disclosures = (data as DisclosureRow[]) || [];
    }

    // stock_code → 최신 공시 맵 (updated_at 내림차순 정렬 유지, 첫 번째가 최신)
    const latestByStock = new Map<string, DisclosureRow>();
    for (const d of (disclosures || [])) {
      if (d.stock_code && !latestByStock.has(d.stock_code)) {
        latestByStock.set(d.stock_code, d);
      }
    }

    // disclosure_insights에 데이터가 있는 종목만 반환
    const results = companies
      .map(company => ({
        stock_code: company.stock_code,
        corp_code: company.corp_code,
        corp_name: company.corp_name,
        corp_name_en: company.corp_name_en,
        latest_disclosure: latestByStock.get(company.stock_code) ?? null,
      }))
      .filter(item => item.latest_disclosure !== null);

    console.log(`✅ [Search API] Returning ${results.length} companies with disclosures`);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('❌ [Search API] Unexpected error:', error);
    return NextResponse.json({ results: [], error: 'Search failed' });
  }
}
