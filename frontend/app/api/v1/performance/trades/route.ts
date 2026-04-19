/**
 * GET /api/v1/performance/trades
 * ================================
 * 백테스트 개별 매매 기록 조회 (backtest_trades 테이블).
 *
 * 백테스트 데이터는 과거 전체 히스토리가 의미 있으므로
 * 날짜 범위 제한 대신 플랜별 레코드 수 상한으로 제어한다.
 *   developer : 최대 50건
 *   pro        : 최대 500건
 *
 * Query params:
 *   strategy    - 전략명 (기본: event_macro_v1)
 *   regime      - RISK_ON | RISK_OFF | all (기본: all)
 *   limit       - 요청 건수 (플랜 상한 이하, 기본: 50)
 *   offset      - 페이지네이션 offset (기본: 0)
 *
 * Plans: developer, pro
 * Cache: 3600s (1시간)
 */

import { NextRequest } from 'next/server'
import { resolveApiKey, checkPlan } from '@/lib/v1/auth'
import { makeCacheKey, cacheGet, cacheSet } from '@/lib/v1/cache'
import { checkRateLimit } from '@/lib/v1/rateLimit'
import { logApiCall } from '@/lib/v1/usage'
import { formatResponse } from '@/lib/v1/format'
import { createServiceClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'

type BacktestTrade = Tables<'backtest_trades'>

const TTL_PERFORMANCE = 3600   // 1 hour

// 플랜별 최대 조회 레코드 수
const PLAN_TRADE_LIMIT: Record<string, number> = {
  developer: 50,
  pro:       500,
}

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

  const maxLimit = PLAN_TRADE_LIMIT[plan] ?? 50
  const limit    = Math.min(Math.max(parseInt(p.get('limit') || String(maxLimit), 10), 1), maxLimit)
  const offset   = Math.max(parseInt(p.get('offset') || '0', 10), 0)

  // ── Cache ────────────────────────────────────────────────────────────────────
  const cacheKey = makeCacheKey('v1:performance:trades', { strategy, regime, plan, limit, offset })
  const cached   = await cacheGet<object>(cacheKey)
  if (cached) return formatResponse(req, cached as Record<string, unknown>)

  // ── Supabase ─────────────────────────────────────────────────────────────────
  try {
    const sb = createServiceClient()
    let query = sb
      .from('backtest_trades')
      .select(
        'id, stock_code, event_date, disclosure_id, base_score, final_score, ' +
        'return_3d, return_5d, market_regime, created_at',
        { count: 'exact' }
      )
      .eq('strategy_name', strategy)
      .order('event_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (regime === 'RISK_ON' || regime === 'RISK_OFF') {
      query = query.eq('market_regime', regime)
    }

    const { data, error, count } = await query
    if (error) throw error

    // 페이지 내 간단 집계 (Supabase TS 추론 우회: 명시적 타입 캐스팅)
    const trades = (data ?? []) as BacktestTrade[]
    const returns = trades.map(t => t.return_3d).filter((r): r is number => r !== null)
    const winCount = returns.filter(r => r > 0).length
    const pageSummary = {
      count:    trades.length,
      win_rate: returns.length > 0 ? winCount / returns.length : null,
      avg_r3:   returns.length > 0 ? returns.reduce((s, v) => s + v, 0) / returns.length : null,
    }

    const result = {
      data:         trades,
      page_summary: pageSummary,
      total:        count ?? null,
      limit,
      offset,
      strategy,
      regime,
      plan_limit:   maxLimit,
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
