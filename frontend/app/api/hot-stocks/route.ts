/**
 * GET /api/hot-stocks
 * ===================
 * Hot Score = E_score × sigmoid(M_score) 기반 Top 10 종목 반환.
 *
 * M_score = 0.6 × price_z + 0.4 × volume_z
 *   price_z  = (price_1d − 0) / cap_sigma  (D+1 open→close 수익률 z-score 근사)
 *   volume_z = (volume_ratio − 1.0) / 0.5   (1.5x→1.0, 2x→2.0)
 *
 * 필터:
 *   E_score ≥ 20  (event_stats.signal_score × 0.3)
 *   sample_size ≥ 50
 *   volume_ratio ≥ 1.5  (거래량 1.5배 이상)
 *
 * 캐시: 15분 (장중 배치 주기와 일치)
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

// 시총 버킷별 일일 변동성 시그마 (price_z 정규화용)
// 한국 시장 평균: LARGE≈1.5%, MID≈2.5%, SMALL≈4.0%
const CAP_SIGMA: Record<string, number> = {
  LARGE: 0.015,
  MID:   0.025,
  SMALL: 0.040,
}

// 시총 버킷 기준 (KRW) — companies.market_cap 분포 P33/P67
const CAP_LARGE = 245_000_000_000  // 2,450억+
const CAP_MID   =  65_000_000_000  // 650억+

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

/** 영업일 기준 D+N date 목록 (간단 근사: 주말 skip) */
function tradingDaysAfter(baseDateStr: string, offset: number): string {
  // baseDateStr: "YYYYMMDD"
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
  return dt.toISOString().slice(0, 10)  // YYYY-MM-DD
}

// ── 메인 핸들러 ───────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = createServiceClient() as any

    // ── 1. event_stats — 이벤트 품질 필터 ────────────────────────────────────
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

    // ── 2. 최근 공시 조회 (최근 3일, E_score 기준 유효 이벤트만) ─────────────
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

    // ── 3. 필요한 종목코드 + 날짜 목록 수집 ──────────────────────────────────
    type DiscRow = {
      id: string; corp_name: string; stock_code: string; event_type: string
      headline: string | null; signal_tag: string | null
      final_score: number | null; sentiment_score: number | null
      rcept_dt: string; created_at: string
    }

    // 1차 필터: E_score + sample_size
    const qualified: DiscRow[] = (discRows as DiscRow[]).filter(r => {
      const et = (r.event_type ?? '').toUpperCase()
      const meta = eventMap.get(et)
      return meta && meta.sample_size >= 50 && meta.e_score >= 20
    })

    // Fallback: 부족 시 완화
    const pool = qualified.length >= 3 ? qualified
      : (discRows as DiscRow[]).filter(r => {
          const et = (r.event_type ?? '').toUpperCase()
          const meta = eventMap.get(et)
          return meta && meta.sample_size >= 30 && meta.e_score >= 15
        })

    if (!pool.length) {
      return NextResponse.json([], {
        headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=1800' },
      })
    }

    // ── 4. price_history 조회 (D+1 가격 + 최근 21일 거래량) ─────────────────
    const stockCodes = [...new Set(pool.map(r => r.stock_code).filter(Boolean))]

    // D+1 날짜 목록
    const d1DateMap = new Map<string, string>()  // stock_code → D+1 YYYY-MM-DD
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

    // 인덱스: stock_code → { date → { open, close, volume } }
    type PriceEntry = { open: number | null; close: number | null; volume: number | null }
    const priceIndex = new Map<string, Map<string, PriceEntry>>()
    for (const p of (priceRows ?? []) as Array<{ stock_code: string; date: string; open: number | null; close: number | null; volume: number | null }>) {
      if (!priceIndex.has(p.stock_code)) priceIndex.set(p.stock_code, new Map())
      priceIndex.get(p.stock_code)!.set(p.date, {
        open: p.open, close: p.close, volume: p.volume,
      })
    }

    // ── 5. 시총 조회 (cap_bucket 결정용) ─────────────────────────────────────
    const { data: capRows } = await sb
      .from('companies')
      .select('stock_code, market_cap')
      .in('stock_code', stockCodes)

    const capMap = new Map<string, number | null>(
      ((capRows ?? []) as Array<{ stock_code: string; market_cap: number | null }>)
        .map(r => [r.stock_code, r.market_cap])
    )

    // ── 6. M_score + Hot_score 계산 ──────────────────────────────────────────
    type Result = {
      id: string; corp_name: string; stock_code: string
      event_type: string; event_label: string
      e_score: number; signal_grade: string | null; median_return: number | null
      headline: string | null; signal_tag: string | null
      final_score: number | null; sentiment_score: number | null
      price_1d: number | null; volume_ratio: number | null
      m_score: number; hot_score: number
    }

    const seen = new Set<string>()
    const results: Result[] = []

    for (const row of pool) {
      if (seen.has(row.stock_code)) continue

      const et = (row.event_type ?? '').toUpperCase()
      const meta = eventMap.get(et)!

      // price_history 데이터
      const stockPrices = priceIndex.get(row.stock_code)
      const d1Date = d1DateMap.get(row.stock_code)
      const d1 = d1Date ? stockPrices?.get(d1Date) : null

      // price_1d = D+1 close / D+1 open - 1
      let price_1d: number | null = null
      if (d1?.close != null && d1?.open != null && d1.open > 0) {
        price_1d = d1.close / d1.open - 1
      } else if (d1?.close != null) {
        // open 없으면 skip price signal (open 컬럼 아직 backfill 전)
        price_1d = null
      }

      // volume_ratio = today_volume / avg_20d_volume
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

      // 거래량 필터: volume_ratio >= 1.5
      if (volume_ratio !== null && volume_ratio < 1.5) continue

      // M_score
      const bucket = capBucket(capMap.get(row.stock_code) ?? null)
      const sigma  = CAP_SIGMA[bucket]

      const price_z  = price_1d !== null ? price_1d / sigma : 0
      const volume_z = volume_ratio !== null ? (volume_ratio - 1.0) / 0.5 : 0

      const m_score  = 0.6 * price_z + 0.4 * volume_z
      const hot_score = Math.round(meta.e_score * sigmoid(m_score) * 10) / 10

      seen.add(row.stock_code)
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
        price_1d:       price_1d !== null ? Math.round(price_1d * 10000) / 100 : null,  // %
        volume_ratio:   volume_ratio !== null ? Math.round(volume_ratio * 10) / 10 : null,
        m_score:        Math.round(m_score * 100) / 100,
        hot_score,
      })

      if (results.length >= 20) break  // 정렬 후 10개 컷
    }

    // 정렬: hot_score DESC (m_score 데이터 없으면 e_score로 fallback)
    results.sort((a, b) => b.hot_score - a.hot_score || b.e_score - a.e_score)

    return NextResponse.json(results.slice(0, 10), {
      headers: { 'Cache-Control': 's-maxage=900, stale-while-revalidate=1800' },
    })
  } catch (err) {
    console.error('[hot-stocks] error:', err)
    return NextResponse.json([], { status: 500 })
  }
}
