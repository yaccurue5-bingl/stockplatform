/**
 * HotStocksWidget — 대시보드용 컴팩트 Hot Stocks 리스트 (Server Component)
 * Hot Score = E_score × sigmoid(M_score) 기반 Top 5
 */

import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';

// ── 상수 ─────────────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  EARNINGS:         'Earnings',
  CONTRACT:         'Contract',
  DILUTION:         'Dilution',
  BUYBACK:          'Buyback',
  MNA:              'M&A',
  LEGAL:            'Legal',
  CAPEX:            'Capex',
  EXECUTIVE_CHANGE: 'Executive',
  OTHER:            'Disclosure',
};

const EVENT_COLORS: Record<string, string> = {
  EARNINGS:         'bg-blue-400/10 text-blue-400',
  CONTRACT:         'bg-emerald-400/10 text-emerald-400',
  DILUTION:         'bg-orange-400/10 text-orange-400',
  BUYBACK:          'bg-purple-400/10 text-purple-400',
  MNA:              'bg-yellow-400/10 text-yellow-400',
  LEGAL:            'bg-red-400/10 text-red-400',
  CAPEX:            'bg-cyan-400/10 text-cyan-400',
  EXECUTIVE_CHANGE: 'bg-pink-400/10 text-pink-400',
  OTHER:            'bg-gray-400/10 text-gray-400',
};

const GRADE_COLORS: Record<string, string> = {
  A: 'text-[#00D4A6]',
  B: 'text-blue-400',
  C: 'text-yellow-400',
  D: 'text-orange-400',
  F: 'text-red-400',
};

const CAP_SIGMA: Record<string, number> = { LARGE: 0.015, MID: 0.025, SMALL: 0.040 };
const CAP_LARGE = 245_000_000_000;
const CAP_MID   =  65_000_000_000;

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function sigmoid(x: number): number { return 1 / (1 + Math.exp(-x)); }

function capBucket(marketCap: number | null): 'LARGE' | 'MID' | 'SMALL' {
  if (!marketCap || marketCap <= 0) return 'SMALL';
  if (marketCap >= CAP_LARGE) return 'LARGE';
  if (marketCap >= CAP_MID)   return 'MID';
  return 'SMALL';
}

