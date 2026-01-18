import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 [API] Fetching latest disclosures...');

    // 최신 공시 데이터 가져오기 (최대 10개)
    // analysis_status가 'completed'인 것만 가져오기
    const { data: disclosures, error } = await supabase
      .from('disclosure_insights')
      .select('*')
      .eq('analysis_status', 'completed')
      .order('analyzed_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('❌ [API] Error fetching disclosures:', error);
      return NextResponse.json([]);
    }

    console.log(`✅ [API] Found ${disclosures?.length || 0} completed disclosures`);

    // 데이터 구조 로깅 (첫 번째 항목만)
    if (disclosures && disclosures.length > 0) {
      const firstItem = disclosures[0];
      console.log('📊 [API] First disclosure raw data:', {
        id: firstItem.id,
        corp_name: firstItem.corp_name,
        stock_code: firstItem.stock_code,
        report_nm: firstItem.report_nm?.substring(0, 50),
        analysis_status: firstItem.analysis_status,
        sentiment: firstItem.sentiment,
        importance: firstItem.importance,
        has_ai_summary: !!firstItem.ai_summary,
        has_sonnet_summary: !!firstItem.sonnet_summary,
        sonnet_analyzed: firstItem.sonnet_analyzed,
        is_sample: firstItem.is_sample_disclosure,
        analyzed_at: firstItem.analyzed_at,
      });
    } else {
      console.warn('⚠️ [API] No disclosures found with analysis_status=completed');
    }

    // ✅ 프론트엔드가 기대하는 형식으로 데이터 변환
    // Groq와 Sonnet 분석 결과를 하나의 객체로 합치기
    const transformedDisclosures = (disclosures || []).map((item: any) => {
      // Sonnet 분석이 있으면 Sonnet summary 사용, 없으면 Groq summary 사용
      const summary = item.sonnet_summary || item.ai_summary || '';

      const transformed = {
        id: item.id,
        corp_name: item.corp_name,
        stock_code: item.stock_code,
        market: item.market || 'KOSPI', // 기본값
        report_name: item.report_nm, // DB 컬럼명 매핑
        summary: summary, // ✅ Groq + Sonnet 합치기
        sentiment: item.sentiment,
        sentiment_score: item.sentiment_score || 0,
        importance: item.importance,
        analyzed_at: item.analyzed_at,

        // 추가 정보 (상세 페이지용)
        sonnet_analyzed: item.sonnet_analyzed || false,
        is_sample: item.is_sample_disclosure || false,
        detailed_analysis: item.sonnet_detailed_analysis || item.ai_summary,
        investment_implications: item.sonnet_investment_implications,
        risk_factors: item.sonnet_risk_factors,
        key_metrics: item.sonnet_key_metrics,
      };

      return transformed;
    });

    console.log('📦 [API] Transformed data structure:', {
      total_count: transformedDisclosures.length,
      first_item_preview: transformedDisclosures[0] ? {
        id: transformedDisclosures[0].id,
        corp_name: transformedDisclosures[0].corp_name,
        has_summary: !!transformedDisclosures[0].summary,
        summary_length: transformedDisclosures[0].summary?.length || 0,
        summary_preview: transformedDisclosures[0].summary?.substring(0, 100),
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
