/**
 * GET /api/price-chart?stock=005930&date=2026-05-01
 * price_history에서 공시일 ±15 거래일 주가 반환
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
  const stock = searchParams.get('stock');
  const date  = searchParams.get('date'); // YYYY-MM-DD

  if (!stock || !date) return NextResponse.json({ error: 'stock, date required' }, { status: 400 });

  const sb = createServiceClient();
  const base = new Date(date);
  const from = new Date(base); from.setDate(from.getDate() - 20);
  const to   = new Date(base); to.setDate(to.getDate() + 20);

  const { data, error } = await sb
    .from('price_history')
    .select('date, open, close, volume, volume_z')
    .eq('stock_code', stock)
    .gte('date', from.toISOString().split('T')[0])
    .lte('date', to.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (error) return NextResponse.json([]);
  return NextResponse.json(data ?? []);
}
