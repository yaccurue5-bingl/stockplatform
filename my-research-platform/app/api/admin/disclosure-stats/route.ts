import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * 관리자용 공시 분석 통계 API
 * ai_summary null 값 추적 및 분석 상태 확인
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. 전체 공시 수
    const { count: totalCount } = await supabase
      .from('disclosure_insights')
      .select('*', { count: 'exact', head: true });

    // 2. ai_summary가 null인 공시 수
    const { count: nullSummaryCount, data: nullSummaryItems } = await supabase
      .from('disclosure_insights')
      .select('id, corp_name, stock_code, report_nm, analysis_status, created_at, analyzed_at')
      .is('ai_summary', null)
      .order('created_at', { ascending: false })
      .limit(20);

    // 3. analysis_status별 통계
    const { data: statusStats } = await supabase
      .from('disclosure_insights')
      .select('analysis_status')
      .not('analysis_status', 'is', null);

    // analysis_status 그룹화
    const statusCounts: Record<string, number> = {};
    (statusStats || []).forEach((item: any) => {
      const status = item.analysis_status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    // 4. sentiment가 null인 공시 수
    const { count: nullSentimentCount } = await supabase
      .from('disclosure_insights')
      .select('*', { count: 'exact', head: true })
      .is('sentiment', null);

    // 5. Sonnet 분석 완료된 공시 수
    const { count: sonnetAnalyzedCount } = await supabase
      .from('disclosure_insights')
      .select('*', { count: 'exact', head: true })
      .eq('sonnet_analyzed', true);

    // 6. 최근 24시간 분석된 공시 수
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { count: recentAnalyzedCount } = await supabase
      .from('disclosure_insights')
      .select('*', { count: 'exact', head: true })
      .gte('analyzed_at', yesterday.toISOString());

    return NextResponse.json({
      success: true,
      stats: {
        total_disclosures: totalCount || 0,
        null_summary_count: nullSummaryCount || 0,
        null_sentiment_count: nullSentimentCount || 0,
        sonnet_analyzed_count: sonnetAnalyzedCount || 0,
        recent_24h_analyzed: recentAnalyzedCount || 0,
        status_breakdown: statusCounts,
      },
      null_summary_samples: nullSummaryItems || [],
      null_reasons: [
        'API 호출 실패 (Groq API error)',
        'API 응답 파싱 실패 (extractSection 실패)',
        '빈 응답 반환',
        'analysis_status가 completed가 아닌 경우',
        '네트워크 타임아웃',
      ],
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ [Admin] Stats API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
