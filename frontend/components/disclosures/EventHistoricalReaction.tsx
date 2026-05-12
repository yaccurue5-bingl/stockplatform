/**
 * EventHistoricalReaction
 * =======================
 * 이벤트 유형별 과거 시장 반응 통계를 보여주는 서버 컴포넌트.
 *
 * UI 구조:
 *   Primary   — Hit Rate + Trimmed Alpha (outlier 제거 후 대표값)
 *   Secondary — Median Alpha + Distribution (>5%, <-10%, max/min)
 *   Footer    — Avg MDD + Disclaimer
 *
 * 데이터 출처: event_stats 테이블 (EOD 배치 업데이트)
 * 접근 제한: 없음 (aggregate 통계 — 모든 방문자에게 공개)
 */

import { createServiceClient } from '@/lib/supabase/server'

// ── 지원 이벤트 타입 ──────────────────────────────────────────────────────────

const EVENT_TYPE_LABELS: Record<string, string> = {
  EARNINGS: 'Earnings Release',
  CONTRACT: 'Strategic Contract',
  DILUTION: 'Capital Increase',
  BUYBACK:  'Share Buyback',
  DISPOSAL: 'Treasury Share Disposal',
  RIGHTS:   'Rights Offering',
  MERGER:   'M&A / Merger',
  SPINOFF:  'Spin-off',
  EQUITY:   'Equity Issuance',
}

// ── 타입 ──────────────────────────────────────────────────────────────────────

interface EventStats {
  event_type:         string
  sample_size:        number
  hit_ratio:          number | null   // 5d hit rate (소수 0–1)
  hit_ratio_20d:      number | null
  avg_5d_open_return: number | null
  alpha_5d:           number | null   // winsorized mean
  alpha_20d:          number | null
  alpha5_trimmed:     number | null   // trimmed mean (primary)
  alpha20_trimmed:    number | null
  alpha5_median:      number | null   // median (secondary)
  alpha20_median:     number | null
  alpha20_pos_pct:    number | null   // % events beating benchmark
  pct_gt5_20d:        number | null   // % 20d return > +5%
  pct_lt10_20d:       number | null   // % 20d return < -10%
  max_gain_20d:       number | null
  max_loss_20d:       number | null
  avg_mdd:            number | null
  signal_grade:       string | null
  signal_score:       number | null
}

// ── 유틸 ──────────────────────────────────────────────────────────────────────