function tradingDaysAfter(baseDateStr: string, offset: number): string {
  const y = parseInt(baseDateStr.slice(0, 4));
  const m = parseInt(baseDateStr.slice(4, 6)) - 1;
  const d = parseInt(baseDateStr.slice(6, 8));
  const dt = new Date(y, m, d);
  let added = 0;
  while (added < offset) {
    dt.setDate(dt.getDate() + 1);
    const dow = dt.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return dt.toISOString().slice(0, 10);
}

// ── 타입 ─────────────────────────────────────────────────────────────────────

interface WidgetItem {
  id: string;
  corp_name: string;
  stock_code: string;
  event_type: string;
  e_score: number;
  signal_grade: string | null;
  headline: string | null;
  median_return: number | null;
  price_1d: number | null;    // % (already ×100)
  volume_ratio: number | null;
  hot_score: number;
}

// ── 데이터 페칭 ───────────────────────────────────────────────────────────────

async function fetchItems(): Promise<WidgetItem[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createServiceClient() as any;

    // 1. event_stats
    const { data: statsRows } = await sb
      .from('event_stats')
      .select('event_type, signal_score, signal_grade, sample_size_clean, median_5d_return');

    type EventMeta = { e_score: number; grade: string | null; median_return: number | null; sample_size: number };
    const eventMap = new Map<string, EventMeta>();
    for (const row of statsRows ?? []) {
      eventMap.set(row.event_type as string, {
        e_score:       Math.round((row.signal_score ?? 0) * 0.3),
        grade:         row.signal_grade ?? null,
        median_return: row.median_5d_return ?? null,
        sample_size:   row.sample_size_clean ?? 0,
      });
    }

    // 2. 최근 3일 공시
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: discRows } = await sb
      .from('disclosure_insights')
      .select('id, corp_name, stock_code, event_type, headline, final_score, rcept_dt')
      .eq('analysis_status', 'completed')
      .eq('is_visible', true)
      .gte('created_at', since)
      .not('event_type', 'is', null)
      .order('final_score', { ascending: false })
      .limit(200);

    if (!discRows?.length) return [];

    type DiscRow = {
      id: string; corp_name: string; stock_code: string; event_type: string;
      headline: string | null; final_score: number | null; rcept_dt: string;
    };

    // 3. 1차 필터
    const qualify = (rows: DiscRow[], minSample: number, minE: number): DiscRow[] =>
      rows.filter(r => {
        const et = (r.event_type ?? '').toUpperCase();
        const meta = eventMap.get(et);
        return meta && meta.sample_size >= minSample && meta.e_score >= minE;
      });

    const strict = qualify(discRows as DiscRow[], 50, 20);
    const pool   = strict.length >= 2 ? strict : qualify(discRows as DiscRow[], 30, 15);
    if (!pool.length) return [];

    // 4. price_history 조회
    const stockCodes = [...new Set(pool.map(r => r.stock_code).filter(Boolean))];

    const d1DateMap = new Map<string, string>();
    for (const row of pool) {
      if (!d1DateMap.has(row.stock_code) && row.rcept_dt) {
        d1DateMap.set(row.stock_code, tradingDaysAfter(String(row.rcept_dt), 1));
      }
    }

    const minDate = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);

    const { data: priceRows } = await sb
      .from('price_history')
      .select('stock_code, date, open, close, volume')
      .in('stock_code', stockCodes)
      .gte('date', minDate)
      .order('date', { ascending: false });

    type PriceEntry = { open: number | null; close: number | null; volume: number | null };
    const priceIndex = new Map<string, Map<string, PriceEntry>>();
    for (const p of (priceRows ?? []) as Array<{
      stock_code: string; date: string;
      open: number | null; close: number | null; volume: number | null;
    }>) {
      if (!priceIndex.has(p.stock_code)) priceIndex.set(p.stock_code, new Map());
      priceIndex.get(p.stock_code)!.set(p.date, { open: p.open, close: p.close, volume: p.volume });
    }

    // 5. 시총 조회
    const { data: capRows } = await sb
      .from('companies')
      .select('stock_code, market_cap')
      .in('stock_code', stockCodes);

    const capMap = new Map<string, number | null>(
      ((capRows ?? []) as Array<{ stock_code: string; market_cap: number | null }>)
        .map(r => [r.stock_code, r.market_cap])
    );

    // 6. M_score + Hot_score 계산
    const seen = new Set<string>();
    const results: WidgetItem[] = [];

    for (const row of pool) {
      const et   = (row.event_type ?? '').toUpperCase();
      const meta = eventMap.get(et);
      if (!meta) continue;
      if (seen.has(row.stock_code)) continue;

      const stockPrices = priceIndex.get(row.stock_code);
      const d1Date = d1DateMap.get(row.stock_code);
      const d1     = d1Date ? stockPrices?.get(d1Date) : null;

      let price_1d: number | null = null;
      if (d1?.close != null && d1?.open != null && d1.open > 0) {
        price_1d = d1.close / d1.open - 1;
      }

      let volume_ratio: number | null = null;
      if (stockPrices) {
        const recentVols = [...stockPrices.values()]
          .map(p => p.volume)
          .filter((v): v is number => v !== null)
          .slice(0, 20);
        if (recentVols.length >= 5 && d1?.volume != null) {
          const avg20 = recentVols.reduce((s, v) => s + v, 0) / recentVols.length;
          volume_ratio = avg20 > 0 ? d1.volume / avg20 : null;
        }
      }

      if (volume_ratio !== null && volume_ratio < 1.5) continue;

      const bucket   = capBucket(capMap.get(row.stock_code) ?? null);
      const sigma    = CAP_SIGMA[bucket];
      const price_z  = price_1d !== null ? price_1d / sigma : 0;
      const volume_z = volume_ratio !== null ? (volume_ratio - 1.0) / 0.5 : 0;
      const m_score  = 0.6 * price_z + 0.4 * volume_z;
      const hot_score = Math.round(meta.e_score * sigmoid(m_score) * 10) / 10;

      seen.add(row.stock_code);
      results.push({
        id:           row.id,
        corp_name:    row.corp_name,
        stock_code:   row.stock_code,
        event_type:   et,
        e_score:      meta.e_score,
        signal_grade: meta.grade,
        headline:     row.headline ?? null,
        median_return: meta.median_return,
        price_1d:     price_1d !== null ? Math.round(price_1d * 10000) / 100 : null,
        volume_ratio: volume_ratio !== null ? Math.round(volume_ratio * 10) / 10 : null,
        hot_score,
      });

      if (results.length >= 10) break;
    }

    results.sort((a, b) => b.hot_score - a.hot_score || b.e_score - a.e_score);
    return results.slice(0, 5);
  } catch {
    return [];
  }
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export default async function HotStocksWidget() {
  const items = await fetchItems();
  if (!items.length) return null;

  return (
    <div className="bg-[#0d1117] border border-gray-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00D4A6] animate-pulse" />
          <p className="text-sm font-semibold text-white">Event Intelligence</p>
        </div>
        <Link href="/disclosures" className="text-xs text-[#00D4A6] hover:underline">
          View all →
        </Link>
      </div>

      {/* List */}
      <ul className="divide-y divide-gray-800/60">
        {items.map((item) => {
          const ec  = EVENT_COLORS[item.event_type] ?? EVENT_COLORS.OTHER;
          const gc  = GRADE_COLORS[item.signal_grade ?? 'C'] ?? GRADE_COLORS.C;
          const ret = item.median_return;
          const oneLiner = item.headline
            ?? (ret !== null
              ? `${ret >= 0 ? '+' : ''}${ret.toFixed(1)}% avg return (5d)`
              : `E score ${item.e_score}/30`);

          const hasMarket = item.price_1d !== null || item.volume_ratio !== null;
          const pricePos  = (item.price_1d ?? 0) >= 0;

          return (
            <li key={item.id}>
              <Link
                href={`/disclosures/${item.id}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-800/30 transition group"
              >
                {/* Hot Score */}
                <div className="shrink-0 w-10 text-center">
                  <span className="text-lg font-black tabular-nums text-[#00D4A6]">
                    {item.hot_score.toFixed(0)}
                  </span>
                  <p className={`text-[9px] leading-none mt-0.5 ${gc}`}>
                    E{item.e_score}
                  </p>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm text-white font-medium truncate leading-tight">
                      {item.corp_name}
                    </span>
                    <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider ${ec}`}>
                      {EVENT_LABELS[item.event_type] ?? 'Event'}
                    </span>
                  </div>
                  {hasMarket ? (
                    <div className="flex items-center gap-1.5 text-[10px]">
                      {item.price_1d !== null && (
                        <span className={`font-semibold tabular-nums ${pricePos ? 'text-[#00D4A6]' : 'text-red-400'}`}>
                          {pricePos ? '+' : ''}{item.price_1d.toFixed(1)}%
                        </span>
                      )}
                      {item.price_1d !== null && item.volume_ratio !== null && (
                        <span className="text-gray-700">·</span>
                      )}
                      {item.volume_ratio !== null && (
                        <span className="text-gray-500">{item.volume_ratio.toFixed(1)}x vol</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 truncate">{oneLiner}</p>
                  )}
                </div>

                {/* Arrow */}
                <span className="text-gray-700 group-hover:text-gray-400 transition text-sm">›</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
