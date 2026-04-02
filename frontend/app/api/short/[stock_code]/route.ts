import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ stock_code: string }> },
) {
  const { stock_code } = await params;

  // 최신 레코드 조회
  const { data: latest, error: e1 } = await supabase
    .from('short_interest')
    .select('date, loan_balance')
    .eq('stock_code', stock_code)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (e1) {
    console.error('[short API] latest query error:', e1);
    return NextResponse.json({ error: e1.message }, { status: 500 });
  }

  if (!latest || latest.loan_balance == null) {
    return NextResponse.json({ loan_change_pct: null, current_balance: null });
  }

  // 3영업일 전 레코드 조회 (해당 날짜 이전 가장 최근 레코드)
  const latestDate = new Date(latest.date);
  const threeDaysBefore = new Date(latestDate);
  threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);
  const prevDateStr = threeDaysBefore.toISOString().split('T')[0];

  const { data: prev, error: e2 } = await supabase
    .from('short_interest')
    .select('date, loan_balance')
    .eq('stock_code', stock_code)
    .lte('date', prevDateStr)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (e2) {
    console.error('[short API] prev query error:', e2);
    return NextResponse.json({ error: e2.message }, { status: 500 });
  }

  if (!prev || !prev.loan_balance) {
    return NextResponse.json({
      loan_change_pct: null,
      current_balance: latest.loan_balance,
    });
  }

  const loan_change_pct =
    prev.loan_balance === 0
      ? null
      : Math.round(
          ((latest.loan_balance - prev.loan_balance) / prev.loan_balance) * 1000,
        ) / 10; // 소수점 1자리

  return NextResponse.json({
    loan_change_pct,
    current_balance: latest.loan_balance,
    current_date:    latest.date,
    prev_date:       prev.date,
  });
}
