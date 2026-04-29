/**
 * SEO Landing page용 실데이터 테이블 rows 조회 헬퍼
 * disclosure_insights + dart_corp_codes 조인으로 영문 기업명 포함
 */
import { createServiceClient } from '@/lib/supabase/server';

type EventType = 'EARNINGS' | 'DILUTION' | 'CONTRACT';

// sentiment_score → 표시 문자열
function toSignal(score: number): string {
  if (score >= 0.3)  return 'BULLISH';
  if (score <= -0.3) return 'BEARISH';
  return '—';
}
function toSentiment(score: number): string {
  if (score >= 0.3)  return 'POSITIVE';
  if (score <= -0.3) return 'NEGATIVE';
  return 'NEUTRAL';
}
// short_term_impact_score (0~5) → 0~100
function toImpact(score: number): string {
  return String(Math.round(Math.min(score, 5) * 20));
}
// rcept_dt "20260414" → "2026-04-14"
function fmtDate(d: string): string {
  if (!d || d.length < 8) return d;
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}
// report_nm → 딜레이션 타입 약어
function toDilutionType(reportNm: string): string {
  if (reportNm.includes('전환사채'))   return 'CB';
  if (reportNm.includes('유상증자'))   return 'Rights';
  if (reportNm.includes('신주인수권')) return 'BW';
  if (reportNm.includes('무상증자'))   return 'Bonus';
  return 'Other';
}

export interface EventTableResult {
  rows: string[][];
  ids:  string[];   // disclosure_insights.id — /signal/{id} 링크용
}

export async function fetchEventTableRows(
  eventType: EventType,
  limit = 5,
): Promise<EventTableResult> {
  try {
    const sb = createServiceClient();

    // Step 1: 최신 공시 rows (id 포함)
    const { data: rows, error } = await sb
      .from('disclosure_insights')
      .select('id, corp_name, stock_code, rcept_dt, event_type, sentiment_score, short_term_impact_score, report_nm')
      .eq('analysis_status', 'completed')
      .eq('is_visible', true)
      .eq('event_type', eventType)
      .order('rcept_dt', { ascending: false })
      .limit(limit * 3); // SPAC 필터 여유분

    if (error || !rows?.length) return { rows: [], ids: [] };

    // Step 2: 영문 기업명 조회
    const codes = [...new Set(rows.map((r: any) => r.stock_code).filter(Boolean))];
    const { data: corpData } = await sb
      .from('dart_corp_codes')
      .select('stock_code, corp_name_en')
      .in('stock_code', codes);

    const enMap: Record<string, string> = {};
    (corpData ?? []).forEach((c: any) => {
      if (c.corp_name_en) enMap[c.stock_code] = c.corp_name_en;
    });

    // Step 3: 종목코드 기준 중복 제거 후 limit개
    const seen = new Set<string>();
    const deduped: any[] = [];
    for (const r of rows) {
      const code = r.stock_code ?? '';
      if (!seen.has(code)) {
        seen.add(code);
        deduped.push(r);
        if (deduped.length === limit) break;
      }
    }

    // Step 4: event type별 컬럼 매핑
    const resultRows = deduped.map((r) => {
      const name     = enMap[r.stock_code] ?? r.corp_name ?? '';
      const date     = fmtDate(r.rcept_dt ?? '');
      const score    = Number(r.sentiment_score ?? 0);
      const impact   = toImpact(Number(r.short_term_impact_score ?? 0));
      const signal   = toSignal(score);
      const reportNm = String(r.report_nm ?? '');

      if (eventType === 'EARNINGS') {
        return [name, date, toSentiment(score), impact, signal];
      }
      if (eventType === 'DILUTION') {
        return [name, date, toDilutionType(reportNm), impact, signal];
      }
      return [name, date, impact, signal];
    });

    return {
      rows: resultRows,
      ids:  deduped.map((r) => String(r.id)),
    };
  } catch {
    return { rows: [], ids: [] };
  }
}
