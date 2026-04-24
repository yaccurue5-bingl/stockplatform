/**
 * HotStocksWidget — 대시보드 컴팩트 Hot Stocks (Server Component, Top 5)
 * Hot_score = E_adj × sigmoid(max(0, M_score)) × F_adjustment
 */

import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase/server'

const EVENT_LABELS: Record<string, string> = {
  EARNINGS: 'Earnings', CONTRACT: 'Contract', DILUTION: 'Dilution',
  BUYBACK: 'Buyback', MNA: 'M&A', LEGAL: 'Legal', CAPEX: 'Capex',
  EXECUTIVE_CHANGE: 'Executive', OTHER: 'Disclosure',
}
const EVENT_COLORS: Record<string, string> = {
  EARNINGS: 'bg-blue-400/10 text-blue-400', CONTRACT: 'bg-emerald-400/10 text-emerald-400',
  DILUTION: 'bg-orange-400/10 text-orange-400', BUYBACK: 'bg-purple-400/10 text-purple-400',
  MNA: 'bg-yellow-400/10 text-yellow-400', LEGAL: 'bg-red-400/10 text-red-400',
  CAPEX: 'bg-cyan-400/10 text-cyan-400', EXECUTIVE_CHANGE: 'bg-pink-400/10 text-pink-400',
  OTHER: 'bg-gray-400/10 text-gray-400',
}
const GRADE_COLORS: Record<string, string> = {
  A: 'text-[#00D4A6]', B: 'text-blue-400', C: 'text-yellow-400',
  D: 'text-orange-400', F: 'text-red-400',
}

type LabelType = 'BREAKOUT' | 'RE_RATING' | 'QUALITY' | 'MOMENTUM' | 'EVENT_DRIVEN'
const LABEL_CONFIG: Record<LabelType, { text: string; color: string }> = {
  BREAKOUT:     { text: 'Breakout',     color: 'text-[#00D4A6]' },
  RE_RATING:    { text: 'Re-rating',    color: 'text-purple-400' },
  QUALITY:      { text: 'Quality',      color: 'text-blue-400' },
  MOMENTUM:     { text: 'Momentum',     color: 'text-orange-400' },
  EVENT_DRIVEN: { text: 'Event',        color: 'text-gray-500' },
}

const CAP_SIGMA: Record<string, number> = { LARGE: 0.015, MID: 0.025, SMALL: 0.040 }
const CAP_LARGE = 245_000_000_000
const CAP_MID   =  65_000_000_000

function sigmoid(x: number) { return 1 / (1 + Math.exp(-x)) }
function capBucket(mc: number | null): 'LARGE' | 'MID' | 'SMALL' {
  if (!mc || mc <= 0) return 'SMALL'
  if (mc >= CAP_LARGE) return 'LARGE'
  if (mc >= CAP_MID)   return 'MID'
  return 'SMALL'
}
function tradingDaysAfter(base: string, offset: number): string {
  const dt = new Date(+base.slice(0, 4), +base.slice(4, 6) - 1, +base.slice(6, 8))
  let added = 0
  while (added < offset) { dt.setDate(dt.getDate() + 1); const d = dt.getDay(); if (d !== 0 && d !== 6) added++ }
  return dt.toISOString().slice(0, 10)
}
function computeLabel(e_adj: number, m_score: number, f_score: number | null): LabelType {
  if (e_adj >= 22 && m_score >= 1.5)       return 'BREAKOUT'
  if (e_adj >= 22 && (f_score ?? 0) >= 65) return 'RE_RATING'
  if ((f_score ?? 0) >= 70)                return 'QUALITY'
  if (m_score >= 2.0)                      return 'MOMENTUM'
  return 'EVENT_DRIVEN'
}

interface WidgetItem {
  id: string; corp_name: string; stock_code: string; event_type: string
  e_score: number; e_adj: number; signal_grade: string | null
  headline: string | null; median_return: number | null
  price_1d: number | null; volume_ratio: number | null; m_score: number
  f_score: number | null; hot_score: number; label_type: LabelType
}

