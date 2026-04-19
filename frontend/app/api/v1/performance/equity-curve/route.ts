/**
 * GET /api/v1/performance/equity-curve
 * ======================================
 * 누적 수익률(equity curve) 시계열 데이터.
 *
 * event_macro_v1 전략의 RISK_ON 진입 매매를 event_date 순 정렬 후
 * 누적 수익률을 계산해 반환한다. (시작 = 100)
 *
 * Query params:
 *   strategy  - 전략명 (기본: event_macro_v1)
 *   regime    - RISK_ON | RISK_OFF | all (기본: RISK_ON)
 *
 * Plans: developer, pro
 * Cache: 3600s (1시간)
 *
 * Response:
 *   {
 *     strategy: string,
 *     regime:   string,
 *     points: [
 *       { date: "YYYY-MM-DD", equity: number, return_3d: number },
 *       ...
 *     ],
 *     final_equity: number   // 시작 100 기준 최종 equity
 *   }
 */

import { NextRequest } from 'next/server'
import { resolveApiKey, checkPlan } from '@/lib/v1/auth'
import { makeCacheKey, cacheGet, cacheSet } from '@/lib/v1/cache'
import { checkRateLimit } from '@/lib/v1/rateLimit'
import { logApiCall } from '@/lib/v1/usage'
import { formatResponse } from '@/lib/v1/format'
import { createServiceClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'

const TTL_PERFORMANCE = 3600   // 1 hour

export async function GET(req: NextRequest) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const { user, error: authError } = await resolveApiKey(req)
  if (authError) return authError

  const planError = checkPlan(user, ['developer', 'pro'])
  if (planError) return planError

  const rateLimitError = await checkRateLimit(user.id, user.plan)
  if (rateLimitError) return rateLimitError

  const _start = Date.now()

  // ── Params ───────────────────────────────────────────────────────────────────
  const p        = req.nextUrl.searchParams
  const strategy = p.get('strategy') || 'event_macro_v1'
  const regime   = p.get('regime')   || 'RISK_ON'

  // ── Cache ────────────────────────────────────────────────────────────────────
  const cacheKey = makeCacheKey('v1:performance:equity-curve', { strategy, regime })
  const cached   = await cacheGet<object>(cacheKey)
  if (cached) return formatResponse(req, cached as Record<string, unknown>)

  // ── Supabase ─────────────────────────────────────────────────────────────────
  try {
    const sb = createServiceClient()
    let query = sb
      .from('backtest_trades')
      .select('event_date, return_3d')
      .eq('strategy_name', strategy)
      .not('return_3d', 'is', null)
      .order('event_date', { ascending: true })
      .limit(10000)

    if (regime === 'RISK_ON' || regime === 'RISK_OFF') {
      query = query.eq('market_regime', regime)
    }

    const { data, error } = await query
    if (error) throw error

    // Supabase TS 추론 우회: 명시적 타입 캐스팅
    const trades = (data ?? []) as unknown as Tables<'backtest_trades'>[]

    // 누적 equity curve 계산
    let equity = 100.0
    const points = trades.map((t) => {
      const r = t.return_3d as number
      equity = equity * (1 + r / 100)
      return {
        date:      t.event_date,
        equity:    Math.round(equity * 10000) / 10000,
        return_3d: r,
      }
    })

    const result = {
      strategy,
      regime,
      points,
      final_equity: points.length > 0 ? points[points.length - 1].equity : 100,
      total_trades: points.length,
    }

    await cacheSet(cacheKey, result, TTL_PERFORMANCE)
    const res = formatResponse(req, result)
    logApiCall({ userId: user.id, plan: user.plan, endpoint: '/api/v1/performance/equity-curve', statusCode: 200, latencyMs: Date.now() - _start }).catch(() => {})
    return res
  } catch (e) {
    console.error('[v1/performance/equity-curve] DB error:', e)
    logApiCall({ userId: user.id, plan: user.plan, endpoint: '/api/v1/performance/equity-curve', statusCode: 500, latencyMs: Date.now() - _start }).catch(() => {})
    return formatResponse(req, { error: 'Failed to fetch equity curve.' }, 500)
  }
}
