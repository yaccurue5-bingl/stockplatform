/**
 * HotStocks — 랜딩 섹션 (Server Component)
 *
 * Hot Score = E_score × sigmoid(M_score) 기반 Top 8 종목.
 * M_score = 0.6 × price_z + 0.4 × volume_z
 *
 * 필터:
 *   E_score ≥ 20, sample_size ≥ 50, volume_ratio ≥ 1.5
 * Fallback (< 3건):
 *   E_score ≥ 15, sample_size ≥ 30
 */

import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';

// ── 상수 ─────────────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  EARNINGS:         'Earnings',
  CONTRACT:         'Major Contract',
  DILUTION:         'Dilution',
  BUYBACK:          'Buyback',
  MNA:              'M&A',
  LEGAL:            'Legal',
  CAPEX:            'Capex',
  EXECUTIVE_CHANGE: 'Executive Change',
  OTHER:            'Disclosure',
};

const EVENT_COLORS: Record<string, string> = {
  EARNINGS:         'bg-blue-400/10 text-blue-400 border-blue-400/20',
  CONTRACT:         'bg-emerald-400/10 text-emerald-400 border-emerald-400/20',
  DILUTION:         'bg-orange-400/10 text-orange-400 border-orange-400/20',
  BUYBACK:          'bg-purple-400/10 text-purple-400 border-purple-400/20',
  MNA:              'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
  LEGAL:            'bg-red-400/10 text-red-400 border-red-400/20',
  CAPEX:            'bg-cyan-400/10 text-cyan-400 border-cyan-400/20',
  EXECUTIVE_CHANGE: 'bg-pink-400/10 text-pink-400 border-pink-400/20',
  OTHER:            'bg-gray-400/10 text-gray-400 border-gray-400/20',
};

const GRADE_COLORS: Record<string, string> = {
  A: 'text-[#00D4A6]',
  B: 'text-blue-400',
  C: 'text-yellow-400',
  D: 'text-orange-400',
  F: 'text-red-400',
};

// 시총 버킷별 일일 변동성 시그마
const CAP_SIGMA: Record<string, number> = {
  LARGE: 0.015,
  MID:   0.025,
  SMALL: 0.040,
};
const CAP_LARGE = 245_000_000_000;
const CAP_MID   =  65_000_000_000;

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

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

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface HotStockItem {
  id: string;
  corp_name: string;
  stock_code: string;
  event_type: string;
  event_label: string;
  e_score: number;
  signal_grade: string | null;
  median_return: number | null;
  headline: string | null;
  signal_tag: string | null;
  final_score: number | null;
  sentiment_score: number | null;
  price_1d: number | null;      // % (already ×100)
  volume_ratio: number | null;
  hot_score: number;
}

// ── 데이터 페칭 ───────────────────────────────────────────────────────────────

