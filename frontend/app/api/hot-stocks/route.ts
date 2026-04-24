/**
 * GET /api/hot-stocks
 * ===================
 * Hot_score = E_adj × sigmoid(max(0, M_score)) × F_adjustment
 *
 * E_adj   = E_score × (sample_size < 100 ? 0.7 : 1.0)
 * M_score = 0.6 × price_z + 0.4 × volume_z
 * M_sig   = sigmoid(max(0, M_score))  — 음수 M_score → 0 (탈락)
 * F_adj   = 0.5 + F_score/200         — F없으면 0.6 (약한 패널티), F<20 → 탈락
 *
 * 필터 순서:
 *   ① sample_size ≥ 50
 *   ② E_adj ≥ 15  (0.7 보정 후; signal_score max≈62 → ×0.3 구조상 20 불가)
 *   ③ volume_ratio ≥ 1.5
 *   ④ M_score > 0  (시장 반응 확인)
 *   ⑤ F_score ≥ 20 (데이터 있을 때만)
 *
 * 라벨 (우선순위):
 *   Breakout    E_adj≥22 + M_score≥1.5
 *   Re-rating   E_adj≥22 + F_score≥65
 *   Quality     F_score≥70
 *   Momentum    M_score≥2.0
 *   Event Driven 그 외
 *
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

const CAP_SIGMA: Record<string, number> = {
  LARGE: 0.015,
  MID:   0.025,
  SMALL: 0.040,
}
const CAP_LARGE = 245_000_000_000
const CAP_MID   =  65_000_000_000

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

function capBucket(marketCap: number | null): 'LARGE' | 'MID' | 'SMALL' {
  if (!marketCap || marketCap <= 0) return 'SMALL'
  if (marketCap >= CAP_LARGE) return 'LARGE'
  if (marketCap >= CAP_MID)   return 'MID'
  return 'SMALL'
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

function computeLabel(e_adj: number, m_score: number, f_score: number | null): LabelType {
  if (e_adj >= 22 && m_score >= 1.5)          return 'BREAKOUT'
  if (e_adj >= 22 && (f_score ?? 0) >= 65)    return 'RE_RATING'
  if ((f_score ?? 0) >= 70)                   return 'QUALITY'
  if (m_score >= 2.0)                          return 'MOMENTUM'
  return 'EVENT_DRIVEN'
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
    const eventMap = new Map<string, EventMeta>()
    for (const row of statsRows ?? []) {
      const e_score = Math.round((row.signal_score ?? 0) * 0.3)
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

    const strict = qualify(discRows as DiscRow[], 50, 15)
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

    // ── 5. 시총 (cap_bucket) ──────────────────────────────────────────────────
    const { data: capRows } = await sb
      .from('companies')
      .select('stock_code, market_cap')
      .in('stock_code', stockCodes)

    const capMap = new Map<string, number | null>(
      ((capRows ?? []) as Array<{ stock_code: string; market_cap: number | null }>)
        .map(r => [r.stock_code, r.market_cap])
    )

    // ── 6. financials (F_score) ───────────────────────────────────────────────
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

    // ── 7. EMF 계산 ──────────────────────────────────────────────────────────
    type Result = {
      id: string; corp_name: string; stock_code: string
      event_type: string; event_label: string
      label: string; label_type: LabelType
      e_score: number; e_adj: number
      signal_grade: string | null; median_return: number | null
      headline: string | null; signal_tag: string | null
      final_score: number | null; sentiment_score: number | null
      price_1d: number | null; volume_ratio: number | null
      m_score: number; f_score: number | null; f_adj: number
      hot_score: number
    }

    const seen = new Set<string>()
    const results: Result[] = []

    for (const row of pool) {
      if (seen.has(row.stock_code)) continue

      const et   = (row.event_type ?? '').toUpperCase()
      const meta = eventMap.get(et)!

      // ── E_adj (① sample_size 보정 → ② 15 필터) ──────────────────────────
      const e_adj = meta.e_score * (meta.sample_size < 100 ? 0.7 : 1.0)
      if (e_adj < 15) continue

      // ── M_score ──────────────────────────────────────────────────────────
      const stockPrices = priceIndex.get(row.stock_code)
      const d1Date = d1DateMap.get(row.stock_code)
      const d1     = d1Date ? stockPrices?.get(d1Date) : null

      let price_1d: number | null = null
      if (d1?.close != null && d1?.open != null && d1.open > 0) {
        price_1d = d1.close / d1.open - 1
      }

      let volume_ratio: number | null = null
      if (stockPrices) {
        const recentVols = [...stockPrices.values()]
          .map(p => p.volume)
          .filter((v): v is number => v !== null)
          .slice(0, 20)
        if (recentVols.length >= 5 && d1?.volume != null) {
          const avg20 = recentVols.reduce((s, v) => s + v, 0) / recentVols.length
          volume_ratio = avg20 > 0 ? d1.volume / avg20 : null
        }
      }

      // ③ volume_ratio ≥ 1.5 필터
      if (volume_ratio !== null && volume_ratio < 1.5) continue

      const bucket   = capBucket(capMap.get(row.stock_code) ?? null)
      const sigma    = CAP_SIGMA[bucket]
      const price_z  = price_1d !== null ? price_1d / sigma : 0
      const volume_z = volume_ratio !== null ? (volume_ratio - 1.0) / 0.5 : 0
      const m_score  = 0.6 * price_z + 0.4 * volume_z

      // ④ M_score > 0 필터 (시장 반응 없으면 탈락)
      if (m_score <= 0) continue
      const m_sig = sigmoid(m_score)

      // ── F_adj ────────────────────────────────────────────────────────────
      const f_score_val = finMap.get(row.stock_code) ?? null
      let f_adj: number

      if (f_score_val === null) {
        f_adj = 0.6  // fallback: 약한 패널티 (데이터 없음)
      } else if (f_score_val < 20) {
        continue     // ⑤ F_score < 20 탈락
      } else {
        f_adj = 0.5 + f_score_val / 200
      }

      // ── Hot_score ─────────────────────────────────────────────────────────
      const hot_score = Math.round(e_adj * m_sig * f_adj * 10) / 10

      // ── Label ─────────────────────────────────────────────────────────────
      const label_type = computeLabel(e_adj, m_score, f_score_val)

      seen.add(row.stock_code)
      results.push({
        id:             row.id,
        corp_name:      row.corp_name,
        stock_code:     row.stock_code,
        event_type:     et,
        event_label:    EVENT_LABELS[et] ?? EVENT_LABELS.OTHER,
        label:          LABEL_TEXT[label_type],
        label_type,
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
