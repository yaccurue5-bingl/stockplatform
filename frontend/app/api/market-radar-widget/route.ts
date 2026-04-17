import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any;

    // 1) daily_indicators 최근 15일 (foreign_net_buy_kospi)
    const { data: indicators, error: indErr } = await supabase
      .from('daily_indicators')
      .select('date, foreign_net_buy_kospi')
      .order('date', { ascending: false })
      .limit(15);

    if (indErr) throw indErr;

    const sorted: Array<{ date: string; foreign_net_buy_kospi: number | null }> = (
      (indicators ?? []) as Array<{ date: string; foreign_net_buy_kospi: number | null }>
    )
      .filter((r) => r.foreign_net_buy_kospi != null)
      .sort((a, b) => a.date.localeCompare(b.date)); // 오름차순으로 재정렬

    // 최신 날짜
    const latestDate = sorted.length > 0 ? sorted[sorted.length - 1].date : null;

    // flow_trend: 최근 12일 (date + value)
    const flow_trend = sorted.slice(-12).map((r) => ({
      date: r.date,
      value: r.foreign_net_buy_kospi as number,
    }));

    // 오늘 값 (억원)
    const foreign_net_buy =
      sorted.length > 0 ? (sorted[sorted.length - 1].foreign_net_buy_kospi as number) : 0;

    // regime: 최근 3일 합계 부호
    const recent3 = sorted
      .slice(-3)
      .reduce((acc, r) => acc + (r.foreign_net_buy_kospi as number), 0);
    const regime: 'RISK_ON' | 'RISK_OFF' = recent3 > 0 ? 'RISK_ON' : 'RISK_OFF';

    // 2) market_indices
    const { data: indices, error: idxErr } = await supabase
      .from('market_indices')
      .select('symbol, price, change_rate')
      .in('symbol', ['KOSPI', 'KOSDAQ']);

    if (idxErr) throw idxErr;

    const parseIndex = (symbol: string) => {
      const row = (indices as Array<{ symbol: string; price: string; change_rate: number }> ?? [])
        .find((r) => r.symbol === symbol);
      if (!row) return null;
      const value = parseFloat(row.price.replace(/,/g, ''));
      return { value, change: row.change_rate };
    };

    const kospi = parseIndex('KOSPI');
    const kosdaq = parseIndex('KOSDAQ');

    // 3) sector_signals: 최신 날짜 top 3 (score DESC)
    const { data: sectorLatest, error: secErr } = await supabase
      .from('sector_signals')
      .select('date')
      .order('date', { ascending: false })
      .limit(1);

    if (secErr) throw secErr;

    let top_sectors: Array<{
      sector_en: string;
      signal: string;
      avg_return_3d: number;
      disclosure_count: number;
      score: number;
    }> = [];

    const sectorRows = sectorLatest as Array<{ date: string }> | null;
    if (sectorRows && sectorRows.length > 0) {
      const latestSectorDate = sectorRows[0].date;
      const { data: sectors, error: secDataErr } = await supabase
        .from('sector_signals')
        .select('sector_en, signal, avg_return_3d, disclosure_count, score')
        .eq('date', latestSectorDate)
        .order('score', { ascending: false })
        .limit(3);

      if (secDataErr) throw secDataErr;

      top_sectors = (
        (sectors ?? []) as Array<{
          sector_en: string;
          signal: string;
          avg_return_3d: number;
          disclosure_count: number;
          score: number;
        }>
      ).map((s) => ({
        sector_en: s.sector_en,
        signal: s.signal,
        avg_return_3d: s.avg_return_3d,
        disclosure_count: s.disclosure_count,
        score: s.score,
      }));
    }

    const body = {
      date: latestDate,
      regime,
      kospi,
      kosdaq,
      foreign_net_buy,
      flow_trend,
      top_sectors,
    };

    return NextResponse.json(body, {
      headers: {
        'Cache-Control': 's-maxage=900, stale-while-revalidate=1800',
      },
    });
  } catch (err) {
    console.error('[market-radar-widget] error:', err);
    return NextResponse.json({ error: 'internal server error' }, { status: 500 });
  }
}
