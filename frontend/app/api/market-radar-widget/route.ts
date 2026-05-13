import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createServiceClient() as any;

    // ── 4개 쿼리 병렬 실행 (기존 5개 순차 → 1 Promise.all 단계) ──────────────
    // sector_signals: 최신 날짜를 별도 조회하는 대신, 최근 10행을 가져와서
    //   client-side에서 최신 date만 필터링 → 쿼리 2회 → 1회로 단축
    const [indicatorsRes, indicesRes, sectorsRes, macroRes] = await Promise.all([
      supabase
        .from('daily_indicators')
        .select('date, foreign_net_buy_kospi')
        .order('date', { ascending: false })
        .limit(15),
      supabase
        .from('market_indices')
        .select('symbol, price, change_rate')
        .in('symbol', ['KOSPI', 'KOSDAQ']),
      supabase
        .from('sector_signals')
        .select('date, sector_en, signal, avg_return_3d, disclosure_count, score')
        .order('date', { ascending: false })
        .order('score', { ascending: false })
        .limit(10),
      supabase
        .from('sector_macro')
        .select('sector_en, year_month, export_yoy, export_momentum, macro_score, macro_label')
        .order('year_month', { ascending: false })
        .limit(20),
    ]);

    if (indicatorsRes.error) throw indicatorsRes.error;
    if (indicesRes.error)    throw indicesRes.error;

    // ── daily_indicators 처리 ─────────────────────────────────────────────────
    const sorted: Array<{ date: string; foreign_net_buy_kospi: number | null }> = (
      (indicatorsRes.data ?? []) as Array<{ date: string; foreign_net_buy_kospi: number | null }>
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

    // ── market_indices 처리 ───────────────────────────────────────────────────
    const indices = indicesRes.data;
    const parseIndex = (symbol: string) => {
      const row = (indices as Array<{ symbol: string; price: string; change_rate: number }> ?? [])
        .find((r) => r.symbol === symbol);
      if (!row) return null;
      const value = parseFloat(row.price.replace(/,/g, ''));
      return { value, change: row.change_rate };
    };

    const kospi = parseIndex('KOSPI');
    const kosdaq = parseIndex('KOSDAQ');

    // ── sector_signals 처리: 최신 date 행만 추출 후 top 3 ────────────────────
    type SectorRow = {
      date: string; sector_en: string; signal: string;
      avg_return_3d: number; disclosure_count: number; score: number;
    };
    const allSectors = (sectorsRes.data ?? []) as SectorRow[];
    const latestSectorDate = allSectors[0]?.date ?? null;
    const top3Sectors = latestSectorDate
      ? allSectors.filter((s) => s.date === latestSectorDate).slice(0, 3)
      : [];

    // ── sector_macro 처리 ─────────────────────────────────────────────────────
    const macroMap = new Map(
      ((macroRes.data ?? []) as Array<{
        sector_en: string;
        year_month: string;
        export_yoy: number;
        export_momentum: string;
        macro_score: number;
        macro_label: string;
      }>).map((m) => [m.sector_en, m])
    );

    const top_sectors = top3Sectors.map((s) => ({
      sector_en: s.sector_en,
      signal: s.signal,
      avg_return_3d: s.avg_return_3d,
      disclosure_count: s.disclosure_count,
      score: s.score,
      macro: macroMap.get(s.sector_en) ?? null,
    }));

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
