/**
 * GET /api/v1/performance/trades
 * ================================
 * 백테스트 개별 매매 기록 조회 (backtest_trades 테이블).
 *
 * Query params:
 *   strategy    - 전략명 (기본: event_macro_v1)
 *   regime      - RISK_ON | RISK_OFF | all (기본: all)
 *   date_from   - YYYY-MM-DD (플랜 히스토리 제한 적용)
 *   date_to     - YYYY-MM-DD (기본: 오늘)
 *   limit       - 1~200 (기본: 100)
 *
 * Plans: developer (3d), pro (30d)
 * Cache: 3600s (1시간)
 */

import { NextRequest } from 'next/server'
import { resolveApiKey, checkPlan, PLAN_HISTORY_DAYS } from '@/lib/v1/auth'
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
  const regime   = p.get('regime')   || 'all'   // RISK_ON | RISK_OFF | all
  const plan     = user.plan
  const historyDays = PLAN_HISTORY_DAYS[plan] ?? 3

  const today    = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  const rawTo = p.get('date_to')
  const dtTo  = rawTo && /^\d{4}-\d{2}-\d{2}$/.test(rawTo) ? rawTo : todayStr

  const rawFrom    = p.get('date_from')
  let dtFromDate   = rawFrom && /^\d{4}-\d{2}-\d{2}$/.test(rawFrom)
    ? new Date(rawFrom)
    : new Date(new Date().setDate(today.getDate() - historyDays))

  const maxFrom = new Date(new Date().setDate(today.getDate() - historyDays))
  if (historyDays > 0 && dtFromDate < maxFrom) dtFromDate = maxFrom
  const dtFrom = dtFromDate.toISOString().slice(0, 10)

  const limit = Math.min(Math.max(parseInt(p.get('limit') || '100', 10), 1), 200)

  // ── Cache ────────────────────────────────────────────────────────────────────
  const cacheKey = makeCacheKey('v1:performance:trades', { strategy, regime, plan, dtFrom, dtTo, limit })
  const cached   = await cacheGet<object>(cacheKey)
  if (cached) return formatResponse(req, cached as Record<string, unknown>)

  // ── Supabase ─────────────────────────────────────────────────────────────────
  try {
    const sb = createServiceClient()
    let query = sb
      .from('backtest_trades')
      .select(
        'id, stock_code, event_date, disclosure_id, base_score, final_score, ' +
        'return_3d, return_5d, market_regime, created_at'
      )
      .eq('strategy_name', strategy)
      .gte('event_date', dtFrom)
      .lte('event_date', dtTo)
      .order('event_date', { ascending: false })
      .limit(limit)

    if (regime === 'RISK_ON' || regime === 'RISK_OFF') {
      query = query.eq('market_regime', regime)
    }

    const { data, error } = await query
    if (error) throw error

    // 간단 집계 (해당 페이지 내 통계)
    const trades = data ?? []
    const returns = trades.map(t => t.return_3d).filter((r): r is number => r !== null)
    const winCount = returns.filter(r => r > 0).length
    const summary = {
      count:    trades.length,
      win_rate: returns.length > 0 ? winCount / returns.length : null,
      avg_r3:   returns.length > 0 ? returns.reduce((s, v) => s + v, 0) / returns.length : null,
    }

    const result = {
      data:      trades,
      summary,
      strategy,
      regime,
      date_from: dtFrom,
      date_to:   dtTo,
    }

    await cacheSet(cacheKey, result, TTL_PERFORMANCE)
    const res = formatResponse(req, result)
    logApiCall({ userId: user.id, plan: user.plan, endpoint: '/api/v1/performance/trades', statusCode: 200, latencyMs: Date.now() - _start }).catch(() => {})
    return res
  } catch (e) {
    console.error('[v1/performance/trades] DB error:', e)
    logApiCall({ userId: user.id, plan: user.plan, endpoint: '/api/v1/performance/trades', statusCode: 500, latencyMs: Date.now() - _start }).catch(() => {})
    return formatResponse(req, { error: 'Failed to fetch backtest trades.' }, 500)
  }
}
