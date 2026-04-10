/**
 * GET /api/v1/market-radar
 * ========================
 * Daily market signal (Bullish/Bearish/Neutral), KOSPI/KOSDAQ change,
 * top sector, and summary text.
 *
 * Plans: developer (3d), pro (30d)
 * Cache: 900s (15 min)
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveApiKey, checkPlan, PLAN_HISTORY_DAYS } from '@/lib/v1/auth'
import { makeCacheKey, cacheGet, cacheSet, TTL_MARKET_RADAR } from '@/lib/v1/cache'
import { checkRateLimit } from '@/lib/v1/rateLimit'
import { logApiCall } from '@/lib/v1/usage'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { user, error: authError } = await resolveApiKey(req)
  if (authError) return authError

  const planError = checkPlan(user, ['developer', 'pro'])
  if (planError) return planError

  const rateLimitError = await checkRateLimit(user.id, user.plan)
  if (rateLimitError) return rateLimitError

  const _start = Date.now()

  // ── Params ──────────────────────────────────────────────────────────────────
  const p = req.nextUrl.searchParams
  const plan        = user.plan
  const historyDays = PLAN_HISTORY_DAYS[plan] ?? 3

  const today    = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  const rawTo = p.get('date_to')
  const dtTo  = rawTo && /^\d{4}-\d{2}-\d{2}$/.test(rawTo) ? rawTo : todayStr

  const rawFrom  = p.get('date_from')
  let dtFromDate = rawFrom && /^\d{4}-\d{2}-\d{2}$/.test(rawFrom)
    ? new Date(rawFrom)
    : new Date(new Date().setDate(today.getDate() - historyDays))

  const maxFrom = new Date(new Date().setDate(today.getDate() - historyDays))
  if (historyDays > 0 && dtFromDate < maxFrom) dtFromDate = maxFrom
  const dtFrom = dtFromDate.toISOString().slice(0, 10)

  const limit = Math.min(Math.max(parseInt(p.get('limit') || '30', 10), 1), 90)

  // ── Cache ───────────────────────────────────────────────────────────────────
  const cacheKey = makeCacheKey('v1:market-radar', { plan, dtFrom, dtTo, limit })
  const cached   = await cacheGet<object>(cacheKey)
  if (cached) return NextResponse.json(cached)

  // ── Supabase ────────────────────────────────────────────────────────────────
  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('market_radar')
      .select(
        'date, market_signal, top_sector, top_sector_en, foreign_flow, ' +
        'kospi_change, kosdaq_change, total_disclosures, summary'
      )
      .gte('date', dtFrom)
      .lte('date', dtTo)
      .order('date', { ascending: false })
      .limit(limit)

    if (error) throw error

    const result = {
      data:      data ?? [],
      total:     (data ?? []).length,
      date_from: dtFrom,
      date_to:   dtTo,
    }

    await cacheSet(cacheKey, result, TTL_MARKET_RADAR)
    const res = NextResponse.json(result)
    logApiCall({ userId: user.id, plan: user.plan, endpoint: '/api/v1/market-radar', statusCode: 200, latencyMs: Date.now() - _start }).catch(() => {})
    return res
  } catch (e) {
    console.error('[v1/market-radar] DB error:', e)
    logApiCall({ userId: user.id, plan: user.plan, endpoint: '/api/v1/market-radar', statusCode: 500, latencyMs: Date.now() - _start }).catch(() => {})
    return NextResponse.json({ error: 'Failed to fetch market radar.' }, { status: 500 })
  }
}
