import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  fetchRecentDisclosures,
  filterImportantDisclosures,
  groupDisclosuresByStock,
  isPeriodicReport,
  type DartDisclosure,
} from '@/lib/api/dart';
import { analyzeDisclosure, analyzeBundledDisclosures } from '@/lib/api/groq';

// Supabase 클라이언트 (서버 전용)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cron job 인증 검증
function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET_TOKEN;

  if (!cronSecret) {
    console.error('❌ CRON_SECRET_TOKEN is not set');
    return false;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('❌ Missing or invalid authorization header');
    return false;
  }

  const token = authHeader.split(' ')[1];
  return token === cronSecret;
}

export async function GET(req: NextRequest) {
  // Cron job 인증 확인
  if (!verifyCronAuth(req)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('🤖 Disclosure analysis started (DART + Groq)...');

  try {
    // 1. DART에서 최신 공시 가져오기 (상장사만, 최근 1일)
    const allDisclosures = await fetchRecentDisclosures(1, true);

    if (allDisclosures.length === 0) {
      console.log('ℹ️ No new disclosures found');
      return NextResponse.json({
        success: true,
        analyzed: 0,
        message: 'No new disclosures',
      });
    }

    console.log(`📋 Found ${allDisclosures.length} disclosures from DART`);

    // 2. 중요 공시만 필터링 (실시간 처리 대상)
    const importantDisclosures = allDisclosures.filter(d => {
      // 분기/반기보고서 제외
      if (isPeriodicReport(d.report_nm)) {
        console.log(`⏭️ Skipping periodic report: ${d.report_nm}`);
        return false;
      }
      return true;
    });

    const filteredDisclosures = filterImportantDisclosures(importantDisclosures);

    console.log(`✨ ${filteredDisclosures.length} important disclosures to analyze`);

    if (filteredDisclosures.length === 0) {
      return NextResponse.json({
        success: true,
        analyzed: 0,
        message: 'No important disclosures to analyze',
      });
    }

    // 3. 종목별로 묶기
    const grouped = groupDisclosuresByStock(filteredDisclosures);

    console.log(`📊 Grouped into ${grouped.size} stocks`);

    let successCount = 0;
    let failCount = 0;
    let totalTokensUsed = 0;

    // 4. 종목별 분석 (묶음 처리로 토큰 절약)
    for (const [stockCode, disclosures] of grouped.entries()) {
      try {
        const corpName = disclosures[0].corp_name;

        console.log(`🔍 Analyzing ${corpName} (${stockCode}): ${disclosures.length} disclosures`);

        let analysisResult;

        if (disclosures.length === 1) {
          // 단일 공시: 개별 분석
          const d = disclosures[0];
          analysisResult = await analyzeDisclosure(
            corpName,
            stockCode,
            d.report_nm,
            `${d.report_nm}\n${d.rm || ''}`
          );
        } else {
          // 여러 공시: 묶음 분석 (토큰 절약)
          analysisResult = await analyzeBundledDisclosures(
            corpName,
            stockCode,
            disclosures.map(d => ({
              report_nm: d.report_nm,
              content: d.rm || '',
            }))
          );
        }

        totalTokensUsed += analysisResult.tokens_used;

        // 5. DB에 저장
        for (const disclosure of disclosures) {
          const { error: insertError } = await supabase
            .from('disclosure_insights')
            .upsert({
              rcept_no: disclosure.rcept_no,
              corp_code: disclosure.corp_code,
              corp_name: corpName,
              stock_code: stockCode,
              report_nm: disclosure.report_nm,
              rcept_dt: disclosure.rcept_dt,
              ai_summary: analysisResult.summary,
              sentiment: analysisResult.sentiment,
              sentiment_score: analysisResult.sentiment_score,
              importance: analysisResult.importance,
              analysis_status: 'completed',
              analyzed_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            }, {
              onConflict: 'rcept_no',
            });

          if (insertError) {
            console.error(`❌ Failed to save ${disclosure.rcept_no}:`, insertError);
            failCount++;
          } else {
            successCount++;
          }
        }

        console.log(`✅ ${corpName}: ${analysisResult.sentiment} (${analysisResult.sentiment_score}), ${analysisResult.importance}`);

        // 토큰 사용량 체크 (무료 세션 보호)
        if (totalTokensUsed > 5000) {
          console.log(`⚠️ Token limit reached (${totalTokensUsed}). Stopping for now.`);
          break;
        }

      } catch (error) {
        console.error(`❌ Error analyzing ${stockCode}:`, error);
        failCount += disclosures.length;
      }
    }

    console.log(`✅ Analysis completed: ${successCount} succeeded, ${failCount} failed, ${totalTokensUsed} tokens used`);

    return NextResponse.json({
      success: true,
      analyzed: successCount,
      failed: failCount,
      tokens_used: totalTokensUsed,
      stocks_analyzed: grouped.size,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Disclosure analysis failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST 메서드도 지원 (수동 트리거용)
export async function POST(req: NextRequest) {
  return GET(req);
}
