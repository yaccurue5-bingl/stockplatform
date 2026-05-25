/**
 * GET /api/sector-context?stock=005930
 * 같은 섹터의 최근 HIGH signal 공시 반환 (30일 이내)
 */
import { NextResponse } from 'next/server';
import { createServiceClient, getUser } from '@/lib/supabase/server';
import { isSuperAdmin } from '@/lib/constants';

export const revalidate = 300;

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
  const stock = searchParams.get('stock');
  if (!stock) return NextResponse.json({ error: 'stock required' }, { status: 400 });

  const sb = createServiceClient();

  // 1. 현재 종목의 섹터 조회
  const { data: company } = await sb
    .from('companies').select('sector').eq('stock_code', stock).maybeSingle() as
    { data: { sector: string | null } | null };
  const sector = company?.sector;
  if (!sector) return NextResponse.json({ sector: null, peers: [] });

  // 2. 같은 섹터 종목 코드 목록
  const { data: peers } = await sb
    .from('companies').select('stock_code').eq('sector', sector).neq('stock_code', stock).limit(200) as
    { data: Array<{ stock_code: string }> | null };
  const peerCodes = (peers ?? []).map(p => p.stock_code).filter(Boolean);
  if (!peerCodes.length) return NextResponse.json({ sector, peers: [] });

  // 3. 피어 종목의 최근 HIGH signal 공시 (30일)
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data: disclosures } = await sb
    .from('disclosure_insights')
    .select('id, corp_name, stock_code, report_nm, report_nm_en, sentiment_score, short_term_impact_score, final_score, updated_at, event_type')
    .eq('analysis_status', 'completed')
    .eq('is_visible', true)
    .in('stock_code', peerCodes)
    .gte('short_term_impact_score', 3.5)   // HIGH 또는 상위 MEDIUM
    .gte('updated_at', since.toISOString())
    .order('updated_at', { ascending: false })
    .limit(6) as { data: Array<{
      id: string;
      corp_name: string;
      stock_code: string;
      report_nm: string | null;
      report_nm_en: string | null;
      sentiment_score: number | null;
      short_term_impact_score: number | null;
      final_score: number | null;
      updated_at: string;
      event_type: string | null;
    }> | null };

  return NextResponse.json({ sector, peers: disclosures ?? [] });
}
