/**
 * EventHistoricalReaction
 * =======================
 * 이벤트 유형별 과거 시장 반응 통계를 보여주는 서버 컴포넌트.
 *
 * - event_stats 테이블에서 해당 event_type 집계 데이터를 직접 조회
 * - 로그인 여부 무관하게 공개 표시 (aggregate 데이터 — 마케팅·신뢰도용)
 * - 표시 항목: Hit Rate 5D/20D, Avg Return, Alpha vs Benchmark, MDD, Grade
 */

import { createServiceClient } from '@/lib/supabase/server'

// ── 지원 이벤트 타입 (event_stats에 데이터 있는 것만) ─────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  EARNINGS: 'Earnings Release',
  CONTRACT: 'Strategic Contract',
  DILUTION: 'Capital Increase',
  BUYBACK:  'Share Buyback',
  RIGHTS:   'Rights Offering',
  MERGER:   'M&A / Merger',
  SPINOFF:  'Spin-off',
  EQUITY:   'Equity Issuance',
}

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface EventStats {
  event_type:         string
  sample_size:        number
  hit_ratio:          number | null  // 5d hit rate (%)
  hit_ratio_20d:      number | null
  avg_5d_open_return: number | null
  avg_5d_return:      number | null
  avg_20d_return:     number | null
  alpha_5d:           number | null
  alpha_20d:          number | null
  avg_mdd:            number | null
  signal_grade:       string | null
  signal_score:       number | null
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────

function fmt(v: number | null, digits = 1, sign = true): string {
  if (v == null) return '—'
  const prefix = sign && v > 0 ? '+' : ''
  return `${prefix}${v.toFixed(digits)}%`
}

function pct(v: number | null): string {
  if (v == null) return '—'
  return `${v.toFixed(1)}%`
}

function colorVal(v: number | null): string {
  if (v == null) return 'text-gray-400'
  return v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-gray-400'
}

function colorHit(v: number | null): string {
  if (v == null) return 'text-gray-400'
  return v >= 55 ? 'text-emerald-400' : v >= 50 ? 'text-yellow-400' : 'text-red-400'
}

const GRADE_STYLE: Record<string, string> = {
  'A+': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'A':  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'B':  'bg-blue-500/10    text-blue-400    border-blue-500/20',
  'C':  'bg-yellow-500/10  text-yellow-400  border-yellow-500/20',
  'D':  'bg-red-500/10     text-red-400     border-red-500/20',
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export default async function EventHistoricalReaction({
  eventType,
}: {
  eventType: string | null
}) {
  // 지원하는 이벤트 타입이 아니면 렌더링 안 함
  if (!eventType || !EVENT_TYPE_LABELS[eventType]) return null

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('event_stats')
    .select(
      'event_type, sample_size, hit_ratio, hit_ratio_20d, ' +
      'avg_5d_open_return, avg_5d_return, avg_20d_return, ' +
      'alpha_5d, alpha_20d, avg_mdd, signal_grade, signal_score'
    )
    .eq('event_type', eventType)
    .maybeSingle()

  if (error || !data) return null

  const stats = data as unknown as EventStats

  // alpha 가 둘 다 null 이면 (아직 계산 전) 섹션 전체 숨김
  const hasAlpha = stats.alpha_5d != null || stats.alpha_20d != null

  const gradeStyle = GRADE_STYLE[stats.signal_grade ?? ''] ?? GRADE_STYLE['C']
  const eventLabel = EVENT_TYPE_LABELS[eventType]

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-5">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-1">
            Historical Market Reaction
          </p>
          <p className="text-sm text-gray-400">
            Based on{' '}
            <span className="text-white font-semibold">{stats.sample_size.toLocaleString()}</span>
            {' '}similar <span className="text-[#00D4A6]">{eventLabel}</span> events
          </p>
        </div>
        {stats.signal_grade && (
          <span
            className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border ${gradeStyle}`}
          >
            Grade {stats.signal_grade}
          </span>
        )}
      </div>

      {/* ── 히트율 ── */}
      <div>
        <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">Hit Rate</p>
        <div className="grid grid-cols-2 gap-3">
          <StatBox
            label="5D Hit Rate"
            value={pct(stats.hit_ratio)}
            valueClass={colorHit(stats.hit_ratio)}
            sub="stocks up after 5 days"
          />
          <StatBox
            label="20D Hit Rate"
            value={pct(stats.hit_ratio_20d)}
            valueClass={colorHit(stats.hit_ratio_20d)}
            sub="stocks up after 20 days"
          />
        </div>
      </div>

      {/* ── 평균 수익률 ── */}
      <div>
        <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">Avg Return</p>
        <div className="grid grid-cols-3 gap-3">
          <StatBox
            label="Entry (Next Open)"
            value={fmt(stats.avg_5d_open_return)}
            valueClass={colorVal(stats.avg_5d_open_return)}
            sub="5D from open"
          />
          <StatBox
            label="5D Return"
            value={fmt(stats.avg_5d_return)}
            valueClass={colorVal(stats.avg_5d_return)}
            sub="close-to-close"
          />
          <StatBox
            label="20D Return"
            value={fmt(stats.avg_20d_return)}
            valueClass={colorVal(stats.avg_20d_return)}
            sub="close-to-close"
          />
        </div>
      </div>

      {/* ── 알파 vs 벤치마크 ── */}
      {hasAlpha && (
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">
            Alpha vs Benchmark
            <span className="ml-1.5 normal-case text-gray-700">(KOSPI / KOSDAQ)</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <StatBox
              label="Alpha 5D"
              value={fmt(stats.alpha_5d)}
              valueClass={colorVal(stats.alpha_5d)}
              sub="vs index return"
              highlight={stats.alpha_5d != null && Math.abs(stats.alpha_5d) >= 1}
            />
            <StatBox
              label="Alpha 20D"
              value={fmt(stats.alpha_20d)}
              valueClass={colorVal(stats.alpha_20d)}
              sub="vs index return"
              highlight={stats.alpha_20d != null && Math.abs(stats.alpha_20d) >= 1}
            />
          </div>
        </div>
      )}

      {/* ── MDD ── */}
      {stats.avg_mdd != null && (
        <div className="pt-1 border-t border-gray-800 flex items-center justify-between text-xs">
          <span className="text-gray-500">Avg Max Drawdown</span>
          <span className="text-red-400 font-semibold">{fmt(stats.avg_mdd, 1, false)}</span>
        </div>
      )}

      {/* 면책 주석 */}
      <p className="text-xs text-gray-700 leading-relaxed">
        Historical statistics based on DART filings since Jan 2025.
        Past market reactions do not guarantee future results.
      </p>
    </div>
  )
}

// ── 재사용 StatBox ─────────────────────────────────────────────────────────────

function StatBox({
  label,
  value,
  valueClass,
  sub,
  highlight = false,
}: {
  label:      string
  value:      string
  valueClass: string
  sub:        string
  highlight?: boolean
}) {
  return (
    <div
      className={`rounded-lg px-3 py-3 space-y-1 ${
        highlight
          ? 'bg-[#00D4A6]/8 border border-[#00D4A6]/20'
          : 'bg-gray-800/50'
      }`}
    >
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${valueClass}`}>{value}</p>
      <p className="text-xs text-gray-600">{sub}</p>
    </div>
  )
}
