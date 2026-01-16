import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

  console.log('🤖 Disclosure analysis started...');

  try {
    // 분석 대기 중인 공시 가져오기
    const { data: pendingDisclosures, error: fetchError } = await supabase
      .from('disclosure_insights')
      .select('*')
      .or('analysis_status.eq.pending,analysis_status.is.null,analysis_status.eq.failed')
      .limit(10); // 한 번에 10개씩 처리

    if (fetchError) {
      console.error('❌ Failed to fetch pending disclosures:', fetchError);
      throw fetchError;
    }

    if (!pendingDisclosures || pendingDisclosures.length === 0) {
      console.log('ℹ️ No pending disclosures to analyze');
      return NextResponse.json({
        success: true,
        analyzed: 0,
        message: 'No pending disclosures',
      });
    }

    console.log(`📋 Found ${pendingDisclosures.length} disclosures to analyze`);

    let successCount = 0;
    let failCount = 0;

    // 각 공시 분석
    for (const disclosure of pendingDisclosures) {
      try {
        console.log(`🔍 Analyzing: ${disclosure.report_nm} (${disclosure.id})`);

        // 분석 상태를 processing으로 업데이트
        await supabase
          .from('disclosure_insights')
          .update({ analysis_status: 'processing' })
          .eq('id', disclosure.id);

        // AI 분석 수행
        const analysis = await analyzeDisclosure(disclosure);

        // 분석 결과 저장
        const { error: updateError } = await supabase
          .from('disclosure_insights')
          .update({
            ai_summary: analysis.summary,
            sentiment: analysis.sentiment,
            sentiment_score: analysis.sentiment_score,
            importance: analysis.importance,
            analysis_status: 'completed',
            analyzed_at: new Date().toISOString(),
          })
          .eq('id', disclosure.id);

        if (updateError) {
          console.error(`❌ Failed to save analysis for ${disclosure.id}:`, updateError);
          failCount++;
        } else {
          console.log(`✅ Analysis completed for ${disclosure.id}: ${analysis.sentiment} (${analysis.sentiment_score})`);
          successCount++;
        }
      } catch (error) {
        console.error(`❌ Error analyzing ${disclosure.id}:`, error);

        // 실패 상태로 업데이트
        await supabase
          .from('disclosure_insights')
          .update({
            analysis_status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', disclosure.id);

        failCount++;
      }
    }

    console.log(`✅ Disclosure analysis completed: ${successCount} succeeded, ${failCount} failed`);

    return NextResponse.json({
      success: true,
      analyzed: successCount,
      failed: failCount,
      total: pendingDisclosures.length,
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

// AI를 사용한 공시 분석
async function analyzeDisclosure(disclosure: any): Promise<{
  summary: string;
  sentiment: string;
  sentiment_score: number;
  importance: string;
}> {
  const groqApiKey = process.env.GROQ_API_KEY;

  if (!groqApiKey) {
    throw new Error('GROQ_API_KEY is not set');
  }

  // GROQ AI API 호출
  const prompt = `다음은 한국 주식시장의 공시 정보입니다. 이 공시를 분석하여 다음 정보를 제공해주세요:

제목: ${disclosure.report_nm}
회사: ${disclosure.corp_name}
종목코드: ${disclosure.stock_code || 'N/A'}

다음 형식으로 답변해주세요:
1. 요약: 공시 내용을 3-4문장으로 요약
2. 감정: POSITIVE, NEGATIVE, NEUTRAL 중 하나
3. 감정 점수: 0.0 ~ 1.0 사이의 숫자 (0.0 = 매우 부정적, 0.5 = 중립, 1.0 = 매우 긍정적)
4. 중요도: HIGH, MEDIUM, LOW 중 하나

분석 시 다음을 고려하세요:
- 주가에 미칠 영향
- 투자자에게 중요한 정보인지
- 긍정적/부정적 요소`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: '당신은 한국 주식시장 전문 분석가입니다. 공시를 분석하여 투자자에게 유용한 정보를 제공합니다.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`GROQ API error: ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || '';

    // AI 응답 파싱
    const summary = extractSection(aiResponse, '요약') || '분석 요약을 생성할 수 없습니다.';
    const sentiment = extractSentiment(aiResponse) || 'NEUTRAL';
    const sentiment_score = extractSentimentScore(aiResponse) || 0.5;
    const importance = extractImportance(aiResponse) || 'MEDIUM';

    return {
      summary,
      sentiment,
      sentiment_score,
      importance,
    };
  } catch (error) {
    console.error('❌ AI analysis failed:', error);

    // AI 분석 실패 시 기본값 반환
    return {
      summary: `${disclosure.corp_name}의 공시: ${disclosure.report_nm}`,
      sentiment: 'NEUTRAL',
      sentiment_score: 0.5,
      importance: 'MEDIUM',
    };
  }
}

// AI 응답에서 섹션 추출
function extractSection(text: string, section: string): string | null {
  const regex = new RegExp(`${section}[:\\s]+(.+?)(?=\\n\\d+\\.|$)`, 'is');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

// 감정 추출
function extractSentiment(text: string): string | null {
  const sentimentMatch = text.match(/감정[:\s]+(POSITIVE|NEGATIVE|NEUTRAL)/i);
  return sentimentMatch ? sentimentMatch[1].toUpperCase() : null;
}

// 감정 점수 추출
function extractSentimentScore(text: string): number | null {
  const scoreMatch = text.match(/감정\s*점수[:\s]+(0\.\d+|1\.0|0)/i);
  return scoreMatch ? parseFloat(scoreMatch[1]) : null;
}

// 중요도 추출
function extractImportance(text: string): string | null {
  const importanceMatch = text.match(/중요도[:\s]+(HIGH|MEDIUM|LOW)/i);
  return importanceMatch ? importanceMatch[1].toUpperCase() : null;
}

// POST 메서드도 지원 (수동 트리거용)
export async function POST(req: NextRequest) {
  return GET(req);
}
