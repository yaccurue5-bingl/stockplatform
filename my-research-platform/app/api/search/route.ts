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

    // 검색 결과에 최신 공시 정보 추가 (공시가 있는 종목만 반환)
    const resultsWithDisclosures = await Promise.all(
      (companies || []).map(async (company) => {
        // 해당 종목의 최신 공시 1개 조회
        const { data: latestDisclosure } = await supabase
          .from('disclosure_insights')
          .select('id, report_nm, sentiment, importance, analyzed_at')
          .eq('stock_code', company.stock_code)
          .eq('analysis_status', 'completed')
          .order('analyzed_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          stock_code: company.stock_code,
          corp_code: company.corp_code,
          corp_name: company.corp_name,
          corp_name_en: company.corp_name_en,
          latest_disclosure: latestDisclosure || null,
        };
      })
    );

    // disclosure_insights에 데이터가 있는 종목만 필터링
    const results = resultsWithDisclosures.filter(item => item.latest_disclosure !== null);

    console.log(`✅ [Search API] Returning ${results.length} companies with disclosures`);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('❌ [Search API] Unexpected error:', error);
    return NextResponse.json({ results: [], error: 'Search failed' });
  }
}
