/**
 * EventHistoricalReaction
 * =======================
 * 이벤트 유형별 과거 시장 반응 통계를 보여주는 서버 컴포넌트.
 *
 * UI 구조:
 *   Primary    — Hit Rate + Trimmed Alpha (outlier 제거 후 대표값)
 *   Secondary  — Median Alpha + Distribution (>5%, <-10%, max/min)
 *   Contextual — By Market Cap (LARGE / MID / SMALL 버킷별 비교)
 *   Footer     — Avg MDD + Disclaimer + Grade methodology
 *
 * 데이터 출처: event_stats, event_stats_by_bucket 테이블 (EOD 배치 업데이트)
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

interface BucketStats {
  bucket:             string           // LARGE | MID | SMALL
  sample_size:        number | null
  hit_ratio:          number | null
  hit_ratio_20d:      number | null
  alpha20_trimmed:    number | null
  alpha20_median:     number | null
  avg_mdd:            number | null
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

const BUCKET_META: Record<string, { label: string; sub: string; color: string }> = {
  LARGE: { label: 'Large Cap',  sub: '> ₩1T mktcap',   color: 'text-blue-400' },
  MID:   { label: 'Mid Cap',    sub: '₩100B–₩1T',      color: 'text-purple-400' },
  SMALL: { label: 'Small Cap',  sub: '< ₩100B mktcap', color: 'text-orange-400' },
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

  // 메인 통계 + 버킷별 통계 병렬 fetch
  const [{ data, error }, { data: bktData }] = await Promise.all([
    sb
      .from('event_stats')
      .select(
        'event_type, sample_size, hit_ratio, hit_ratio_20d, ' +
        'avg_5d_open_return, alpha_5d, alpha_20d, ' +
        'alpha5_trimmed, alpha20_trimmed, alpha5_median, alpha20_median, ' +
        'alpha20_pos_pct, pct_gt5_20d, pct_lt10_20d, max_gain_20d, max_loss_20d, ' +
        'avg_mdd, signal_grade, signal_score'
      )
      .eq('event_type', eventType)
      .maybeSingle(),
    sb
      .from('event_stats_by_bucket')
      .select('bucket, sample_size, hit_ratio, hit_ratio_20d, alpha20_trimmed, alpha20_median, avg_mdd')
      .eq('event_type', eventType)
      .order('bucket'),   // LARGE → MID → SMALL
  ])

  if (error || !data) return null

  const s       = data as unknown as EventStats
  const buckets = (bktData ?? []) as unknown as BucketStats[]
  // LARGE / MID / SMALL 순서로 정렬
  const BUCKET_ORDER = ['LARGE', 'MID', 'SMALL']
  const sortedBuckets = [...buckets].sort(
    (a, b) => BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket)
  )

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
      <div className="relative flex items-start justify-between gap-3">
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
          <details className="flex-shrink-0 group">
            <summary className={`cursor-pointer list-none text-xs font-bold px-2.5 py-1 rounded-lg border ${gradeStyle}`}>
              Grade {s.signal_grade}
            </summary>
            <div className="absolute right-5 mt-2 z-10 w-64 rounded-xl border border-gray-700 bg-gray-900 shadow-xl p-4 text-xs space-y-2">
              <p className="text-gray-300 font-semibold mb-1">How we grade signals</p>
              <p className="text-gray-500 leading-relaxed">
                Score = <span className="text-gray-300">risk-adjusted return</span> (median 5D ÷ volatility,
                Sharpe-style), scaled by sample confidence (n/300, max 40% boost).
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 border-t border-gray-800">
                <span className="text-emerald-400 font-bold">A  ≥ 75</span><span className="text-gray-400">Strong positive signal</span>
                <span className="text-emerald-400 font-bold">B  60–74</span><span className="text-gray-400">Moderate positive signal</span>
                <span className="text-blue-400 font-bold">C  45–59</span><span className="text-gray-400">Neutral / inconclusive</span>
                <span className="text-yellow-400 font-bold">D  30–44</span><span className="text-gray-400">Weak or mixed signal</span>
                <span className="text-red-400 font-bold">F  &lt; 30</span><span className="text-gray-400">Negative signal</span>
              </div>
              <p className="text-gray-600 leading-relaxed pt-1 border-t border-gray-800">
                Grade reflects risk-adjusted consistency, not absolute return size.
                A lower-return but stable event type may outgrade a high-variance one.
              </p>
            </div>
          </details>
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

      {/* ── Contextual: By Market Cap ── */}
      {sortedBuckets.length >= 2 && (
        <div>
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">
            By Market Cap
          </p>
          <div className={`grid gap-3 ${sortedBuckets.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {sortedBuckets.map((b) => {
              const meta = BUCKET_META[b.bucket]
              if (!meta) return null
              return (
                <div key={b.bucket} className="rounded-lg bg-gray-800/40 border border-gray-800 px-3 py-3 space-y-2">
                  {/* 버킷 헤더 */}
                  <div>
                    <p className={`text-xs font-bold ${meta.color}`}>{meta.label}</p>
                    <p className="text-xs text-gray-600">{meta.sub}</p>
                  </div>
                  {/* Hit Rate */}
                  <div>
                    <p className="text-xs text-gray-600 mb-0.5">Hit Rate</p>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-sm font-bold tabular-nums ${colorHit(b.hit_ratio)}`}>
                        {hitPct(b.hit_ratio)}
                      </span>
                      {b.hit_ratio_20d != null && (
                        <span className={`text-xs tabular-nums ${colorHit(b.hit_ratio_20d)}`}>
                          / {hitPct(b.hit_ratio_20d)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-700">5D / 20D</p>
                  </div>
                  {/* Alpha 20D */}
                  <div>
                    <p className="text-xs text-gray-600 mb-0.5">Alpha 20D</p>
                    <p className={`text-sm font-bold tabular-nums ${colorVal(b.alpha20_trimmed)}`}>
                      {fmt(b.alpha20_trimmed)}
                    </p>
                    <p className="text-xs text-gray-700">trimmed avg</p>
                  </div>
                  {/* 샘플 수 */}
                  <p className="text-xs text-gray-700 pt-1 border-t border-gray-800/60">
                    n={b.sample_size?.toLocaleString() ?? '—'}
                  </p>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-700 mt-2 leading-relaxed">
            Market cap buckets: Large &gt; ₩1T · Mid ₩100B–₩1T · Small &lt; ₩100B (at time of filing).
            Min. 30 events per bucket shown.
          </p>
        </div>
      )}

      {/* ── MDD ── */}
      {s.avg_mdd != null && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Avg max drawdown</span>
          <span className="text-red-400 font-semibold">{fmt(s.avg_mdd, 1)}</span>
        </div>
      )}

      {/* ── 면책 + 채점 방법론 ── */}
      <div className="space-y-1.5 pt-1 border-t border-gray-800/60">
        <p className="text-xs text-gray-700 leading-relaxed">
          Based on DART filings since Jan 2025. Past market reactions do not guarantee future results.
        </p>
        {s.signal_grade && (
          <p className="text-xs text-gray-700 leading-relaxed">
            Signal grade: risk-adjusted return (median 5D ÷ vol, Sharpe-style) × sample confidence
            — A≥75 / B≥60 / C≥45 / D≥30.{' '}
            <span className="text-gray-600">Click the grade badge for details.</span>
          </p>
        )}
      </div>
    </div>
  )
}
