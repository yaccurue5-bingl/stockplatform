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

  const { data, error } = await supabase
    .from('financials_yoy')
    .select('fiscal_year, revenue_yoy, op_profit_yoy, profit_yoy, is_financial_sector')
    .eq('stock_code', stock_code)
    .order('fiscal_year', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[financials API]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json(null);  // 데이터 없음 → UI 섹션 숨김
  }

  return NextResponse.json({
    fiscal_year:          data.fiscal_year,
    is_financial_sector:  data.is_financial_sector,
    revenue_yoy:          data.revenue_yoy,      // 금융업이면 null
    op_profit_yoy:        data.op_profit_yoy,    // 금융업이면 null
    profit_yoy:           data.profit_yoy,       // 모든 기업 공통
  });
}
