'use client'

/**
 * SignalsDashboardClient
 * ======================
 * 탭 네비게이션 + 4개 뷰를 렌더하는 클라이언트 컴포넌트.
 * 데이터는 서버 컴포넌트(SignalsPage)에서 props로 전달받음.
 */

import { useState } from 'react'
import type { DashboardData, OverviewRow, ContextRow } from '@/app/disclosures/signals/page'

// ── 유틸 ──────────────────────────────────────────────────────────────────────

const EVENT_LABELS: Record<string, string> = {
  EARNINGS: 'Earnings',
  CONTRACT: 'Contract',
  DILUTION: 'Dilution',
  BUYBACK:  'Buyback',
  DISPOSAL: 'Disposal',
  DIVIDEND: 'Dividend',
  MNA:      'M&A',
  LEGAL:    'Legal',
  CAPEX:    'Capex',
  OTHER:    'Other',
}

function fmt(v: number | null, d = 1) {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(d)}%`
}
function hitPct(v: number | null) {
  if (v == null) return '—'
  return `${(v * 100).toFixed(1)}%`
}
function colorVal(v: number | null) {
  if (v == null) return 'text-gray-500'
  return v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-gray-400'
}
function colorHit(v: number | null) {
  const p = (v ?? 0) * 100
  if (v == null) return 'text-gray-500'
  return p >= 55 ? 'text-emerald-400' : p >= 50 ? 'text-yellow-400' : 'text-red-400'
}

const GRADE_STYLE: Record<string, string> = {
  'A+': 'bg-emerald-500/20 text-emerald-300',
  'A':  'bg-emerald-500/15 text-emerald-400',
  'B':  'bg-blue-500/15    text-blue-400',
  'C':  'bg-gray-500/15    text-gray-400',
  'D':  'bg-yellow-500/10  text-yellow-500',
  'F':  'bg-red-500/10     text-red-400',
}

// ── 탭 정의 ───────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'bucket',   label: 'By Market Cap' },
  { key: 'regime',   label: 'By Regime' },
  { key: 'vol',      label: 'By Volatility' },
] as const
type TabKey = (typeof TABS)[number]['key']

// ── 공통 테이블 헤더/행 ────────────────────────────────────────────────────────

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap
      ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}
function Td({ children, right, className, title }: { children: React.ReactNode; right?: boolean; className?: string; title?: string }) {
  return (
    <td title={title} className={`px-3 py-2.5 text-xs tabular-nums whitespace-nowrap
      ${right ? 'text-right' : ''} ${className ?? ''}`}>
      {children}
    </td>
  )
}

// ── Best Environment 계산 헬퍼 ────────────────────────────────────────────────

const MIN_BADGE_N = 50

const DIM_SHORT: Record<string, string> = {
  LARGE: 'Large Cap', MID: 'Mid Cap', SMALL: 'Small Cap',
  UP: 'Bull Mkt', NEUTRAL: 'Neutral', DOWN: 'Bear Mkt',
  HIGH: 'High Vol', NORMAL: 'Normal Vol', LOW: 'Low Vol',
}
const DIM_COLOR: Record<string, string> = {
  LARGE: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  MID:   'text-purple-400 bg-purple-500/10 border-purple-500/20',
  SMALL: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  UP:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  NEUTRAL: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
  DOWN:  'text-red-400 bg-red-500/10 border-red-500/20',
  HIGH:  'text-red-400 bg-red-500/10 border-red-500/20',
  NORMAL:'text-gray-400 bg-gray-500/10 border-gray-500/20',
  LOW:   'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
}

function bestDim(rows: ContextRow[], ev: string): { dim: string; alpha: number; n: number } | null {
  const eligible = rows
    .filter(r => r.event_type === ev && (r.sample_size ?? 0) >= MIN_BADGE_N && r.alpha20_trimmed != null)
    .sort((a, b) => (b.alpha20_trimmed!) - (a.alpha20_trimmed!))
  return eligible[0]
    ? { dim: eligible[0].dim, alpha: eligible[0].alpha20_trimmed!, n: eligible[0].sample_size! }
    : null
}

// ── Overview 탭 ───────────────────────────────────────────────────────────────

function OverviewTab({ rows, byBucket, byRegime }: {
  rows: OverviewRow[]
  byBucket: ContextRow[]
  byRegime: ContextRow[]
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full">
        <thead className="bg-gray-900/60 border-b border-gray-800">
          <tr>
            <Th>Event Type</Th>
            <Th right>n</Th>
            <Th right>Hit 5D</Th>
            <Th right>Hit 20D</Th>
            <Th right>Alpha 5D</Th>
            <Th right>Alpha 20D</Th>
            <Th right>Median α</Th>
            <Th right>MDD</Th>
            <Th right>Grade</Th>
            <Th>Best Condition</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {rows.map(r => {
            const bestBkt = bestDim(byBucket, r.event_type)
            const bestRgm = bestDim(byRegime, r.event_type)
            return (
              <tr key={r.event_type} className="hover:bg-gray-800/30 transition-colors">
                <Td>
                  <span className="font-semibold text-white">
                    {EVENT_LABELS[r.event_type] ?? r.event_type}
                  </span>
                </Td>
                <Td right>
                  <span className="text-gray-300 font-medium">
                    {r.sample_size?.toLocaleString()}
                  </span>
                </Td>
                <Td right className={colorHit(r.hit_ratio)}>{hitPct(r.hit_ratio)}</Td>
                <Td right className={colorHit(r.hit_ratio_20d)}>{hitPct(r.hit_ratio_20d)}</Td>
                <Td right className={colorVal(r.alpha5_trimmed)}>{fmt(r.alpha5_trimmed)}</Td>
                <Td right className={colorVal(r.alpha20_trimmed)}>{fmt(r.alpha20_trimmed)}</Td>
                <Td right className={`${colorVal(r.alpha20_median)} opacity-70`}>{fmt(r.alpha20_median)}</Td>
                <Td right className="text-red-400">{fmt(r.avg_mdd)}</Td>
                <Td right>
                  {r.signal_grade ? (
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${GRADE_STYLE[r.signal_grade] ?? GRADE_STYLE['C']}`}>
                      {r.signal_grade}
                    </span>
                  ) : '—'}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {bestBkt && (
                      <span className={`px-1.5 py-0.5 rounded border text-xs ${DIM_COLOR[bestBkt.dim] ?? 'text-gray-400'}`}
                        title={`Best cap: α20=${fmt(bestBkt.alpha)} n=${bestBkt.n}`}>
                        {DIM_SHORT[bestBkt.dim]}
                      </span>
                    )}
                    {bestRgm && (
                      <span className={`px-1.5 py-0.5 rounded border text-xs ${DIM_COLOR[bestRgm.dim] ?? 'text-gray-400'}`}
                        title={`Best regime: α20=${fmt(bestRgm.alpha)} n=${bestRgm.n}`}>
                        {DIM_SHORT[bestRgm.dim]}
                      </span>
                    )}
                  </div>
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Contextual 탭 (공통 레이아웃) ─────────────────────────────────────────────

