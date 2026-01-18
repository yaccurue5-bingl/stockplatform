/**
 * Claude Sonnet API 유틸리티
 *
 * Claude 3.5 Sonnet을 사용한 심층 공시 분석
 * - Premium 사용자 전용
 * - 샘플 분석용 (무료 사용자 1개)
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-3-5-sonnet-20241022';

export interface ClaudeAnalysisResult {
  summary: string;                    // 정제된 요약
  detailed_analysis: string;          // 심층 분석
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  sentiment_score: number;            // 0.0 ~ 1.0
  importance: 'HIGH' | 'MEDIUM' | 'LOW';
  investment_implications: string;    // 투자 시사점
  risk_factors: string[];             // 리스크 요인
  key_metrics: string[];              // 핵심 지표
  tokens_used: number;
}

/**
 * Claude Sonnet을 사용한 심층 공시 분석
 *
 * @param corpName 회사명
 * @param stockCode 종목코드
 * @param reportName 공시명
 * @param content 공시 내용
 * @returns Claude 분석 결과
 */
export async function analyzeBySonnet(
  corpName: string,
  stockCode: string,
  reportName: string,
  content: string
): Promise<ClaudeAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const prompt = createSonnetPrompt(corpName, stockCode, reportName, content);

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.content[0]?.text || '';
    const tokensUsed = data.usage?.input_tokens + data.usage?.output_tokens || 0;

    // AI 응답 파싱
    const summary = extractSection(aiResponse, '요약') || aiResponse.substring(0, 300);
    const detailedAnalysis = extractSection(aiResponse, '심층 분석') || aiResponse;
    const sentiment = extractSentiment(aiResponse) || 'NEUTRAL';
    const sentimentScore = extractSentimentScore(aiResponse) || 0.5;
    const importance = extractImportance(aiResponse) || 'MEDIUM';
    const investmentImplications = extractSection(aiResponse, '투자 시사점') || '';
    const riskFactors = extractList(aiResponse, '리스크');
    const keyMetrics = extractList(aiResponse, '핵심 지표');

    console.log(`🎯 Sonnet analysis: ${sentiment} (${sentimentScore}), ${importance} - ${tokensUsed} tokens`);

    return {
      summary,
      detailed_analysis: detailedAnalysis,
      sentiment,
      sentiment_score: sentimentScore,
      importance,
      investment_implications: investmentImplications,
      risk_factors: riskFactors,
      key_metrics: keyMetrics,
      tokens_used: tokensUsed,
    };
  } catch (error) {
    console.error('❌ Sonnet analysis failed:', error);

    // 실패 시 기본값 반환
    return {
      summary: `${corpName}의 공시: ${reportName}`,
      detailed_analysis: 'Analysis unavailable',
      sentiment: 'NEUTRAL',
      sentiment_score: 0.5,
      importance: 'MEDIUM',
      investment_implications: '',
      risk_factors: [],
      key_metrics: [],
      tokens_used: 0,
    };
  }
}

/**
 * 종목별 묶음 공시를 Sonnet으로 심층 분석
 */
export async function analyzeBundledBySonnet(
  corpName: string,
  stockCode: string,
  disclosures: Array<{ report_nm: string; content: string }>
): Promise<ClaudeAnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  // 공시 목록을 하나의 프롬프트로 묶기
  const disclosureList = disclosures
    .map((d, i) => `${i + 1}. ${d.report_nm}\n${d.content.substring(0, 500)}`)
    .join('\n\n');

  const prompt = `다음은 ${corpName} (${stockCode})의 오늘자 공시입니다:

${disclosureList}

이 공시들을 심층 분석하여 다음 형식으로 답변하시오:

1) 요약: 핵심 내용 요약 (3-4문장)
2) 심층 분석: 공시의 배경, 의미, 영향력 분석 (상세)
3) 감정: POSITIVE, NEGATIVE, NEUTRAL 중 하나
4) 감정 점수: 0.0 ~ 1.0 (0.0=매우 부정, 0.5=중립, 1.0=매우 긍정)
5) 중요도: HIGH, MEDIUM, LOW 중 하나
6) 투자 시사점: 투자자가 취해야 할 행동 지침
7) 리스크: 주요 리스크 요인 (불릿 포인트)
8) 핵심 지표: 주목해야 할 재무/사업 지표 (불릿 포인트)

객관적 사실 중심. 과도한 추정 금지.`;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2500,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.content[0]?.text || '';
    const tokensUsed = data.usage?.input_tokens + data.usage?.output_tokens || 0;

    const summary = extractSection(aiResponse, '요약') || aiResponse.substring(0, 300);
    const detailedAnalysis = extractSection(aiResponse, '심층 분석') || aiResponse;
    const sentiment = extractSentiment(aiResponse) || 'NEUTRAL';
    const sentimentScore = extractSentimentScore(aiResponse) || 0.5;
    const importance = extractImportance(aiResponse) || 'MEDIUM';
    const investmentImplications = extractSection(aiResponse, '투자 시사점') || '';
    const riskFactors = extractList(aiResponse, '리스크');
    const keyMetrics = extractList(aiResponse, '핵심 지표');

    console.log(`🎯 Sonnet bundled analysis: ${corpName} - ${tokensUsed} tokens`);

    return {
      summary,
      detailed_analysis: detailedAnalysis,
      sentiment,
      sentiment_score: sentimentScore,
      importance,
      investment_implications: investmentImplications,
      risk_factors: riskFactors,
      key_metrics: keyMetrics,
      tokens_used: tokensUsed,
    };
  } catch (error) {
    console.error('❌ Sonnet bundled analysis failed:', error);

    return {
      summary: `${corpName}의 오늘 공시 ${disclosures.length}건`,
      detailed_analysis: 'Analysis unavailable',
      sentiment: 'NEUTRAL',
      sentiment_score: 0.5,
      importance: 'MEDIUM',
      investment_implications: '',
      risk_factors: [],
      key_metrics: [],
      tokens_used: 0,
    };
  }
}

// ========== 프롬프트 생성 함수 ==========

function createSonnetPrompt(
  corpName: string,
  stockCode: string,
  reportName: string,
  content: string
): string {
  return `다음은 한국 상장사의 공시 정보입니다. 심층 분석을 제공하세요.

회사: ${corpName} (${stockCode})
공시명: ${reportName}

내용:
${content}

다음 형식으로 답변:

1) 요약: 핵심 내용 요약 (3-4문장)
2) 심층 분석: 공시의 배경, 의미, 영향력 분석 (상세하게)
3) 감정: POSITIVE, NEGATIVE, NEUTRAL 중 하나
4) 감정 점수: 0.0 ~ 1.0
5) 중요도: HIGH, MEDIUM, LOW 중 하나
6) 투자 시사점: 투자자가 취해야 할 행동 지침
7) 리스크: 주요 리스크 요인 (불릿 포인트)
8) 핵심 지표: 주목해야 할 재무/사업 지표 (불릿 포인트)

객관적 사실 중심. 과도한 추정 금지.`;
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

function extractList(text: string, section: string): string[] {
  const regex = new RegExp(`${section}[:\\s]+([\\s\\S]+?)(?=\\n\\d+\\)|$)`, 'i');
  const match = text.match(regex);

  if (!match) return [];

  const listText = match[1];
  const items = listText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('-') || line.startsWith('•') || line.match(/^\d+\./))
    .map(line => line.replace(/^[-•]\s*/, '').replace(/^\d+\.\s*/, ''));

  return items;
}