async function fetchHotStocks(): Promise<HotStockItem[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createServiceClient() as any;

    // ── 1. event_stats ────────────────────────────────────────────────────────
    const { data: statsRows, error: e1 } = await sb
      .from('event_stats')
      .select('event_type, signal_score, signal_grade, sample_size_clean, median_5d_return');

    if (e1) throw e1;

    type EventMeta = {
      e_score: number;
      grade: string | null;
      median_return: number | null;
      sample_size: number;
    };
    const eventMap = new Map<string, EventMeta>();
    for (const row of statsRows ?? []) {
      eventMap.set(row.event_type as string, {
        e_score: Math.round((row.signal_score ?? 0) * 0.3),
        grade:         row.signal_grade ?? null,
        median_return: row.median_5d_return ?? null,
        sample_size:   row.sample_size_clean ?? 0,
      });
    }

    // ── 2. 최근 3일 공시 ──────────────────────────────────────────────────────
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: discRows, error: e2 } = await sb
      .from('disclosure_insights')
      .select(
        'id, corp_name, stock_code, event_type, headline, signal_tag, ' +
        'final_score, sentiment_score, rcept_dt, created_at'
      )
      .eq('analysis_status', 'completed')
      .eq('is_visible', true)
      .gte('created_at', since)
      .not('event_type', 'is', null)
      .order('final_score', { ascending: false })
      .limit(300);

    if (e2) throw e2;
    if (!discRows?.length) return [];

    type DiscRow = {
      id: string; corp_name: string; stock_code: string; event_type: string;
      headline: string | null; signal_tag: string | null;
      final_score: number | null; sentiment_score: number | null;
      rcept_dt: string; created_at: string;
    };

    // ── 3. 1차 필터 ──────────────────────────────────────────────────────────
    const qualify = (rows: DiscRow[], minSample: number, minE: number) =>
      rows.filter(r => {
        const et = (r.event_type ?? '').toUpperCase();
        const meta = eventMap.get(et);
        return meta && meta.sample_size >= minSample && meta.e_score >= minE;
      });

    const strict = qualify(discRows as DiscRow[], 50, 20);
    const pool   = strict.length >= 3 ? strict : qualify(discRows as DiscRow[], 30, 15);
    if (!pool.length) return [];

    // ── 4. price_history 조회 ────────────────────────────────────────────────
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

    // ── 5. 시총 조회 ─────────────────────────────────────────────────────────
    const { data: capRows } = await sb
      .from('companies')
      .select('stock_code, market_cap')
      .in('stock_code', stockCodes);

    const capMap = new Map<string, number | null>(
      ((capRows ?? []) as Array<{ stock_code: string; market_cap: number | null }>)
        .map(r => [r.stock_code, r.market_cap])
    );

    // ── 6. M_score + Hot_score 계산 ──────────────────────────────────────────
    const seen = new Set<string>();
    const results: HotStockItem[] = [];

    for (const row of pool) {
      if (seen.has(row.stock_code)) continue;

      const et   = (row.event_type ?? '').toUpperCase();
      const meta = eventMap.get(et)!;

      const stockPrices = priceIndex.get(row.stock_code);
      const d1Date = d1DateMap.get(row.stock_code);
      const d1     = d1Date ? stockPrices?.get(d1Date) : null;

      // price_1d = D+1 close / D+1 open - 1
      let price_1d: number | null = null;
      if (d1?.close != null && d1?.open != null && d1.open > 0) {
        price_1d = d1.close / d1.open - 1;
      }

      // volume_ratio = D+1 volume / avg_20d_volume
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

      // 거래량 필터 (데이터 있을 때만 적용)
      if (volume_ratio !== null && volume_ratio < 1.5) continue;

      // M_score
      const bucket   = capBucket(capMap.get(row.stock_code) ?? null);
      const sigma    = CAP_SIGMA[bucket];
      const price_z  = price_1d !== null ? price_1d / sigma : 0;
      const volume_z = volume_ratio !== null ? (volume_ratio - 1.0) / 0.5 : 0;
      const m_score  = 0.6 * price_z + 0.4 * volume_z;
      const hot_score = Math.round(meta.e_score * sigmoid(m_score) * 10) / 10;

      seen.add(row.stock_code);
      results.push({
        id:             row.id,
        corp_name:      row.corp_name,
        stock_code:     row.stock_code,
        event_type:     et,
        event_label:    EVENT_LABELS[et] ?? EVENT_LABELS.OTHER,
        e_score:        meta.e_score,
        signal_grade:   meta.grade,
        median_return:  meta.median_return,
        headline:       row.headline ?? null,
        signal_tag:     row.signal_tag ?? null,
        final_score:    row.final_score ?? null,
        sentiment_score: row.sentiment_score ?? null,
        price_1d:       price_1d !== null ? Math.round(price_1d * 10000) / 100 : null,
        volume_ratio:   volume_ratio !== null ? Math.round(volume_ratio * 10) / 10 : null,
        hot_score,
      });

      if (results.length >= 16) break; // 정렬 후 8개 컷
    }

    results.sort((a, b) => b.hot_score - a.hot_score || b.e_score - a.e_score);
    return results.slice(0, 8);
  } catch (err) {
    console.error('[HotStocks] fetch error:', err);
    return [];
  }
}

// ── 헬퍼 (UI) ────────────────────────────────────────────────────────────────