async function fetchItems(): Promise<WidgetItem[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createServiceClient() as any

    const { data: statsRows } = await sb.from('event_stats')
      .select('event_type, signal_score, signal_grade, sample_size_clean, median_5d_return')

    type EventMeta = { e_score: number; grade: string | null; median_return: number | null; sample_size: number }
    const eventMap = new Map<string, EventMeta>()
    for (const row of statsRows ?? []) {
      eventMap.set(row.event_type as string, {
        e_score: Math.round((row.signal_score ?? 0) * 0.3),
        grade: row.signal_grade ?? null, median_return: row.median_5d_return ?? null,
        sample_size: row.sample_size_clean ?? 0,
      })
    }

    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    const { data: discRows } = await sb.from('disclosure_insights')
      .select('id, corp_name, stock_code, event_type, headline, final_score, rcept_dt')
      .eq('analysis_status', 'completed').eq('is_visible', true)
      .gte('created_at', since).not('event_type', 'is', null)
      .order('final_score', { ascending: false }).limit(200)

    if (!discRows?.length) return []

    type DiscRow = { id: string; corp_name: string; stock_code: string; event_type: string; headline: string | null; final_score: number | null; rcept_dt: string }

    const qualify = (rows: DiscRow[], ms: number, me: number): DiscRow[] =>
      rows.filter(r => { const et = (r.event_type ?? '').toUpperCase(); const m = eventMap.get(et); return m && m.sample_size >= ms && m.e_score >= me })

    const strict = qualify(discRows as DiscRow[], 50, 15)
    const pool   = strict.length >= 2 ? strict : qualify(discRows as DiscRow[], 30, 10)
    if (!pool.length) return []

    const stockCodes = [...new Set(pool.map(r => r.stock_code).filter(Boolean))]
    const d1DateMap = new Map<string, string>()
    for (const r of pool) { if (!d1DateMap.has(r.stock_code) && r.rcept_dt) d1DateMap.set(r.stock_code, tradingDaysAfter(String(r.rcept_dt), 1)) }

    const minDate = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const { data: priceRows } = await sb.from('price_history').select('stock_code, date, open, close, volume')
      .in('stock_code', stockCodes).gte('date', minDate).order('date', { ascending: false })

    type PriceEntry = { open: number | null; close: number | null; volume: number | null }
    const priceIndex = new Map<string, Map<string, PriceEntry>>()
    for (const p of (priceRows ?? []) as Array<{ stock_code: string; date: string; open: number | null; close: number | null; volume: number | null }>) {
      if (!priceIndex.has(p.stock_code)) priceIndex.set(p.stock_code, new Map())
      priceIndex.get(p.stock_code)!.set(p.date, { open: p.open, close: p.close, volume: p.volume })
    }

    const { data: capRows } = await sb.from('companies').select('stock_code, market_cap').in('stock_code', stockCodes)
    const capMap = new Map<string, number | null>(((capRows ?? []) as Array<{ stock_code: string; market_cap: number | null }>).map(r => [r.stock_code, r.market_cap]))

    const { data: finRows } = await sb.from('financials').select('stock_code, f_score').in('stock_code', stockCodes).order('fiscal_year', { ascending: false })
    const finMap = new Map<string, number | null>()
    for (const f of (finRows ?? []) as Array<{ stock_code: string; f_score: number | null }>) {
      if (!finMap.has(f.stock_code)) finMap.set(f.stock_code, f.f_score ?? null)
    }

    const seen = new Set<string>()
    const results: WidgetItem[] = []

    for (const row of pool) {
      const et = (row.event_type ?? '').toUpperCase()
      const meta = eventMap.get(et); if (!meta) continue
      if (seen.has(row.stock_code)) continue

      const e_adj = meta.e_score * (meta.sample_size < 100 ? 0.7 : 1.0)
      if (e_adj < 15) continue

      const sp = priceIndex.get(row.stock_code)
      const d1 = d1DateMap.get(row.stock_code) ? sp?.get(d1DateMap.get(row.stock_code)!) : null
      let price_1d: number | null = null
      if (d1?.close != null && d1?.open != null && d1.open > 0) price_1d = d1.close / d1.open - 1

      let volume_ratio: number | null = null
      if (sp) {
        const vols = [...sp.values()].map(p => p.volume).filter((v): v is number => v !== null).slice(0, 20)
        if (vols.length >= 5 && d1?.volume != null) { const avg = vols.reduce((s, v) => s + v, 0) / vols.length; volume_ratio = avg > 0 ? d1.volume / avg : null }
      }
      if (volume_ratio !== null && volume_ratio < 1.5) continue

      const sigma = CAP_SIGMA[capBucket(capMap.get(row.stock_code) ?? null)]
      const m_score = 0.6 * (price_1d !== null ? price_1d / sigma : 0) + 0.4 * (volume_ratio !== null ? (volume_ratio - 1.0) / 0.5 : 0)
      if (m_score <= 0) continue

      const f_score_val = finMap.get(row.stock_code) ?? null
      let f_adj: number
      if (f_score_val === null) { f_adj = 0.6 }
      else if (f_score_val < 20) { continue }
      else { f_adj = 0.5 + f_score_val / 200 }

      const hot_score = Math.round(e_adj * sigmoid(m_score) * f_adj * 10) / 10
      seen.add(row.stock_code)
      results.push({
        id: row.id, corp_name: row.corp_name, stock_code: row.stock_code, event_type: et,
        e_score: meta.e_score, e_adj: Math.round(e_adj * 10) / 10,
        signal_grade: meta.grade, headline: row.headline ?? null, median_return: meta.median_return,
        price_1d: price_1d !== null ? Math.round(price_1d * 10000) / 100 : null,
        volume_ratio: volume_ratio !== null ? Math.round(volume_ratio * 10) / 10 : null,
        m_score: Math.round(m_score * 100) / 100,
        f_score: f_score_val !== null ? Math.round(f_score_val) : null,
        hot_score, label_type: computeLabel(e_adj, m_score, f_score_val),
      })
      if (results.length >= 10) break
    }

    results.sort((a, b) => b.hot_score - a.hot_score || b.e_adj - a.e_adj)
    return results.slice(0, 5)
  } catch { return [] }
}

