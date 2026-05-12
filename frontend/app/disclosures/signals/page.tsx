/**
 * /disclosures/signals
 * ====================
 * 이벤트 유형별 시그널 통계 대시보드 (서버 컴포넌트).
 *
 * 4개 뷰 탭:
 *   Overview       — 전체 집계 (event_stats)
 *   By Market Cap  — LARGE / MID / SMALL (event_stats_by_bucket)
 *   By Regime      — UP / NEUTRAL / DOWN (event_stats_by_regime)
 *   By Volatility  — HIGH / NORMAL / LOW (event_stats_by_vol)
 *
 * 접근: Pro+ 플랜 (middleware 보호)
 */

import { Suspense } from 'react'
import { createServiceClient } from '@/lib/supabase/server'
import SignalsDashboardClient from '@/components/disclosures/SignalsDashboardClient'

// ── 타입 ──────────────────────────────────────────────────────────────────────

export interface OverviewRow {
  event_type:      string
  sample_size:     number
  hit_ratio:       number | null
  hit_ratio_20d:   number | null
  alpha5_trimmed:  number | null
  alpha20_trimmed: number | null
  alpha20_median:  number | null
  avg_mdd:         number | null
  signal_grade:    string | null
  signal_score:    number | null
  updated_at:      string | null
}

export interface ContextRow {
  event_type:      string
  dim:             string      // bucket / regime / vol_regime 값
  sample_size:     number | null
  hit_ratio:       number | null
  hit_ratio_20d:   number | null
  alpha20_trimmed: number | null
  alpha20_median:  number | null
  avg_mdd:         number | null
}

export interface DashboardData {
  overview:  OverviewRow[]
  byBucket:  ContextRow[]
  byRegime:  ContextRow[]
  byVol:     ContextRow[]
  updatedAt: string | null
}

// ── 메타데이터 ─────────────────────────────────────────────────────────────────

export const metadata = {
  title: 'Signal Statistics | KMI',
  description: 'Event-type signal performance across market conditions — market cap, trend regime, and volatility regime.',
  robots: { index: false },
}

// ── 데이터 fetch ──────────────────────────────────────────────────────────────

async function fetchDashboardData(): Promise<DashboardData> {
  const sb = createServiceClient()

  const [overviewRes, bucketRes, regimeRes, volRes] = await Promise.all([
    sb.from('event_stats').select(
      'event_type, sample_size, hit_ratio, hit_ratio_20d, ' +
      'alpha5_trimmed, alpha20_trimmed, alpha20_median, avg_mdd, ' +
      'signal_grade, signal_score, updated_at'
    ).order('signal_score', { ascending: false }),

    sb.from('event_stats_by_bucket').select(
      'event_type, bucket, sample_size, hit_ratio, hit_ratio_20d, ' +
      'alpha20_trimmed, alpha20_median, avg_mdd'
    ).order('event_type'),

    sb.from('event_stats_by_regime').select(
      'event_type, regime, sample_size, hit_ratio, hit_ratio_20d, ' +
      'alpha20_trimmed, alpha20_median, avg_mdd'
    ).order('event_type'),

    sb.from('event_stats_by_vol').select(
      'event_type, vol_regime, sample_size, hit_ratio, hit_ratio_20d, ' +
      'alpha20_trimmed, alpha20_median, avg_mdd'
    ).order('event_type'),
  ])

  const overview = (overviewRes.data ?? []) as unknown as OverviewRow[]

  const byBucket: ContextRow[] = ((bucketRes.data ?? []) as any[]).map(r => ({
    event_type: r.event_type, dim: r.bucket,
    sample_size: r.sample_size, hit_ratio: r.hit_ratio, hit_ratio_20d: r.hit_ratio_20d,
    alpha20_trimmed: r.alpha20_trimmed, alpha20_median: r.alpha20_median, avg_mdd: r.avg_mdd,
  }))

  const byRegime: ContextRow[] = ((regimeRes.data ?? []) as any[]).map(r => ({
    event_type: r.event_type, dim: r.regime,
    sample_size: r.sample_size, hit_ratio: r.hit_ratio, hit_ratio_20d: r.hit_ratio_20d,
    alpha20_trimmed: r.alpha20_trimmed, alpha20_median: r.alpha20_median, avg_mdd: r.avg_mdd,
  }))

  const byVol: ContextRow[] = ((volRes.data ?? []) as any[]).map(r => ({
    event_type: r.event_type, dim: r.vol_regime,
    sample_size: r.sample_size, hit_ratio: r.hit_ratio, hit_ratio_20d: r.hit_ratio_20d,
    alpha20_trimmed: r.alpha20_trimmed, alpha20_median: r.alpha20_median, avg_mdd: r.avg_mdd,
  }))

  return {
    overview,
    byBucket,
    byRegime,
    byVol,
    updatedAt: overview[0]?.updated_at ?? null,
  }
}

// ── 페이지 ────────────────────────────────────────────────────────────────────

export default async function SignalsPage() {
  const data = await fetchDashboardData()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-10 space-y-8">

        {/* ── 헤더 ── */}
        <div className="space-y-2">
          <p className="text-xs text-[#00D4A6] font-semibold uppercase tracking-widest">
            Signal Statistics
          </p>
          <h1 className="text-2xl font-bold text-white">
            Event Signal Performance Dashboard
          </h1>
          <p className="text-sm text-gray-400 max-w-2xl">
            Backtested performance of DART disclosure event types across market conditions.
            Alpha = stock return − KOSPI/KOSDAQ benchmark. Trimmed mean excludes top/bottom 5% outliers.
          </p>
          {data.updatedAt && (
            <p className="text-xs text-gray-600">
              Updated: {new Date(data.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
        </div>

        {/* ── 탭 대시보드 (클라이언트 컴포넌트) ── */}
        <Suspense fallback={<div className="h-96 bg-gray-900 rounded-xl animate-pulse" />}>
          <SignalsDashboardClient data={data} />
        </Suspense>

        {/* ── 방법론 footnote ── */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-5 space-y-2 text-xs text-gray-600">
          <p className="font-semibold text-gray-500">Methodology Notes</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Alpha = stock return − benchmark (KOSPI for KOSPI-listed, KOSDAQ for KOSDAQ-listed). T0 = first trading day after filing date.</li>
            <li>Trimmed alpha removes top/bottom 5% per event type to reduce Korean small-cap outlier distortion.</li>
            <li>Signal grade: risk-adjusted return (median 5D ÷ volatility, Sharpe-style) × sample confidence (n/300). A≥75 / B≥60 / C≥45 / D≥30.</li>
            <li>Market cap buckets: Large &gt; ₩1T · Mid ₩100B–₩1T · Small &lt; ₩100B at time of filing.</li>
            <li>Market regime: KOSPI 20-trading-day prior return. UP &gt; +5% · DOWN &lt; −5%.</li>
            <li>Volatility regime: KOSPI 20-day rolling daily return std. High &gt; 1.2% · Low &lt; 0.6%.</li>
            <li>Min. 30 events per cell (contextual views). Min. 50 events (overview). Data: DART filings Jan 2025–present.</li>
          </ul>
          <p className="pt-1 border-t border-gray-800">
            Past performance does not guarantee future results. This is statistical analysis, not investment advice.
          </p>
        </div>

      </div>
    </div>
  )
}