const DIM_LABELS: Record<string, { label: string; color: string }> = {
  // bucket
  LARGE:   { label: 'Large Cap',  color: 'text-blue-400' },
  MID:     { label: 'Mid Cap',    color: 'text-purple-400' },
  SMALL:   { label: 'Small Cap',  color: 'text-orange-400' },
  // regime
  UP:      { label: 'Bull (↑)',   color: 'text-emerald-400' },
  NEUTRAL: { label: 'Neutral (→)', color: 'text-gray-400' },
  DOWN:    { label: 'Bear (↓)',   color: 'text-red-400' },
  // vol
  HIGH:    { label: 'High Vol',   color: 'text-red-400' },
  NORMAL:  { label: 'Normal Vol', color: 'text-gray-400' },
  LOW:     { label: 'Low Vol',    color: 'text-emerald-400' },
}

function ContextualTab({ rows, dimOrder, dimNote }: {
  rows: ContextRow[]
  dimOrder: string[]
  dimNote: string
}) {
  // 이벤트별로 그룹화
  const byEvent: Record<string, Record<string, ContextRow>> = {}
  for (const r of rows) {
    if (!byEvent[r.event_type]) byEvent[r.event_type] = {}
    byEvent[r.event_type][r.dim] = r
  }
  const events = Object.keys(byEvent)

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-600">{dimNote}</p>
      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full">
          <thead className="bg-gray-900/60 border-b border-gray-800">
            <tr>
              <Th>Event Type</Th>
              {dimOrder.map(dim => {
                const meta = DIM_LABELS[dim]
                return (
                  <th key={dim} colSpan={3}
                    className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-center border-l border-gray-800/60">
                    <span className={meta?.color ?? 'text-gray-400'}>{meta?.label ?? dim}</span>
                  </th>
                )
              })}
            </tr>
            <tr className="border-b border-gray-800/40">
              <td />
              {dimOrder.map(dim => (
                <React.Fragment key={dim}>
                  <th className="px-3 py-1.5 text-xs text-gray-600 text-right border-l border-gray-800/60 whitespace-nowrap">Hit5</th>
                  <th className="px-3 py-1.5 text-xs text-gray-600 text-right whitespace-nowrap">α20D</th>
                  <th className="px-3 py-1.5 text-xs text-gray-600 text-right whitespace-nowrap">n</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {events.map(ev => (
              <tr key={ev} className="hover:bg-gray-800/30 transition-colors">
                <Td>
                  <span className="font-semibold text-white">{EVENT_LABELS[ev] ?? ev}</span>
                </Td>
                {dimOrder.map(dim => {
                  const r = byEvent[ev]?.[dim]
                  const n = r?.sample_size ?? 0
                  // n<50: 소표본 경고색
                  const nClass = n >= 100 ? 'text-gray-400' : n >= 50 ? 'text-yellow-600' : 'text-gray-700'
                  return (
                    <React.Fragment key={dim}>
                      <Td right className={`border-l border-gray-800/30 ${colorHit(r?.hit_ratio ?? null)}`}>
                        {r ? hitPct(r.hit_ratio) : <span className="text-gray-700">—</span>}
                      </Td>
                      <Td right className={colorVal(r?.alpha20_trimmed ?? null)}>
                        {r ? fmt(r.alpha20_trimmed) : <span className="text-gray-700">—</span>}
                      </Td>
                      <Td right className={nClass} title={n < 50 ? 'Small sample — interpret with caution' : undefined}>
                        {r ? (
                          <span>{n.toLocaleString()}{n < 50 ? ' ⚠' : ''}</span>
                        ) : '—'}
                      </Td>
                    </React.Fragment>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// React import for Fragment
import React from 'react'

// ── 메인 클라이언트 컴포넌트 ──────────────────────────────────────────────────

export default function SignalsDashboardClient({ data }: { data: DashboardData }) {
  const [tab, setTab] = useState<TabKey>('overview')

  return (
    <div className="space-y-5">
      {/* ── 탭 네비게이션 ── */}
      <div className="flex gap-1 rounded-xl bg-gray-900 border border-gray-800 p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key
                ? 'bg-[#00D4A6]/15 text-[#00D4A6] border border-[#00D4A6]/30'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 탭 컨텐츠 ── */}
      {tab === 'overview' && (
        <OverviewTab rows={data.overview} byBucket={data.byBucket} byRegime={data.byRegime} />
      )}

      {tab === 'bucket' && (
        <ContextualTab
          rows={data.byBucket}
          dimOrder={['LARGE', 'MID', 'SMALL']}
          dimNote="Performance breakdown by market cap at time of filing. Large > ₩1T · Mid ₩100B–₩1T · Small < ₩100B. Min. 30 events per cell."
        />
      )}

      {tab === 'regime' && (
        <ContextualTab
          rows={data.byRegime}
          dimOrder={['UP', 'NEUTRAL', 'DOWN']}
          dimNote="Performance when KOSPI was trending UP (>+5%), NEUTRAL (±5%), or DOWN (<−5%) in the 20 trading days prior to filing. Min. 30 events per cell."
        />
      )}

      {tab === 'vol' && (
        <ContextualTab
          rows={data.byVol}
          dimOrder={['HIGH', 'NORMAL', 'LOW']}
          dimNote="Performance by KOSPI 20-day rolling daily return volatility at time of filing. High std > 1.2% · Normal 0.6–1.2% · Low < 0.6%. Min. 30 events per cell."
        />
      )}
    </div>
  )
}
