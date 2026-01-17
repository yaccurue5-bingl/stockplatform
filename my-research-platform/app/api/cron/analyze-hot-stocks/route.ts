/**
 * Hot Stocks 5-Minute Polling Cron Job
 *
 * Analyzes stocks promoted to hot status (급등락 종목)
 * - Runs every 5 minutes (instead of 15)
 * - Only processes active hot stocks
 * - Verifies triggers are still valid
 *
 * ⚠️ DISABLED until beta service (USE_HOT_STOCKS = false)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  fetchRecentDisclosures,
  filterImportantDisclosures,
  groupDisclosuresByStock,
  type DartDisclosure,
} from '@/lib/api/dart';
import { analyzeDisclosure, analyzeBundledDisclosures } from '@/lib/api/groq';
import {
  isDisclosureProcessed,
  registerDisclosureHash,
  isRevisionDisclosure,
} from '@/lib/hash';
import {
  getActiveHotStocks,
  demoteExpiredHotStocks,
  checkHotStockTriggers,
  getHotStockStatistics,
} from '@/lib/hot-stocks';

// Supabase 클라이언트
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ⚠️ 베타 서비스 전까지 비활성화
const USE_HOT_STOCKS = process.env.ENABLE_HOT_STOCKS === 'true' || false;

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

  // 기능 비활성화 체크
  if (!USE_HOT_STOCKS) {
    console.log('ℹ️ Hot stocks feature is disabled (USE_HOT_STOCKS=false)');
    return NextResponse.json({
      success: true,
      message: 'Hot stocks feature disabled until beta',
      analyzed: 0,
    });
  }

  console.log('🔥 Hot stocks analysis started (5-minute polling)...');

  try {
    // 1. 만료된 hot stocks 정리
    const demotedCount = await demoteExpiredHotStocks();

    // 2. 활성화된 hot stocks 가져오기
    const hotStocks = await getActiveHotStocks();

    if (hotStocks.length === 0) {
      console.log('ℹ️ No active hot stocks');
      return NextResponse.json({
        success: true,
        analyzed: 0,
        hot_stocks_count: 0,
        demoted: demotedCount,
        message: 'No active hot stocks',
      });
    }

    console.log(`🔥 Found ${hotStocks.length} active hot stocks`);

    // 3. DART에서 hot stocks 관련 최신 공시 가져오기
    const allDisclosures = await fetchRecentDisclosures(1, true);

    // 4. Hot stocks 관련 공시만 필터링
    const hotStockCodes = new Set(hotStocks.map(h => h.corp_code));
    const hotDisclosures = allDisclosures.filter(d =>
      hotStockCodes.has(d.corp_code)
    );

    if (hotDisclosures.length === 0) {
      console.log('ℹ️ No new disclosures for hot stocks');

      // 통계 정보
      const stats = await getHotStockStatistics();

      return NextResponse.json({
        success: true,
        analyzed: 0,
        hot_stocks_count: hotStocks.length,
        demoted: demotedCount,
        statistics: stats,
        message: 'No new disclosures for hot stocks',
      });
    }

    console.log(`📋 Found ${hotDisclosures.length} disclosures for hot stocks`);

    // 5. Hash 중복 확인
    const newDisclosures: DartDisclosure[] = [];
    let duplicateCount = 0;

    for (const disclosure of hotDisclosures) {
      const isRevision = isRevisionDisclosure(disclosure.report_nm);

      if (!isRevision) {
        const alreadyProcessed = await isDisclosureProcessed(
          disclosure.corp_code,
          disclosure.rcept_no
        );

        if (alreadyProcessed) {
          duplicateCount++;
          continue;
        }
      }

      newDisclosures.push(disclosure);
    }

    // 6. 중요 공시만 필터링
    const filteredDisclosures = filterImportantDisclosures(newDisclosures);

    console.log(`✨ ${filteredDisclosures.length} important disclosures to analyze`);

    if (filteredDisclosures.length === 0) {
      const stats = await getHotStockStatistics();

      return NextResponse.json({
        success: true,
        analyzed: 0,
        hot_stocks_count: hotStocks.length,
        demoted: demotedCount,
        duplicates_skipped: duplicateCount,
        statistics: stats,
        message: 'No important disclosures to analyze',
      });
    }

    // 7. 종목별로 묶기
    const grouped = groupDisclosuresByStock(filteredDisclosures);

    console.log(`📊 Grouped into ${grouped.size} stocks`);

    let successCount = 0;
    let failCount = 0;
    let totalTokensUsed = 0;

    // 8. 종목별 분석
    for (const [stockCode, disclosures] of grouped.entries()) {
      try {
        const corpName = disclosures[0].corp_name;
        const corpCode = disclosures[0].corp_code;

        console.log(`🔍 Analyzing hot stock ${corpName} (${stockCode}): ${disclosures.length} disclosures`);

        // 트리거 유효성 재확인
        const triggerCheck = await checkHotStockTriggers(corpCode, stockCode, corpName);

        if (triggerCheck.shouldPromote) {
          console.log(`✅ Trigger still valid: ${triggerCheck.reason}`);
        } else {
          console.log(`⚠️ No triggers detected, but keeping hot status (TTL not expired)`);
        }

        let analysisResult;

        if (disclosures.length === 1) {
          // 단일 공시
          const d = disclosures[0];
          analysisResult = await analyzeDisclosure(
            corpName,
            stockCode,
            d.report_nm,
            `${d.report_nm}\n${d.rm || ''}`
          );
        } else {
          // 여러 공시 묶음 분석
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

        // 9. DB에 저장 + Hash 등록
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

            // Hash 등록
            await registerDisclosureHash({
              corpCode: disclosure.corp_code,
              rceptNo: disclosure.rcept_no,
              corpName: corpName,
              reportName: disclosure.report_nm,
              isRevision: isRevisionDisclosure(disclosure.report_nm),
            });
          }
        }

        console.log(`✅ ${corpName}: ${analysisResult.sentiment} (${analysisResult.sentiment_score}), ${analysisResult.importance}`);

        // 토큰 사용량 체크 (5분 폴링이므로 제한 낮춤)
        if (totalTokensUsed > 3000) {
          console.log(`⚠️ Token limit reached for this cycle (${totalTokensUsed}). Stopping.`);
          break;
        }

      } catch (error) {
        console.error(`❌ Error analyzing ${stockCode}:`, error);
        failCount += disclosures.length;
      }
    }

    // 통계 정보
    const stats = await getHotStockStatistics();

    console.log(`✅ Hot stocks analysis completed: ${successCount} succeeded, ${failCount} failed, ${totalTokensUsed} tokens used`);

    return NextResponse.json({
      success: true,
      analyzed: successCount,
      failed: failCount,
      tokens_used: totalTokensUsed,
      hot_stocks_count: hotStocks.length,
      demoted: demotedCount,
      duplicates_skipped: duplicateCount,
      statistics: stats,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ Hot stocks analysis failed:', error);
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