function fmt(v: number | null, digits = 1): string {
  if (v == null) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toFixed(digits)}%`
}

function pct(v: number | null): string {
  if (v == null) return '—'
  return `${v.toFixed(1)}%`
}

// hit rate (소수 0–1 → %)
function hitPct(v: number | null): string {
  if (v == null) return '—'
  return `${(v * 100).toFixed(1)}%`
}

function colorVal(v: number | null): string {
  if (v == null) return 'text-gray-400'
  return v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-gray-400'
}

function colorHit(v: number | null, isRatio = true): string {
  const pctVal = isRatio ? (v ?? 0) * 100 : (v ?? 0)
  if (v == null) return 'text-gray-400'
  return pctVal >= 55 ? 'text-emerald-400' : pctVal >= 50 ? 'text-yellow-400' : 'text-red-400'
}

const GRADE_STYLE: Record<string, string> = {
  'A+': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'A':  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'B':  'bg-blue-500/10    text-blue-400    border-blue-500/20',
  'C':  'bg-yellow-500/10  text-yellow-400  border-yellow-500/20',
  'D':  'bg-red-500/10     text-red-400     border-red-500/20',
}

// ── 서브 컴포넌트 ─────────────────────────────────────────────────────────────

function StatBox({
  label, value, valueClass, sub, highlight = false,
}: {
  label: string; value: string; valueClass: string
  sub?: string; highlight?: boolean
}) {
  return (
    <div className={`rounded-lg px-3 py-3 space-y-0.5 ${
      highlight
        ? 'bg-[#00D4A6]/8 border border-[#00D4A6]/20'
        : 'bg-gray-800/50'
    }`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-lg font-bold tabular-nums leading-tight ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600">{sub}</p>}
    </div>
  )
}

function MiniStat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between text-xs py-1.5 border-b border-gray-800/60 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className={`font-semibold tabular-nums ${valueClass ?? 'text-gray-300'}`}>{value}</span>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default async function EventHistoricalReaction({
  eventType,
}: {
  eventType: string | null
}) {
  if (!eventType || !EVENT_TYPE_LABELS[eventType]) return null

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('event_stats')
    .select(
      'event_type, sample_size, hit_ratio, hit_ratio_20d, ' +
      'avg_5d_open_return, alpha_5d, alpha_20d, ' +
      'alpha5_trimmed, alpha20_trimmed, alpha5_median, alpha20_median, ' +
      'alpha20_pos_pct, pct_gt5_20d, pct_lt10_20d, max_gain_20d, max_loss_20d, ' +
      'avg_mdd, signal_grade, signal_score'
    )
    .eq('event_type', eventType)
    .maybeSingle()

  if (error || !data) return null

  const s = data as unknown as EventStats

  // trimmed 또는 median 중 하나라도 있어야 렌더
  const hasAlpha = s.alpha20_trimmed != null || s.alpha20_median != null

  const gradeStyle = GRADE_STYLE[s.signal_grade ?? ''] ?? GRADE_STYLE['C']
  const eventLabel = EVENT_TYPE_LABELS[eventType]

  // alpha20_trimmed가 없으면 winsorized mean으로 fallback
  const a20primary  = s.alpha20_trimmed  ?? s.alpha_20d
  const a20secondary = s.alpha20_median
  const a5primary   = s.alpha5_trimmed   ?? s.alpha_5d

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-5">

      {/* ── 헤더 ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-1">
            Historical Market Reaction
          </p>
          <p className="text-sm text-gray-400">
            Based on{' '}
            <span className="text-white font-semibold">{s.sample_size.toLocaleString()}</span>
            {' '}similar{' '}
            <span className="text-[#00D4A6]">{eventLabel}</span> events
          </p>
        </div>
        {s.signal_grade && (
          <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border ${gradeStyle}`}>
            Grade {s.signal_grade}
          </span>
        )}
      </div>

      {/* ── PRIMARY: Hit Rate ── */}
      <div>
        <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">Hit Rate</p>
        <div className="grid grid-cols-2 gap-3">
          <StatBox
            label="5D Hit Rate"
            value={hitPct(s.hit_ratio)}
            valueClass={colorHit(s.hit_ratio)}
            sub="stocks positive after 5 days"
          />
          <StatBox
            label="20D Hit Rate"
            value={hitPct(s.hit_ratio_20d)}
            valueClass={colorHit(s.hit_ratio_20d)}
            sub="stocks positive after 20 days"
          />
        </div>
      </div>

      {/* ── PRIMARY: Trimmed Alpha ── */}
      {hasAlpha && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs text-gray-600 uppercase tracking-widest">
              Alpha vs Benchmark
            </p>
            <span className="text-xs text-gray-700 normal-case">(KOSPI / KOSDAQ)</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-2">
            {/* Alpha 5D */}
            <div className="bg-gray-800/50 rounded-lg px-3 py-3 space-y-0.5">
              <p className="text-xs text-gray-500">Alpha 5D</p>
              <p className={`text-lg font-bold tabular-nums leading-tight ${colorVal(a5primary)}`}>
                {fmt(a5primary)}
              </p>
              <p className="text-xs text-gray-600">trimmed avg vs index</p>
            </div>

            {/* Alpha 20D — primary + secondary */}
            <div className={`rounded-lg px-3 py-3 space-y-0.5 ${
              a20primary != null && Math.abs(a20primary) >= 1
                ? 'bg-[#00D4A6]/8 border border-[#00D4A6]/20'
                : 'bg-gray-800/50'
            }`}>
              <p className="text-xs text-gray-500">Alpha 20D</p>
              <p className={`text-lg font-bold tabular-nums leading-tight ${colorVal(a20primary)}`}>
                {fmt(a20primary)}
              </p>
              {a20secondary != null && (
                <p className="text-xs text-gray-600">
                  median{' '}
                  <span className={`font-semibold ${colorVal(a20secondary)}`}>
                    {fmt(a20secondary)}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Trimmed alpha 설명 */}
          <p className="text-xs text-gray-700 leading-relaxed px-0.5">
            Trimmed alpha excludes extreme outlier events (top/bottom 5%) to better represent
            typical market behavior.
          </p>
        </div>
      )}

      {/* ── SECONDARY: Distribution ── */}
      {(s.pct_gt5_20d != null || s.pct_lt10_20d != null || s.alpha20_pos_pct != null) && (
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-2">
            20D Return Distribution
          </p>
          <div className="rounded-lg bg-gray-800/30 border border-gray-800 px-3 py-1">
            {s.alpha20_pos_pct != null && (
              <MiniStat
                label="Beats market (α > 0)"
                value={`${s.alpha20_pos_pct.toFixed(1)}%`}
                valueClass={colorHit(s.alpha20_pos_pct, false)}
              />
            )}
            {s.pct_gt5_20d != null && (
              <MiniStat
                label="Return > +5%"
                value={pct(s.pct_gt5_20d)}
                valueClass="text-emerald-400"
              />
            )}
            {s.pct_lt10_20d != null && (
              <MiniStat
                label="Return < −10%"
                value={pct(s.pct_lt10_20d)}
                valueClass="text-red-400"
              />
            )}
            {(s.max_loss_20d != null || s.max_gain_20d != null) && (
              <MiniStat
                label="Range (worst / best)"
                value={`${fmt(s.max_loss_20d)} / ${fmt(s.max_gain_20d)}`}
                valueClass="text-gray-400"
              />
            )}
          </div>
        </div>
      )}

      {/* ── Entry Return (참고) ── */}
      {s.avg_5d_open_return != null && (
        <div className="pt-1 border-t border-gray-800 flex items-center justify-between text-xs">
          <span className="text-gray-500">Avg entry return (next-open → 5D close)</span>
          <span className={`font-semibold ${colorVal(s.avg_5d_open_return)}`}>
            {fmt(s.avg_5d_open_return)}
          </span>
        </div>
      )}

      {/* ── MDD ── */}
      {s.avg_mdd != null && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Avg max drawdown</span>
          <span className="text-red-400 font-semibold">{fmt(s.avg_mdd, 1)}</span>
        </div>
      )}

      {/* ── 면책 ── */}
      <p className="text-xs text-gray-700 leading-relaxed">
        Based on DART filings since Jan 2025. Past market reactions do not guarantee future results.
      </p>
    </div>
  )
}
