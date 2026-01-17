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
import {
  isDisclosureProcessed,
  registerDisclosureHash,
  isRevisionDisclosure,
  invalidateOriginalDisclosure,
  getCurrentTimeBucket,
  isBundleSonnetCalled,
  registerBundleSonnet,
} from '@/lib/hash';
import {
  shouldProcessNow,
  isHotStock,
  getShardingStatus,
} from '@/lib/sharding';

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

  // Sharding status (for monitoring)
  const shardingStatus = getShardingStatus();
  console.log(`📊 Sharding: window ${shardingStatus.current.window} (${shardingStatus.current.range}), ${shardingStatus.config.shardCount} shards`);

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

    // 2. Hash 중복 확인 (1차 방어선)
    const newDisclosures: DartDisclosure[] = [];
    let duplicateCount = 0;
    let revisionCount = 0;

    for (const disclosure of allDisclosures) {
      // 분기/반기보고서 제외
      if (isPeriodicReport(disclosure.report_nm)) {
        console.log(`⏭️ Skipping periodic report: ${disclosure.report_nm}`);
        continue;
      }

      // 정정공시 감지 (3차 방어선)
      const isRevision = isRevisionDisclosure(disclosure.report_nm);
      if (isRevision) {
        revisionCount++;
        console.log(`🔄 Revision detected: ${disclosure.report_nm}`);
        // 정정공시는 기존 공시를 무효화하고 재처리
        // (TODO: originalRceptNo 추출 로직 필요 시 추가)
      }

      // 중복 확인 (정정공시는 중복 체크 통과)
      if (!isRevision) {
        const alreadyProcessed = await isDisclosureProcessed(
          disclosure.corp_code,
          disclosure.rcept_no
        );

        if (alreadyProcessed) {
          duplicateCount++;
          console.log(`⏭️ Skipping duplicate: ${disclosure.corp_name} - ${disclosure.report_nm}`);
          continue;
        }
      }

      newDisclosures.push(disclosure);
    }

    console.log(`📋 Found ${allDisclosures.length} disclosures (${duplicateCount} duplicates, ${revisionCount} revisions)`);

    // 3. 중요 공시만 필터링 (실시간 처리 대상)
    const filteredDisclosures = filterImportantDisclosures(newDisclosures);

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
    let sonnetSkippedCount = 0;
    let shardSkippedCount = 0;

    // 현재 시간 bucket
    const currentTimeBucket = getCurrentTimeBucket();
    const now = new Date();

    // 4. 종목별 분석 (묶음 처리로 토큰 절약 + Sharding)
    for (const [stockCode, disclosures] of grouped.entries()) {
      try {
        const corpName = disclosures[0].corp_name;
        const corpCode = disclosures[0].corp_code;

        // 🔀 Sharding: 현재 window에 해당하지 않으면 스킵
        const isHot = isHotStock(corpCode);
        const shouldProcess = shouldProcessNow(corpCode, now);

        if (!isHot && !shouldProcess) {
          shardSkippedCount++;
          console.log(`⏭️ Shard skip: ${corpName} (not in current window)`);
          continue;
        }

        if (isHot) {
          console.log(`🔥 Hot stock: ${corpName} (bypassing shard)`);
        }

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

        // 5. DB에 저장 + Hash 등록
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

            // Hash 등록 (중복 방지)
            const isRevision = isRevisionDisclosure(disclosure.report_nm);
            await registerDisclosureHash({
              corpCode: disclosure.corp_code,
              rceptNo: disclosure.rcept_no,
              corpName: corpName,
              reportName: disclosure.report_nm,
              isRevision: isRevision,
            });
          }
        }

        console.log(`✅ ${corpName}: ${analysisResult.sentiment} (${analysisResult.sentiment_score}), ${analysisResult.importance}`);

        // ⚠️ Sonnet 분석 (베타 서비스 전까지 비활성화)
        // 무료 토큰 세션 내에서만 사용
        const USE_SONNET = false; // TODO: 베타 서비스 시 true로 변경

        if (USE_SONNET) {
          // Bundle Hash 확인 (2차 방어선)
          const alreadyCalled = await isBundleSonnetCalled(
            disclosures[0].corp_code,
            now,
            currentTimeBucket
          );

          if (alreadyCalled) {
            console.log(`⏭️ Sonnet already called for ${corpName} in this time bucket`);
            sonnetSkippedCount++;
          } else {
            // TODO: Sonnet 분석 호출
            // const sonnetResult = await analyzeSonnet(...);

            // Bundle Hash 등록
            await registerBundleSonnet({
              corpCode: disclosures[0].corp_code,
              date: now,
              timeBucket: currentTimeBucket,
              corpName: corpName,
              disclosureCount: disclosures.length,
              tokensUsed: 0, // sonnetResult.tokens_used
            });
          }
        }

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
    console.log(`📊 Hash stats: ${duplicateCount} duplicates skipped, ${revisionCount} revisions processed, ${sonnetSkippedCount} sonnet calls skipped`);
    console.log(`🔀 Shard stats: ${shardSkippedCount} stocks skipped (not in current window)`);

    return NextResponse.json({
      success: true,
      analyzed: successCount,
      failed: failCount,
      tokens_used: totalTokensUsed,
      stocks_analyzed: grouped.size,
      duplicates_skipped: duplicateCount,
      revisions_processed: revisionCount,
      sonnet_skipped: sonnetSkippedCount,
      shard_skipped: shardSkippedCount,
      sharding: {
        window: shardingStatus.current.window,
        range: shardingStatus.current.range,
        shard_count: shardingStatus.config.shardCount,
      },
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
