/**
 * GET /api/v1/performance/summary
 * ================================
 * 백테스트 전략 성과 요약 (performance_summary 테이블).
 *
 * Query params:
 *   strategy  - 전략명 (기본: event_macro_v1)
 *
 * Plans: developer, pro
 * Cache: 3600s (1시간 — 매일 EOD 업데이트)
 */

import { NextRequest } from 'next/server'
import { resolveApiKey, checkPlan } from '@/lib/v1/auth'
import { makeCacheKey, cacheGet, cacheSet } from '@/lib/v1/cache'
import { checkRateLimit } from '@/lib/v1/rateLimit'
import { logApiCall } from '@/lib/v1/usage'
import { formatResponse } from '@/lib/v1/format'
import { createServiceClient } from '@/lib/supabase/server'

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

  // ── Cache ────────────────────────────────────────────────────────────────────
  const cacheKey = makeCacheKey('v1:performance:summary', { strategy })
  const cached   = await cacheGet<object>(cacheKey)
  if (cached) return formatResponse(req, cached as Record<string, unknown>)

  // ── Supabase ─────────────────────────────────────────────────────────────────
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('performance_summary')
      .select(
        'strategy_name, total_return, annualized_return, win_rate, avg_return, ' +
        'max_drawdown, sharpe_ratio, total_trades, risk_on_trades, score_threshold, ' +
        'holding_days, period_start, period_end, updated_at'
      )
      .eq('strategy_name', strategy)
      .single()

    if (error && error.code !== 'PGRST116') throw error   // PGRST116 = row not found

    const result = {
      data:     data ?? null,
      strategy,
    }

    await cacheSet(cacheKey, result, TTL_PERFORMANCE)
    const res = formatResponse(req, result)
    logApiCall({ userId: user.id, plan: user.plan, endpoint: '/api/v1/performance/summary', statusCode: 200, latencyMs: Date.now() - _start }).catch(() => {})
    return res
  } catch (e) {
    console.error('[v1/performance/summary] DB error:', e)
    logApiCall({ userId: user.id, plan: user.plan, endpoint: '/api/v1/performance/summary', statusCode: 500, latencyMs: Date.now() - _start }).catch(() => {})
    return formatResponse(req, { error: 'Failed to fetch performance summary.' }, 500)
  }
}
