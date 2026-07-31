/**
 * GET /api/price-chart?stock=005930&date=2026-05-01
 * price_history에서 공시일 ±15 거래일 주가 반환
 * 공개 — 공시 상세 자체가 비로그인으로 열람 가능해서 Price Reaction도 동일하게 공개.
 */
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const revalidate = 3600;

export async function GET(request: Request) {
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
