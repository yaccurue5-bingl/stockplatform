/**
 * GET /api/event-score/[event_type]
 *
 * event_stats 테이블에서 이벤트 유형별 Signal Score v2를 반환.
 *
 * 예시 응답:
 * {
 *   "event":           "DILUTION",
 *   "score":           86,
 *   "grade":           "A",
 *   "confidence":      0.75,
 *   "expected_return": 7.52,
 *   "sample_size":     225,
 *   "risk_adj_return": 0.905
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

  const { data, error } = await sb
    .from('event_stats')
    .select(
      'event_type, signal_score, signal_confidence, signal_grade, ' +
      'median_5d_return, sample_size_clean, risk_adj_return, ' +
      'avg_5d_return, std_5d, sample_size'
    )
    .eq('event_type', event_type.toUpperCase())
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'No stats for this event type' }, { status: 404 });
  }

  return NextResponse.json({
    event:           data.event_type,
    score:           data.signal_score,
    grade:           data.signal_grade,
    confidence:      data.signal_confidence,
    expected_return: data.median_5d_return,
    sample_size:     data.sample_size_clean ?? data.sample_size,
    risk_adj_return: data.risk_adj_return,
    avg_5d_return:   data.avg_5d_return,
    std_5d:          data.std_5d,
  });
}
