/**
 * GET /api/similar-events?stock=005930&event_type=BUYBACK
 * scores_log + disclosure_insights 조인 — 같은 종목의 과거 유사 이벤트 + 실제 수익률
 */
import { NextResponse } from 'next/server';
import { createServiceClient, getUser } from '@/lib/supabase/server';
import { isSuperAdmin } from '@/lib/constants';

export const revalidate = 3600;

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isSuperAdmin(user.email ?? '')) {
    const sb = createServiceClient();
    const { data: ud } = await sb
      .from('users').select('plan, subscription_status').eq('id', user.id).single() as
      { data: { plan: string | null; subscription_status: string | null } | null };
    const isPaid = ud?.plan && ud.plan !== 'free' && ud?.subscription_status === 'active';
    if (!isPaid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const stock     = searchParams.get('stock');
  const eventType = searchParams.get('event_type') ?? '';

  if (!stock) return NextResponse.json({ error: 'stock required' }, { status: 400 });

  const sb = createServiceClient();

  // 1. 이 종목의 scores_log (실제 수익률 있는 것만)
  const { data: scores } = await sb
    .from('scores_log')
    .select('date, disclosure_id, final_score, future_return_3d, future_return_5d, future_return_20d, mdd_20d')
    .eq('stock_code', stock)
    .not('future_return_5d', 'is', null)
    .order('date', { ascending: false })
    .limit(30) as { data: Array<{
      date: string;
      disclosure_id: string;
      final_score: number | null;
      future_return_3d: number | null;
      future_return_5d: number | null;
      future_return_20d: number | null;
      mdd_20d: number | null;
    }> | null };

  if (!scores?.length) return NextResponse.json([]);

  // 2. 해당 공시의 event_type + report_nm 조회
  const discIds = scores.map(s => s.disclosure_id).filter(Boolean);
  const { data: disclosures } = await sb
    .from('disclosure_insights')
    .select('id, event_type, report_nm, report_nm_en')
    .in('id', discIds) as { data: Array<{
      id: string;
      event_type: string | null;
      report_nm: string | null;
      report_nm_en: string | null;
    }> | null };

  const discMap = new Map((disclosures ?? []).map(d => [d.id, d]));

  // 3. 매핑 + event_type 필터
  const merged = scores
    .map(s => ({ ...s, ...(discMap.get(s.disclosure_id) ?? {}) }))
    .filter(s => !eventType || (s as any).event_type === eventType)
    .slice(0, 6);

  return NextResponse.json(merged);
}
