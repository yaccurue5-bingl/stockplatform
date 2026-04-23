/**
 * HotStocks — 랜딩 섹션 (Server Component)
 *
 * 선정 기준:
 *   - 최근 3일 내 이벤트 발생 (disclosure_insights.created_at)
 *   - event_stats.sample_size_clean >= 50 (통계 신뢰 확보)
 *   - E_score = round(signal_score * 0.3) >= 20 (0-30 스케일)
 *   - 회사별 중복 제거 (최고 점수 1건)
 *   - 최대 8종목 (precision > recall)
 *
 * Fallback: 엄격 기준 < 3건 → sample_size >= 30, e_score >= 15 완화
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
}

// ── 데이터 페칭 ───────────────────────────────────────────────────────────────

async function fetchHotStocks(): Promise<HotStockItem[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createServiceClient() as any;

    // ── 1. event_stats 조회 ───────────────────────────────────────────────────
    const { data: statsRows, error: e1 } = await sb
      .from('event_stats')
      .select('event_type, signal_score, signal_grade, sample_size_clean, median_5d_return');

    if (e1) throw e1;

    // E_score(0-30) 계산 및 기준 충족 여부 판별
    type EventMeta = {
      e_score: number;
      grade: string | null;
      median_return: number | null;
      sample_size: number;
    };

    const eventMap = new Map<string, EventMeta>();
    for (const row of statsRows ?? []) {
      const e_score = Math.round((row.signal_score ?? 0) * 0.3);
      eventMap.set(row.event_type as string, {
        e_score,
        grade: row.signal_grade ?? null,
        median_return: row.median_5d_return ?? null,
        sample_size: row.sample_size_clean ?? 0,
      });
    }

    // ── 2. 최근 공시 조회 (최근 3일) ─────────────────────────────────────────
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const { data: rows, error: e2 } = await sb
      .from('disclosure_insights')
      .select(
        'id, corp_name, stock_code, event_type, headline, signal_tag, ' +
        'final_score, sentiment_score, created_at'
      )
      .eq('analysis_status', 'completed')
      .eq('is_visible', true)
      .gte('created_at', since)
      .not('event_type', 'is', null)
      .order('final_score', { ascending: false })
      .limit(300);

    if (e2) throw e2;
    if (!rows?.length) return [];

    // ── 3. 엄격 필터 (sample_size >= 50, e_score >= 20) ──────────────────────
    const pickItems = (minSample: number, minE: number): HotStockItem[] => {
      const seen = new Set<string>();
      const out: HotStockItem[] = [];

      for (const row of rows) {
        const et = (row.event_type ?? '').toUpperCase();
        const meta = eventMap.get(et);
        if (!meta) continue;
        if (meta.sample_size < minSample) continue;
        if (meta.e_score < minE) continue;
        if (seen.has(row.stock_code)) continue;
        seen.add(row.stock_code);

        out.push({
          id: row.id,
          corp_name: row.corp_name,
          stock_code: row.stock_code,
          event_type: et,
          event_label: EVENT_LABELS[et] ?? EVENT_LABELS.OTHER,
          e_score: meta.e_score,
          signal_grade: meta.grade,
          median_return: meta.median_return,
          headline: row.headline ?? null,
          signal_tag: row.signal_tag ?? null,
          final_score: row.final_score ?? null,
          sentiment_score: row.sentiment_score ?? null,
        });

        if (out.length >= 8) break;
      }
      // 정렬: e_score DESC → final_score DESC
      return out.sort(
        (a, b) => b.e_score - a.e_score || (b.final_score ?? 0) - (a.final_score ?? 0)
      );
    };

    const strict = pickItems(50, 20);
    if (strict.length >= 3) return strict;

    // Fallback: 완화 기준
    const relaxed = pickItems(30, 15);
    return relaxed;
  } catch (err) {
    console.error('[HotStocks] fetch error:', err);
    return [];
  }
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function buildOneLiner(item: HotStockItem): string {
  if (item.headline) return item.headline;

  const ret = item.median_return;
  const retStr =
    ret !== null
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

  if (!items.length) return null; // 데이터 없으면 섹션 자체 숨김

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
            Korean market events with strongest historical precedent.
            Curated by E score — not volume or price movement.
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

              {/* E score bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                    E Score
                  </span>
                  <span className={`text-lg font-black tabular-nums ${gradeColor}`}>
                    {item.e_score}
                    <span className="text-xs text-gray-600 font-normal">/30</span>
                  </span>
                </div>
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${gradeColor.replace('text-', 'bg-')}`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>

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
