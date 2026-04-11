/**
 * fetchSectorContext
 * ==================
 * Server-side helper: given a sector string, returns
 * 30-day disclosure stats + latest MOTIE export data.
 *
 * Used by /signal/[id] and /disclosures/[id] to power SectorContextCard.
 */

import { createServiceClient } from '@/lib/supabase/server';
import type { SectorContextData } from '@/components/SectorContextCard';

export async function fetchSectorContext(
  sector: string
): Promise<SectorContextData | null> {
  if (!sector) return null;

  try {
    const sb = createServiceClient();

    // ── 30-day disclosure stats ───────────────────────────────────────────────
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().slice(0, 10).replace(/-/g, '');

    const { data: discRows, error: discErr } = await (sb as any)
      .from('disclosure_insights')
      .select('sentiment_score')
      .eq('sector', sector)
      .eq('analysis_status', 'completed')
      .gte('rcept_dt', sinceStr);

    if (discErr) throw discErr;

    const rows = (discRows ?? []) as Array<{ sentiment_score: number | null }>;
    const total    = rows.length;
    const positive = rows.filter(r => (r.sentiment_score ?? 0) >= 0.3).length;
    const negative = rows.filter(r => (r.sentiment_score ?? 0) <= -0.3).length;
    const neutral  = total - positive - negative;

    const positiveRate = total > 0 ? positive / total : 0;
    const negativeRate = total > 0 ? negative / total : 0;
    const disclosure_signal: 'Bullish' | 'Bearish' | 'Neutral' =
      positiveRate > 0.5   ? 'Bullish'
      : negativeRate > 0.5 ? 'Bearish'
      : 'Neutral';
    const disclosure_confidence =
      total > 0 ? Math.max(positiveRate, negativeRate, 1 - positiveRate - negativeRate + 0.33) : 0;

    // ── Latest MOTIE export data ──────────────────────────────────────────────
    const { data: macroRow, error: macroErr } = await (sb as any)
      .from('sector_macro')
      .select('export_yoy, signal, report_date')
      .eq('sector', sector)
      .order('report_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (macroErr) console.warn('[fetchSectorContext] sector_macro error:', macroErr);

    return {
      sector,
      disclosures_total:    total,
      disclosures_positive: positive,
      disclosures_negative: negative,
      disclosures_neutral:  neutral,
      disclosure_signal,
      disclosure_confidence,
      export_yoy:         macroRow?.export_yoy   ?? null,
      export_signal:      macroRow?.signal        ?? null,
      export_report_date: macroRow?.report_date   ?? null,
    };
  } catch (e) {
    console.error('[fetchSectorContext] error:', e);
    return null;
  }
}
