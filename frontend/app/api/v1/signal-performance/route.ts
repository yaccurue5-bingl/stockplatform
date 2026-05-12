/**
 * GET /api/v1/signal-performance
 * ================================
 * 이벤트 유형별 신호 성과 통계 (event_stats 테이블).
 *
 * Query params:
 *   event_type  - 필터 (선택) e.g. EARNINGS, CONTRACT, DILUTION
 *
 * Response fields:
 *   event_type        — 이벤트 유형
 *   sample_size       — 전체 이벤트 수
 *   hit_ratio_5d      — 5일 후 수익 달성 비율 (%)
 *   hit_ratio_20d     — 20일 후 수익 달성 비율 (%)
 *   avg_5d_open_return— 공시 다음날 시가 매수 기준 5일 평균 수익률 (%)
 *   avg_5d_return     — 종가 기준 5일 평균 수익률 (%)
 *   avg_20d_return    — 종가 기준 20일 평균 수익률 (%)
 *   alpha_5d          — 5일 수익률 - 벤치마크(KOSPI/KOSDAQ) 수익률 (%)
 *   alpha_20d         — 20일 수익률 - 벤치마크 수익률 (%)
 *   avg_mdd           — 평균 최대 낙폭 (%)
 *   signal_grade      — 신호 등급 (A+/A/B/C/D)
 *   signal_score      — 종합 점수 (0–100)
 *   updated_at        — 마지막 업데이트 시각 (ISO 8601)
 *
 * Plans: starter, pro, enterprise
 * Cache: 3600s (1시간 — EOD 배치 업데이트 기준)
 */

import { NextRequest } from 'next/server'
import { resolveApiKey, checkPlan } from '@/lib/v1/auth'
import { makeCacheKey, cacheGet, cacheSet, TTL_EVENTS } from '@/lib/v1/cache'
import { checkRateLimit } from '@/lib/v1/rateLimit'
import { logApiCall } from '@/lib/v1/usage'
import { formatResponse } from '@/lib/v1/format'
import { createServiceClient } from '@/lib/supabase/server'

const ALLOWED_EVENT_TYPES = new Set([
  'EARNINGS', 'CONTRACT', 'DILUTION', 'BUYBACK',
  'RIGHTS', 'MERGER', 'SPINOFF', 'EQUITY',
])

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────────
  const { user, error: authError } = await resolveApiKey(req)
  if (authError) return authError

  const planError = checkPlan(user, ['starter', 'pro', 'enterprise'])
  if (planError) return planError

  const rateLimitError = await checkRateLimit(user.id, user.plan)
  if (rateLimitError) return rateLimitError

  const _start = Date.now()

  // ── Params ────────────────────────────────────────────────────────────────────
  const p         = req.nextUrl.searchParams
  const rawEvent  = (p.get('event_type') || '').toUpperCase().trim()
  const eventType = ALLOWED_EVENT_TYPES.has(rawEvent) ? rawEvent : ''

  // ── Cache ─────────────────────────────────────────────────────────────────────
  const cacheKey = makeCacheKey('v1:signal-performance', { eventType })
  const cached   = await cacheGet<object>(cacheKey)
  if (cached) return formatResponse(req, cached as Record<string, unknown>)

  // ── Supabase ──────────────────────────────────────────────────────────────────
  try {
    const sb = createServiceClient()

    let query = sb
      .from('event_stats')
      .select(
        'event_type, sample_size, ' +
        'hit_ratio, hit_ratio_20d, ' +
        'avg_5d_open_return, avg_5d_return, avg_20d_return, ' +
        'alpha_5d, alpha_20d, ' +
        'alpha5_trimmed, alpha20_trimmed, alpha5_median, alpha20_median, ' +
        'alpha20_pos_pct, pct_gt5_20d, pct_lt10_20d, max_gain_20d, max_loss_20d, ' +
        'avg_mdd, signal_grade, signal_score, updated_at'
      )
      .order('signal_score', { ascending: false })

    if (eventType) query = query.eq('event_type', eventType)

    const { data, error: dbErr } = await query
    if (dbErr) throw dbErr

    const rows = (data ?? []).map((r: any) => ({
      event_type:         r.event_type,
      sample_size:        r.sample_size,
      hit_ratio_5d:       r.hit_ratio,
      hit_ratio_20d:      r.hit_ratio_20d,
      avg_5d_open_return: r.avg_5d_open_return,
      avg_5d_return:      r.avg_5d_return,
      avg_20d_return:     r.avg_20d_return,
      alpha_5d:           r.alpha_5d,
      alpha_20d:          r.alpha_20d,
      alpha5_trimmed:     r.alpha5_trimmed,
      alpha20_trimmed:    r.alpha20_trimmed,
      alpha5_median:      r.alpha5_median,
      alpha20_median:     r.alpha20_median,
      alpha20_pos_pct:    r.alpha20_pos_pct,
      pct_gt5_20d:        r.pct_gt5_20d,
      pct_lt10_20d:       r.pct_lt10_20d,
      max_gain_20d:       r.max_gain_20d,
      max_loss_20d:       r.max_loss_20d,
      avg_mdd:            r.avg_mdd,
      signal_grade:       r.signal_grade,
      signal_score:       r.signal_score,
      updated_at:         r.updated_at,
    }))

    const result = {
      data:  rows,
      total: rows.length,
      notes: {
        alpha:   'alpha = stock_return - benchmark_return (KOSPI for KOSPI-listed, KOSDAQ for KOSDAQ-listed)',
        trimmed: 'trimmed alpha removes top/bottom 5% outliers per event type for robust estimation',
        median:  'median alpha represents the typical (50th percentile) event experience',
      },
      updated_at: rows[0]?.updated_at ?? null,
    }

    await cacheSet(cacheKey, result, TTL_EVENTS)
    const res = formatResponse(req, result)
    logApiCall({
      userId:     user.id,
      plan:       user.plan,
      endpoint:   '/api/v1/signal-performance',
      statusCode: 200,
      latencyMs:  Date.now() - _start,
    }).catch(() => {})
    return res
  } catch (e) {
    console.error('[v1/signal-performance] DB error:', e)
    logApiCall({
      userId:     user.id,
      plan:       user.plan,
      endpoint:   '/api/v1/signal-performance',
      statusCode: 500,
      latencyMs:  Date.now() - _start,
    }).catch(() => {})
    return formatResponse(req, { error: 'Failed to fetch signal performance.' }, 500)
  }
}
