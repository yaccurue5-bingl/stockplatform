/**
 * Groq AI API 유틸리티
 *
 * LLaMA 3.3 70B를 사용한 공시 분석
 * 1차 요약 정제 전용 (토큰 절약)
 */

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

export interface GroqAnalysisResult {
  summary: string;          // 정제된 요약
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  sentiment_score: number;  // 0.0 ~ 1.0
  importance: 'HIGH' | 'MEDIUM' | 'LOW';
  tokens_used: number;
}

/**
 * Groq를 사용한 공시 1차 정제
 * - 핵심 문단만 추출
 * - 반복 문구, 법적 문구 제거
 * - 1,000토큰 이내
 */
export async function refineDisclosure(
  corpName: string,
  reportName: string,
  content: string
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const prompt = createRefinePrompt(corpName, reportName, content);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a financial analyst specializing in Korean stock market disclosures. Extract only investment-relevant information.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,  // 정제된 요약은 짧게
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const refinedText = data.choices[0]?.message?.content || '';

    console.log(`✅ Groq refined disclosure (${data.usage?.total_tokens || 0} tokens)`);

    return refinedText.trim();
  } catch (error) {
    console.error('❌ Groq refine failed:', error);
    // 실패 시 원본 반환 (일부)
    return content.slice(0, 500);
  }
}

/**
 * Groq를 사용한 공시 분석
 * - 감정 분석 (POSITIVE/NEGATIVE/NEUTRAL)
 * - 중요도 판단 (HIGH/MEDIUM/LOW)
 * - 투자자 요약
 */
export async function analyzeDisclosure(
  corpName: string,
  stockCode: string,
  reportName: string,
  refinedContent: string
): Promise<GroqAnalysisResult> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  const prompt = createAnalysisPrompt(corpName, stockCode, reportName, refinedContent);

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a Korean stock market analyst. Provide concise, objective analysis for investors.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;

    // AI 응답 파싱
    const summary = extractSection(aiResponse, '요약') || aiResponse;
    const sentiment = extractSentiment(aiResponse) || 'NEUTRAL';
    const sentimentScore = extractSentimentScore(aiResponse) || 0.5;
    const importance = extractImportance(aiResponse) || 'MEDIUM';

    console.log(`✅ Groq analysis: ${sentiment} (${sentimentScore}), ${importance} - ${tokensUsed} tokens`);

    return {
      summary,
      sentiment,
      sentiment_score: sentimentScore,
      importance,
      tokens_used: tokensUsed,
    };
  } catch (error) {
    console.error('❌ Groq analysis failed:', error);

    // 실패 시 기본값 반환
    return {
      summary: `${corpName}의 공시: ${reportName}`,
      sentiment: 'NEUTRAL',
      sentiment_score: 0.5,
      importance: 'MEDIUM',
      tokens_used: 0,
    };
  }
}

/**
 * 종목별 묶음 공시 분석
 * 하루의 여러 공시를 한 번에 분석 (토큰 절약)
 */
export async function analyzeBundledDisclosures(
  corpName: string,
  stockCode: string,
  disclosures: Array<{ report_nm: string; content: string }>
): Promise<GroqAnalysisResult> {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured');
  }

  // 공시 목록을 하나의 프롬프트로 묶기
  const disclosureList = disclosures
    .map((d, i) => `${i + 1}. ${d.report_nm}`)
    .join('\n');

  const prompt = `다음은 ${corpName} (${stockCode})의 오늘자 공시 목록입니다:

${disclosureList}

이 공시들을 종합하여:
1) 요약: 투자자 관점 핵심 요약 (3-4문장)
2) 감정: POSITIVE, NEGATIVE, NEUTRAL 중 하나
3) 감정 점수: 0.0 ~ 1.0 (0.0=매우 부정, 0.5=중립, 1.0=매우 긍정)
4) 중요도: HIGH, MEDIUM, LOW 중 하나

과도한 추정은 금지. 객관적 사실 중심으로 분석.`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a Korean stock market analyst. Provide concise, objective analysis.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || 0;

    const summary = extractSection(aiResponse, '요약') || aiResponse;
    const sentiment = extractSentiment(aiResponse) || 'NEUTRAL';
    const sentimentScore = extractSentimentScore(aiResponse) || 0.5;
    const importance = extractImportance(aiResponse) || 'MEDIUM';

    console.log(`✅ Groq bundled analysis: ${corpName} - ${tokensUsed} tokens`);

    return {
      summary,
      sentiment,
      sentiment_score: sentimentScore,
      importance,
      tokens_used: tokensUsed,
    };
  } catch (error) {
    console.error('❌ Groq bundled analysis failed:', error);

    return {
      summary: `${corpName}의 오늘 공시 ${disclosures.length}건`,
      sentiment: 'NEUTRAL',
      sentiment_score: 0.5,
      importance: 'MEDIUM',
      tokens_used: 0,
    };
  }
}

// ========== 프롬프트 생성 함수 ==========

/**
 * 공시 정제용 프롬프트
 */
function createRefinePrompt(corpName: string, reportName: string, content: string): string {
  return `다음 DART 공시에서 투자 판단에 필요한 핵심 문단만 추출하라.

회사: ${corpName}
공시명: ${reportName}

원문:
${content}

지침:
- 반복 문구, 법적 문구 제거
- 표는 내용만 문장으로 요약
- 1,000토큰 이내
- 투자 판단에 무관한 내용 제외`;
}

/**
 * 공시 분석용 프롬프트
 */
function createAnalysisPrompt(
  corpName: string,
  stockCode: string,
  reportName: string,
  content: string
): string {
  return `다음은 한국 상장사의 공시 정보입니다.

회사: ${corpName} (${stockCode})
공시명: ${reportName}

내용:
${content}

다음 형식으로 답변:
1) 요약: 개인/기관 투자자 관점 핵심 요약 (3-4문장)
2) 감정: POSITIVE, NEGATIVE, NEUTRAL 중 하나
3) 감정 점수: 0.0 ~ 1.0
4) 중요도: HIGH, MEDIUM, LOW 중 하나

과도한 추정 금지. 객관적 사실 중심.`;
}

// ========== AI 응답 파싱 함수 ==========

function extractSection(text: string, section: string): string | null {
  const regex = new RegExp(`${section}[:\\s]+(.+?)(?=\\n\\d+\\)|$)`, 'is');
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

function extractSentiment(text: string): 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | null {
  const match = text.match(/감정[:\s]+(POSITIVE|NEGATIVE|NEUTRAL)/i);
  if (!match) return null;

  const sentiment = match[1].toUpperCase();
  if (sentiment === 'POSITIVE' || sentiment === 'NEGATIVE' || sentiment === 'NEUTRAL') {
    return sentiment as 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  }
  return null;
}

function extractSentimentScore(text: string): number | null {
  const match = text.match(/감정\s*점수[:\s]+(0\.\d+|1\.0|0)/i);
  return match ? parseFloat(match[1]) : null;
}

function extractImportance(text: string): 'HIGH' | 'MEDIUM' | 'LOW' | null {
  const match = text.match(/중요도[:\s]+(HIGH|MEDIUM|LOW)/i);
  if (!match) return null;

  const importance = match[1].toUpperCase();
  if (importance === 'HIGH' || importance === 'MEDIUM' || importance === 'LOW') {
    return importance as 'HIGH' | 'MEDIUM' | 'LOW';
  }
  return null;
}
