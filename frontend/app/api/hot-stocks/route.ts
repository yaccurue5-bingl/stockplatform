/**
 * GET /api/hot-stocks — v1.1
 * ==========================
 * Hot_score = E_score × M_score × F_adj
 *
 * E_score = percentileRank(signal_score) × 30         — 상위 ~28% ≥ 20
 * M_score = 1 + 0.5 × tanh(z(foreign_net_buy_kospi))  — market-wide [0.5, 1.5], smooth
 *   z = (today_flow − mean_20d) / std_20d
 * F_adj   = 0.6×vol_pct + 0.4×fin_pct                 — [0, 1] per-stock
 *   vol_pct = cross-sectional percentile(volume_ratio, pool)
 *   fin_pct = f_score/100  (null → 0.5 fallback)
 *
 * 필터:
 *   ① E_adj ≥ 20  (sample_size 보정 후)
 *   ② volume_ratio ≥ 1.5
 *   ③ Hot_score ≥ 15  (최종 노이즈 제거)
 *
 * 라벨:
 *   Breakout    E_adj≥22 + M_score≥1.4
 *   Re-rating   E_adj≥22 + f_score≥65
 *   Quality     f_score≥70
 *   Momentum    M_score≥1.3
 *   Event Driven 그 외
 *
 * Hot_score 티어: Strong≥30 / Watch≥20 / Weak≥15
 * 캐시: 15분 (s-maxage=900)
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

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
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

/**
 * percentileRank — signal_score를 0~1 백분위로 변환
 * E_score = percentileRank × 30  →  [0, 30]
 * 이벤트 타입 수가 적어도 안정적으로 동작 (tie 처리: mid-rank)
 */
function percentileRank(score: number, sortedScores: number[]): number {
  const n = sortedScores.length
  if (n === 0) return 0.5
  const below = sortedScores.filter(v => v < score).length
  const equal = sortedScores.filter(v => v === score).length
  return (below + 0.5 * equal) / n
}

