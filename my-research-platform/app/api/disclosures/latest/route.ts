import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: Request) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // URL에서 limit 파라미터 추출 (기본값: 10, 최대: 100)
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = Math.min(parseInt(limitParam || '10', 10), 100);

    console.log('🔍 [API] Fetching latest disclosures...');

    // 스팩/기업인수목적 종목 제외 키워드
    const SPAC_KEYWORDS = ['스팩', '기업인수목적', '인수목적', 'SPAC'];

    // 최신 공시 데이터 가져오기
    // analysis_status가 'completed'인 것만 가져오기
    // 스팩 종목 제외를 위해 여유있게 더 많이 가져옴
    const { data: rawDisclosures, error } = await supabase
      .from('disclosure_insights')
      .select('*')
      .eq('analysis_status', 'completed')
      .order('analyzed_at', { ascending: false })
      .limit(limit * 2);  // 스팩 필터링 후 충분한 개수 확보

    // 스팩/기업인수목적 종목 필터링
    const disclosures = (rawDisclosures || []).filter((item: any) => {
      const corpName = item.corp_name || '';
      // 스팩 키워드가 포함된 종목 제외
      return !SPAC_KEYWORDS.some(keyword =>
        corpName.includes(keyword)
      );
    }).slice(0, limit);  // 요청된 limit 만큼만 반환

    // 영문 기업명 및 섹터 조회를 위한 stock_code 목록 추출
    const stockCodes = [...new Set((disclosures || []).map((d: any) => d.stock_code).filter(Boolean))];

    // dart_corp_codes에서 영문명 조회
    let corpNameEnMap: Record<string, string> = {};
    // companies에서 섹터 조회
    let sectorMap: Record<string, string> = {};
    // sectors에서 섹터 영문명 조회
    let sectorEnMap: Record<string, string> = {};

    if (stockCodes.length > 0) {
      // 영문 기업명 조회
      const { data: corpData } = await supabase
        .from('dart_corp_codes')
        .select('stock_code, corp_name_en')
        .in('stock_code', stockCodes);

      if (corpData) {
        corpData.forEach((item: any) => {
          if (item.corp_name_en) {
            corpNameEnMap[item.stock_code] = item.corp_name_en;
          }
        });
      }

      // companies 테이블에서 섹터 조회
      const { data: companiesData } = await supabase
        .from('companies')
        .select('stock_code, sector')
        .in('stock_code', stockCodes);

      if (companiesData) {
        companiesData.forEach((item: any) => {
          if (item.sector) {
            sectorMap[item.stock_code] = item.sector;
          }
        });
      }

      // 고유 섹터명 추출 후 영문명 조회
      const uniqueSectors = [...new Set(Object.values(sectorMap).filter(Boolean))];
      if (uniqueSectors.length > 0) {
        const { data: sectorsData } = await supabase
          .from('sectors')
          .select('name, sector_en')
          .in('name', uniqueSectors);

        if (sectorsData) {
          sectorsData.forEach((item: any) => {
            if (item.sector_en) {
              sectorEnMap[item.name] = item.sector_en;
            }
          });
        }
      }
    }

    if (error) {
      console.error('❌ [API] Error fetching disclosures:', error);
      return NextResponse.json([]);
    }

    console.log(`✅ [API] Found ${disclosures?.length || 0} completed disclosures`);

    // 데이터 구조 로깅 (첫 번째 항목만)
    if (disclosures && disclosures.length > 0) {
      const firstItem = disclosures[0];
      const safeReportNm = firstItem.report_nm || '';
      console.log('📊 [API] First disclosure raw data:', {
        id: firstItem.id,
        corp_name: firstItem.corp_name || 'N/A',
        stock_code: firstItem.stock_code || 'N/A',
        report_nm: safeReportNm.substring(0, Math.min(50, safeReportNm.length)),
        analysis_status: firstItem.analysis_status,
        sentiment: firstItem.sentiment || 'N/A',
        importance: firstItem.importance || 'N/A',
        has_ai_summary: !!firstItem.ai_summary,
        has_sonnet_summary: !!firstItem.sonnet_summary,
        sonnet_analyzed: firstItem.sonnet_analyzed,
        is_sample: firstItem.is_sample_disclosure,
        analyzed_at: firstItem.analyzed_at || 'N/A',
      });
    } else {
      console.warn('⚠️ [API] No disclosures found with analysis_status=completed');
    }

    // ✅ 프론트엔드가 기대하는 형식으로 데이터 변환
    // Groq와 Sonnet 분석 결과를 하나의 객체로 합치기
    // ⚠️ 모든 필드에 null 안전 처리 적용
    const transformedDisclosures = (disclosures || []).map((item: any) => {
      // Null-safe 문자열 추출 헬퍼
      const safeString = (value: any, defaultValue: string = ''): string => {
        return value != null ? String(value) : defaultValue;
      };

      // Sonnet 분석이 있으면 Sonnet summary 사용, 없으면 Groq summary 사용
      const summary = safeString(item.sonnet_summary || item.ai_summary);

      // 영문 기업명 조회
      const corpNameEn = corpNameEnMap[item.stock_code] || null;

      // 섹터 정보 조회
      const sectorKr = sectorMap[item.stock_code] || null;
      const sectorEn = sectorKr ? (sectorEnMap[sectorKr] || 'Others') : null;

      const transformed = {
        id: item.id,
        corp_name: safeString(item.corp_name, 'Unknown'),
        corp_name_en: corpNameEn,
        stock_code: safeString(item.stock_code, '000000'),
        market: safeString(item.market, 'KOSPI'),
        report_name: safeString(item.report_nm, 'Disclosure Report'),
        summary: summary,
        sentiment: safeString(item.sentiment, 'NEUTRAL'),
        sentiment_score: typeof item.sentiment_score === 'number' ? item.sentiment_score : 0,
        importance: safeString(item.importance, 'MEDIUM'),
        analyzed_at: safeString(item.analyzed_at, new Date().toISOString()),

        // 섹터 정보
        sector: sectorKr,
        sector_en: sectorEn,

        // 추가 정보 (상세 페이지용)
        sonnet_analyzed: Boolean(item.sonnet_analyzed),
        is_sample: Boolean(item.is_sample_disclosure),
        detailed_analysis: safeString(item.sonnet_detailed_analysis || item.ai_summary),
        investment_implications: safeString(item.sonnet_investment_implications),
        risk_factors: item.sonnet_risk_factors || [],
        key_metrics: item.sonnet_key_metrics || [],
      };

      return transformed;
    });

    console.log('📦 [API] Transformed data structure:', {
      total_count: transformedDisclosures.length,
      first_item_preview: transformedDisclosures[0] ? {
        id: transformedDisclosures[0].id,
        corp_name: transformedDisclosures[0].corp_name,
        has_summary: !!transformedDisclosures[0].summary,
        summary_length: (transformedDisclosures[0].summary || '').length,
        summary_preview: (transformedDisclosures[0].summary || '').substring(0, 100),
        sentiment: transformedDisclosures[0].sentiment,
        importance: transformedDisclosures[0].importance,
      } : null,
    });

    return NextResponse.json(transformedDisclosures);
  } catch (error) {
    console.error('❌ [API] Unexpected error:', error);
    return NextResponse.json([]);
  }
}
