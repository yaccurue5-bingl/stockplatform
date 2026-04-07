/**
 * GET /api/event-score/[event_type]
 *
 * event_stats 테이블에서 이벤트 유형별 Signal Score v2를 반환.
 * 정보 제공 목적 — 투자 조언이 아님.
 *
 * 예시 응답:
 * {
 *   "event":                    "DILUTION",
 *   "score":                    86,
 *   "grade":                    "A",
 *   "data_coverage":            0.75,
 *   "historical_avg_return_5d": 7.52,
 *   "sample_size":              225,
 *   "risk_adj_factor":          0.905,
 *   "disclaimer":               "For informational purposes only. Not investment advice."
 * }
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const revalidate = 3600;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ event_type: string }> },
) {
  const { event_type } = await params;
  const sb = createServiceClient();

  interface EventStatsRow {
    event_type: string;
    signal_score: number | null;
    signal_confidence: number | null;
    signal_grade: string | null;
    median_5d_return: number | null;
    sample_size_clean: number | null;
    sample_size: number | null;
    risk_adj_return: number | null;
    std_5d: number | null;
  }

  const { data: raw, error } = await sb
    .from('event_stats')
    .select(
      'event_type, signal_score, signal_confidence, signal_grade, ' +
      'median_5d_return, sample_size_clean, risk_adj_return, ' +
      'avg_5d_return, std_5d, sample_size'
    )
    .eq('event_type', event_type.toUpperCase())
    .single();

  if (error || !raw) {
    return NextResponse.json({ error: 'No stats for this event type' }, { status: 404 });
  }

  const data = raw as unknown as EventStatsRow;

  return NextResponse.json({
    event:                    data.event_type,
    score:                    data.signal_score,
    grade:                    data.signal_grade,
    data_coverage:            data.signal_confidence,
    historical_avg_return_5d: data.median_5d_return,
    sample_size:              data.sample_size_clean ?? data.sample_size,
    risk_adj_factor:          data.risk_adj_return,
    std_5d:                   data.std_5d,
    disclaimer:               'For informational purposes only. Not investment advice.',
  });
}