function tradingDaysAfter(baseDateStr: string, offset: number): string {
  const y = parseInt(baseDateStr.slice(0, 4))
  const m = parseInt(baseDateStr.slice(4, 6)) - 1
  const d = parseInt(baseDateStr.slice(6, 8))
  const dt = new Date(y, m, d)
  let added = 0
  while (added < offset) {
    dt.setDate(dt.getDate() + 1)
    const dow = dt.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return dt.toISOString().slice(0, 10)
}

type LabelType = 'BREAKOUT' | 'RE_RATING' | 'QUALITY' | 'MOMENTUM' | 'EVENT_DRIVEN'

// M_score는 이제 clip [0.5, 1.5] 범위
function computeLabel(e_adj: number, m_score: number, f_score: number | null): LabelType {
  if (e_adj >= 22 && m_score >= 1.4)        return 'BREAKOUT'   // strong momentum confirm
  if (e_adj >= 22 && (f_score ?? 0) >= 65) return 'RE_RATING'
  if ((f_score ?? 0) >= 70)                return 'QUALITY'
  if (m_score >= 1.3)                       return 'MOMENTUM'   // above neutral
  return 'EVENT_DRIVEN'
}

type HotTier = 'STRONG' | 'WATCH' | 'WEAK'
function hotTier(score: number): HotTier {
  if (score >= 30) return 'STRONG'
  if (score >= 20) return 'WATCH'
  return 'WEAK'
}

const LABEL_TEXT: Record<LabelType, string> = {
  BREAKOUT:     'Breakout',
  RE_RATING:    'Re-rating',
  QUALITY:      'Quality',
  MOMENTUM:     'Momentum',
  EVENT_DRIVEN: 'Event Driven',
}

// ── 메인 핸들러 ───────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createServiceClient() as any

    // ── 1. event_stats ────────────────────────────────────────────────────────
    const { data: statsRows, error: e1 } = await sb
      .from('event_stats')
      .select('event_type, signal_score, signal_grade, sample_size_clean, median_5d_return')

    if (e1) throw e1

    type EventMeta = {
      e_score: number
      grade: string | null
      median_return: number | null
      sample_size: number
    }

    // percentile 기반 E_score: signal_score를 이벤트 타입 간 상대 순위로 변환
    // E_score = percentile(0~1) × 30 → [0, 30]
    // threshold 20 시 상위 ~28% 통과 (현재 7개 타입: CONTRACT/DILUTION만 통과)
    const allSignalScores = (statsRows ?? [])
      .map((r: { signal_score: number | null }) => r.signal_score ?? 0)
      .sort((a: number, b: number) => a - b)

    const eventMap = new Map<string, EventMeta>()
    for (const row of statsRows ?? []) {
      const pct     = percentileRank(row.signal_score ?? 0, allSignalScores)
      const e_score = Math.round(pct * 30 * 10) / 10
      eventMap.set(row.event_type as string, {
        e_score,
        grade:         row.signal_grade ?? null,
        median_return: row.median_5d_return ?? null,
        sample_size:   row.sample_size_clean ?? 0,
      })
    }

    // ── 2. 최근 공시 (3일) ────────────────────────────────────────────────────
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

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
      .limit(300)

    if (e2) throw e2
    if (!discRows?.length) {
      return NextResponse.json([], {
        headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=1800' },
      })
    }

    // ── 3. 1차 필터: sample_size ≥ 50, E_score ≥ 20 (보정 전 기준) ───────────
    type DiscRow = {
      id: string; corp_name: string; stock_code: string; event_type: string
      headline: string | null; signal_tag: string | null
      final_score: number | null; sentiment_score: number | null
      rcept_dt: string; created_at: string
    }

    const qualify = (rows: DiscRow[], minSample: number, minE: number): DiscRow[] =>
      rows.filter(r => {
        const et = (r.event_type ?? '').toUpperCase()
        const meta = eventMap.get(et)
        return meta && meta.sample_size >= minSample && meta.e_score >= minE
      })

    const strict = qualify(discRows as DiscRow[], 50, 20)
    const pool   = strict.length >= 3 ? strict : qualify(discRows as DiscRow[], 30, 10)

    if (!pool.length) {
      return NextResponse.json([], {
        headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=1800' },
      })
    }

    // ── 4. price_history ─────────────────────────────────────────────────────
    const stockCodes = [...new Set(pool.map(r => r.stock_code).filter(Boolean))]

    const d1DateMap = new Map<string, string>()
    for (const row of pool) {
      if (!d1DateMap.has(row.stock_code) && row.rcept_dt) {
        d1DateMap.set(row.stock_code, tradingDaysAfter(String(row.rcept_dt), 1))
      }
    }

    const minDate = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10)

    const { data: priceRows, error: e3 } = await sb
      .from('price_history')
      .select('stock_code, date, open, close, volume')
      .in('stock_code', stockCodes)
      .gte('date', minDate)
      .order('date', { ascending: false })

    if (e3) throw e3

    type PriceEntry = { open: number | null; close: number | null; volume: number | null }
    const priceIndex = new Map<string, Map<string, PriceEntry>>()
    for (const p of (priceRows ?? []) as Array<{
      stock_code: string; date: string
      open: number | null; close: number | null; volume: number | null
    }>) {
      if (!priceIndex.has(p.stock_code)) priceIndex.set(p.stock_code, new Map())
      priceIndex.get(p.stock_code)!.set(p.date, { open: p.open, close: p.close, volume: p.volume })
    }

    // ── 5. financials (f_score) ──────────────────────────────────────────────
    const { data: finRows } = await sb
      .from('financials')
      .select('stock_code, fiscal_year, f_score')
      .in('stock_code', stockCodes)
      .order('fiscal_year', { ascending: false })

    const finMap = new Map<string, number | null>()
    for (const f of (finRows ?? []) as Array<{
      stock_code: string; fiscal_year: number; f_score: number | null
    }>) {
      if (!finMap.has(f.stock_code)) finMap.set(f.stock_code, f.f_score ?? null)
    }

    // ── 7. 시장 외국인 수급 → M_score (market-wide, tanh) ────────────────────
    const { data: flowRows } = await sb
      .from('daily_indicators')
      .select('date, foreign_net_buy_kospi')
      .order('date', { ascending: false })
      .limit(25)

    const flowVals  = (flowRows ?? [])
      .map((r: { foreign_net_buy_kospi: number | null }) => r.foreign_net_buy_kospi ?? 0)
    const todayFlow = flowVals[0] ?? 0
    const flowMean  = flowVals.length > 0
      ? flowVals.reduce((s: number, v: number) => s + v, 0) / flowVals.length
      : 0
    const flowStd   = flowVals.length > 1
      ? Math.sqrt(flowVals.reduce((s: number, v: number) => s + (v - flowMean) ** 2, 0) / flowVals.length)
      : 1
    const z_flow    = flowStd > 0 ? (todayFlow - flowMean) / flowStd : 0
    // M_score: 하락장→0.5~0.8, 중립→1.0, 상승장→1.2~1.5 (tanh, 극단값도 부드럽게)
    const m_score   = 1 + 0.5 * Math.tanh(z_flow)

    // ── 8. 후보 수집 (Pass 1) — E/volume 필터 ────────────────────────────────
    type CandidateState = {
      row: DiscRow; e_adj: number; price_1d: number | null
      volume_ratio: number | null; f_score_val: number | null
    }

    const seen       = new Set<string>()
    const candidates: CandidateState[] = []

    for (const row of pool) {
      if (seen.has(row.stock_code)) continue

      const et   = (row.event_type ?? '').toUpperCase()
      const meta = eventMap.get(et)
      if (!meta) continue

      // ① E_adj ≥ 20
      const e_adj = meta.e_score * (meta.sample_size < 100 ? 0.7 : 1.0)
      if (e_adj < 20) continue

      // price_1d, volume_ratio
      const stockPrices = priceIndex.get(row.stock_code)
      const d1Date = d1DateMap.get(row.stock_code)
      const d1     = d1Date ? stockPrices?.get(d1Date) : null

      let price_1d: number | null = null
      if (d1?.close != null && d1?.open != null && d1.open > 0)
        price_1d = d1.close / d1.open - 1

      let volume_ratio: number | null = null
      if (stockPrices) {
        const recentVols = [...stockPrices.values()]
          .map(p => p.volume).filter((v): v is number => v !== null).slice(0, 20)
        if (recentVols.length >= 5 && d1?.volume != null) {
          const avg20 = recentVols.reduce((s, v) => s + v, 0) / recentVols.length
          volume_ratio = avg20 > 0 ? d1.volume / avg20 : null
        }
      }

      // ② volume_ratio ≥ 1.5
      if (volume_ratio !== null && volume_ratio < 1.5) continue

      seen.add(row.stock_code)
      candidates.push({
        row, e_adj, price_1d, volume_ratio,
        f_score_val: finMap.get(row.stock_code) ?? null,
      })
    }

    // ── 9. cross-sectional volume percentile (Pass 2) ────────────────────────
    const sortedVolRatios = candidates
      .map(c => c.volume_ratio ?? 0)
      .sort((a, b) => a - b)

    // ── 10. Hot_score 계산 (Pass 3) ──────────────────────────────────────────
    type Result = {
      id: string; corp_name: string; stock_code: string
      event_type: string; event_label: string
      label: string; label_type: LabelType; hot_tier: HotTier
      e_score: number; e_adj: number
      signal_grade: string | null; median_return: number | null
      headline: string | null; signal_tag: string | null
      final_score: number | null; sentiment_score: number | null
      price_1d: number | null; volume_ratio: number | null
      m_score: number; f_score: number | null; f_adj: number
      hot_score: number
    }

    const results: Result[] = []

    for (const c of candidates) {
      const { row, e_adj, price_1d, volume_ratio, f_score_val } = c
      const et   = (row.event_type ?? '').toUpperCase()
      const meta = eventMap.get(et)!

      // F_adj = 0.6×vol_pct + 0.4×fin_pct  (M_score는 market-wide로 분리)
      const vol_pct = percentileRank(volume_ratio ?? 0, sortedVolRatios)
      const fin_pct = f_score_val !== null ? f_score_val / 100 : 0.5
      const f_adj   = 0.6 * vol_pct + 0.4 * fin_pct

      // Hot_score = E × M × F
      const hot_score = Math.round(e_adj * m_score * f_adj * 10) / 10

      // ③ Hot_score ≥ 15
      if (hot_score < 15) continue

      const label_type = computeLabel(e_adj, m_score, f_score_val)

      results.push({
        id:             row.id,
        corp_name:      row.corp_name,
        stock_code:     row.stock_code,
        event_type:     et,
        event_label:    EVENT_LABELS[et] ?? EVENT_LABELS.OTHER,
        label:          LABEL_TEXT[label_type],
        label_type,
        hot_tier:       hotTier(hot_score),
        e_score:        meta.e_score,
        e_adj:          Math.round(e_adj * 10) / 10,
        signal_grade:   meta.grade,
        median_return:  meta.median_return,
        headline:       row.headline ?? null,
        signal_tag:     row.signal_tag ?? null,
        final_score:    row.final_score ?? null,
        sentiment_score: row.sentiment_score ?? null,
        price_1d:       price_1d !== null ? Math.round(price_1d * 10000) / 100 : null,
        volume_ratio:   volume_ratio !== null ? Math.round(volume_ratio * 10) / 10 : null,
        m_score:        Math.round(m_score * 100) / 100,
        f_score:        f_score_val !== null ? Math.round(f_score_val) : null,
        f_adj:          Math.round(f_adj * 100) / 100,
        hot_score,
      })

      if (results.length >= 20) break
    }

    results.sort((a, b) => b.hot_score - a.hot_score || b.e_adj - a.e_adj)

    return NextResponse.json(results.slice(0, 10), {
      headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=1800' },
    })
  } catch (err) {
    console.error('[hot-stocks] error:', err)
    return NextResponse.json([], { status: 500 })
  }
}
