/**
 * GET /api/short/[stock_code]
 *
 * ⚠️ DEPRECATED — 금융위원회 주식대차정보 상업용 제공 중단 (2026-04-20)
 * 신규 수집 중단. 기존 DB 에 남아 있는 historical 데이터는 계속 조회 가능.
 * 데이터가 없으면 null 필드를 반환하며, 클라이언트는 graceful 처리 필요.
 */
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

  // 최신 레코드
  const { data: latest, error: e1 } = await supabase
    .from('short_interest')
    .select('date, loan_balance, loan_shares')
    .eq('stock_code', stock_code)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (e1) return NextResponse.json({ error: e1.message }, { status: 500 });
  if (!latest || latest.loan_balance == null) {
    return NextResponse.json({ loan_change_pct: null, current_balance: null });
  }

  // 3영업일 전 레코드
  const threeDaysBefore = new Date(latest.date);
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

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });

  const loan_change_pct =
    prev?.loan_balance && prev.loan_balance !== 0
      ? Math.round(
          ((latest.loan_balance - prev.loan_balance) / prev.loan_balance) * 1000,
        ) / 10
      : null;

  // 상장주식수 → Short Interest % of float
  const { data: company } = await supabase
    .from('companies')
    .select('listed_shares')
    .eq('stock_code', stock_code)
    .maybeSingle();

  const listed_shares   = company?.listed_shares ?? null;
  const loan_shares     = latest.loan_shares ?? null;
  const short_interest_pct =
    listed_shares && loan_shares && listed_shares > 0
      ? Math.round((loan_shares / listed_shares) * 10000) / 100  // 소수점 2자리
      : null;

  return NextResponse.json({
    loan_change_pct,
    loan_shares,
    listed_shares,
    short_interest_pct,
    current_date: latest.date,
    prev_date:    prev?.date ?? null,
  });
}