function buildOneLiner(item: HotStockItem): string {
  if (item.headline) return item.headline;

  const ret    = item.median_return;
  const retStr = ret !== null
    ? `${ret >= 0 ? '+' : ''}${ret.toFixed(1)}% avg return (5d)`
    : null;

  const grade = item.signal_grade;
  if (grade === 'A') return retStr ? `Top-tier signal · ${retStr}` : 'Top-tier historical signal';
  if (grade === 'B') return retStr ? `Strong signal · ${retStr}` : 'Strong historical signal';
  if (grade === 'C') return retStr ? `Moderate signal · ${retStr}` : 'Moderate historical signal';
  return retStr ? `E score ${item.e_score}/30 · ${retStr}` : `E score ${item.e_score}/30`;
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export default async function HotStocks() {
  const items = await fetchHotStocks();

  if (!items.length) return null;

  return (
    <section className="py-20 px-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00D4A6]/10 border border-[#00D4A6]/20 text-[#00D4A6] text-xs font-semibold uppercase tracking-widest mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00D4A6] animate-pulse" />
            Event Intelligence
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white leading-tight">
            High-Signal Events
          </h2>
          <p className="mt-2 text-gray-400 text-sm max-w-lg">
            Events with strong historical precedent <em>and</em> live market confirmation.
            Hot Score = Event Quality × Market Signal.
          </p>
        </div>
        <Link
          href="/disclosures"
          className="hidden md:inline-flex items-center gap-1.5 text-sm text-[#00D4A6] hover:text-white transition font-medium"
        >
          View all signals →
        </Link>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((item) => {
          const eventColor = EVENT_COLORS[item.event_type] ?? EVENT_COLORS.OTHER;
          const gradeColor = GRADE_COLORS[item.signal_grade ?? 'C'] ?? GRADE_COLORS.C;
          const oneLiner   = buildOneLiner(item);
          const barPct     = Math.round((item.e_score / 30) * 100);
          const sentPos    = (item.sentiment_score ?? 0) >= 0.3;
          const sentNeg    = (item.sentiment_score ?? 0) <= -0.3;

          const hasMarket  = item.price_1d !== null || item.volume_ratio !== null;
          const pricePos   = (item.price_1d ?? 0) >= 0;

          return (
            <Link
              key={item.id}
              href={`/disclosures/${item.id}`}
              className="group block bg-[#0d1117] border border-gray-800 hover:border-gray-600 rounded-xl p-5 transition-all hover:bg-gray-900/60"
            >
              {/* Company + Event badge */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate leading-tight">
                    {item.corp_name}
                  </p>
                  <p className="text-xs text-gray-500 font-mono mt-0.5">{item.stock_code}</p>
                </div>
                <span
                  className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold uppercase tracking-wider ${eventColor}`}
                >
                  {item.event_label}
                </span>
              </div>

              {/* Scores row */}
              <div className="flex items-end justify-between mb-2">
                <div>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block mb-1">
                    E Score
                  </span>
                  <span className={`text-lg font-black tabular-nums ${gradeColor}`}>
                    {item.e_score}
                    <span className="text-xs text-gray-600 font-normal">/30</span>
                  </span>
                </div>
                {/* Hot Score badge */}
                <div className="text-right">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold block mb-1">
                    Hot
                  </span>
                  <span className="text-lg font-black tabular-nums text-[#00D4A6]">
                    {item.hot_score.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* E score bar */}
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all ${gradeColor.replace('text-', 'bg-')}`}
                  style={{ width: `${barPct}%` }}
                />
              </div>

              {/* Market Signal row */}
              {hasMarket && (
                <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded-lg bg-gray-900/60 border border-gray-800/60">
                  {item.price_1d !== null && (
                    <span className={`text-xs font-semibold tabular-nums ${pricePos ? 'text-[#00D4A6]' : 'text-red-400'}`}>
                      {pricePos ? '+' : ''}{item.price_1d.toFixed(1)}%
                    </span>
                  )}
                  {item.price_1d !== null && item.volume_ratio !== null && (
                    <span className="text-gray-700 text-xs">·</span>
                  )}
                  {item.volume_ratio !== null && (
                    <span className="text-xs text-gray-400 font-medium">
                      거래량 {item.volume_ratio.toFixed(1)}x
                    </span>
                  )}
                </div>
              )}

              {/* One-liner */}
              <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">{oneLiner}</p>

              {/* Sentiment dot */}
              <div className="mt-3 flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    sentPos ? 'bg-[#00D4A6]' : sentNeg ? 'bg-red-400' : 'bg-gray-600'
                  }`}
                />
                <span className="text-[10px] text-gray-600">
                  {sentPos ? 'Bullish signal' : sentNeg ? 'Bearish signal' : 'Neutral signal'}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Mobile CTA */}
      <div className="mt-6 text-center md:hidden">
        <Link
          href="/disclosures"
          className="inline-flex items-center gap-1.5 text-sm text-[#00D4A6] hover:text-white transition font-medium"
        >
          View all signals →
        </Link>
      </div>
    </section>
  );
}