export default async function HotStocksWidget() {
  const items = await fetchItems()
  if (!items.length) return null

  return (
    <div className="bg-[#0d1117] border border-gray-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00D4A6] animate-pulse" />
          <p className="text-sm font-semibold text-white">Event Intelligence</p>
        </div>
        <Link href="/disclosures" className="text-xs text-[#00D4A6] hover:underline">View all →</Link>
      </div>

      <ul className="divide-y divide-gray-800/60">
        {items.map((item) => {
          const ec  = EVENT_COLORS[item.event_type] ?? EVENT_COLORS.OTHER
          const gc  = GRADE_COLORS[item.signal_grade ?? 'C'] ?? GRADE_COLORS.C
          const lc  = LABEL_CONFIG[item.label_type]
          const ret = item.median_return
          const oneLiner = item.headline
            ?? (ret !== null ? `${ret >= 0 ? '+' : ''}${ret.toFixed(1)}% avg return (5d)` : `E ${item.e_adj}`)
          const hasMarket = item.price_1d !== null || item.volume_ratio !== null
          const pricePos  = (item.price_1d ?? 0) >= 0

          return (
            <li key={item.id}>
              <Link href={`/disclosures/${item.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-800/30 transition group">
                {/* Hot Score + E_adj */}
                <div className="shrink-0 w-12 text-center">
                  <span className="text-lg font-black tabular-nums text-[#00D4A6]">{item.hot_score.toFixed(0)}</span>
                  <p className={`text-[9px] leading-none mt-0.5 ${gc}`}>E{item.e_adj.toFixed(0)}</p>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm text-white font-medium truncate leading-tight">{item.corp_name}</span>
                    <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider ${ec}`}>
                      {EVENT_LABELS[item.event_type] ?? 'Event'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px]">
                    {hasMarket ? (
                      <>
                        {item.price_1d !== null && (
                          <span className={`font-semibold tabular-nums ${pricePos ? 'text-[#00D4A6]' : 'text-red-400'}`}>
                            {pricePos ? '+' : ''}{item.price_1d.toFixed(1)}%
                          </span>
                        )}
                        {item.price_1d !== null && item.volume_ratio !== null && <span className="text-gray-700">·</span>}
                        {item.volume_ratio !== null && <span className="text-gray-500">{item.volume_ratio.toFixed(1)}x vol</span>}
                        {item.f_score !== null && <span className="text-gray-700">·</span>}
                        {item.f_score !== null && <span className="text-gray-500">F{item.f_score}</span>}
                      </>
                    ) : (
                      <span className="text-gray-500 truncate">{oneLiner}</span>
                    )}
                    <span className={`ml-auto shrink-0 ${lc.color} text-[9px] font-semibold`}>{lc.text}</span>
                  </div>
                </div>

                <span className="text-gray-700 group-hover:text-gray-400 transition text-sm">›</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
