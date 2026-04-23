/**
 * HotStocksWidget — 대시보드용 컴팩트 Hot Stocks 리스트 (Server Component)
 * Top 5, E_score 기반 정렬
 */

import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';

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

interface WidgetItem {
  id: string;
  corp_name: string;
  stock_code: string;
  event_type: string;
  e_score: number;
  signal_grade: string | null;
  headline: string | null;
  median_return: number | null;
}

async function fetchItems(): Promise<WidgetItem[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createServiceClient() as any;

    const { data: statsRows } = await sb
      .from('event_stats')
      .select('event_type, signal_score, signal_grade, sample_size_clean, median_5d_return');

    const eventMap = new Map<string, { e_score: number; grade: string | null; median_return: number | null; sample_size: number }>();
    for (const row of statsRows ?? []) {
      eventMap.set(row.event_type as string, {
        e_score: Math.round((row.signal_score ?? 0) * 0.3),
        grade: row.signal_grade ?? null,
        median_return: row.median_5d_return ?? null,
        sample_size: row.sample_size_clean ?? 0,
      });
    }

    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows } = await sb
      .from('disclosure_insights')
      .select('id, corp_name, stock_code, event_type, headline, final_score')
      .eq('analysis_status', 'completed')
      .eq('is_visible', true)
      .gte('created_at', since)
      .not('event_type', 'is', null)
      .order('final_score', { ascending: false })
      .limit(200);

    if (!rows?.length) return [];

    const tryPick = (minSample: number, minE: number): WidgetItem[] => {
      const seen = new Set<string>();
      const out: WidgetItem[] = [];
      for (const row of rows) {
        const et = (row.event_type ?? '').toUpperCase();
        const meta = eventMap.get(et);
        if (!meta || meta.sample_size < minSample || meta.e_score < minE) continue;
        if (seen.has(row.stock_code)) continue;
        seen.add(row.stock_code);
        out.push({ id: row.id, corp_name: row.corp_name, stock_code: row.stock_code, event_type: et, e_score: meta.e_score, signal_grade: meta.grade, headline: row.headline ?? null, median_return: meta.median_return });
        if (out.length >= 5) break;
      }
      return out.sort((a, b) => b.e_score - a.e_score);
    };

    const strict = tryPick(50, 20);
    return strict.length >= 2 ? strict : tryPick(30, 15);
  } catch {
    return [];
  }
}

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
          const ec = EVENT_COLORS[item.event_type] ?? EVENT_COLORS.OTHER;
          const gc = GRADE_COLORS[item.signal_grade ?? 'C'] ?? GRADE_COLORS.C;
          const ret = item.median_return;
          const oneLiner = item.headline
            ?? (ret !== null
              ? `${ret >= 0 ? '+' : ''}${ret.toFixed(1)}% avg return (5d)`
              : `E score ${item.e_score}/30`);

          return (
            <li key={item.id}>
              <Link
                href={`/disclosures/${item.id}`}
                className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-800/30 transition group"
              >
                {/* E score */}
                <div className="shrink-0 w-10 text-center">
                  <span className={`text-lg font-black tabular-nums ${gc}`}>{item.e_score}</span>
                  <p className="text-[9px] text-gray-600 leading-none">/ 30</p>
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
                  <p className="text-xs text-gray-500 truncate">{oneLiner}</p>
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
