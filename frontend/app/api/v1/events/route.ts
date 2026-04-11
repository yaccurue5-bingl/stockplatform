/**
 * GET /api/v1/events
 * ==================
 * Event type statistics (avg 5d/20d return) + recent event list.
 *
 * Plans: developer (3d), pro (30d)
 * Cache: 3600s (60 min)
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveApiKey, checkPlan, PLAN_HISTORY_DAYS } from '@/lib/v1/auth'
import { makeCacheKey, cacheGet, cacheSet, TTL_EVENTS } from '@/lib/v1/cache'
import { checkRateLimit } from '@/lib/v1/rateLimit'
import { logApiCall } from '@/lib/v1/usage'
import { formatResponse } from '@/lib/v1/format'
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

  const dtFromStr = dtFrom.replace(/-/g, '')
  const dtToStr   = dtTo.replace(/-/g, '')

  const stockCode = p.get('stock_code') || ''
  const eventType = p.get('event_type') || ''
  const limit     = Math.min(Math.max(parseInt(p.get('limit') || '50', 10), 1), 200)

  // ── Cache ───────────────────────────────────────────────────────────────────
  const cacheKey = makeCacheKey('v1:events', {
    plan, dtFrom, dtTo, stockCode, eventType, limit,
  })
  const cached = await cacheGet<object>(cacheKey)
  if (cached) return formatResponse(req, cached as Record<string, unknown>)

  // ── Supabase ────────────────────────────────────────────────────────────────
  try {
    const sb = createServiceClient()

    // ① event_stats — avg return per event type
    let statQuery = sb
      .from('event_stats')
      .select('event_type, avg_5d_return, avg_20d_return, std_5d, sample_size')
      .order('sample_size', { ascending: false })
    if (eventType) statQuery = statQuery.eq('event_type', eventType)

    const { data: statsData, error: statsErr } = await statQuery
    if (statsErr) throw statsErr

    // ② recent events — disclosure_insights
    let evQuery = sb
      .from('disclosure_insights')
      .select('stock_code, corp_name, corp_name_en, event_type, rcept_dt, final_score, signal_tag')
      .gte('rcept_dt', dtFromStr)
      .lte('rcept_dt', dtToStr)
      .not('event_type', 'is', null)
      .eq('is_visible', true)
      .order('rcept_dt', { ascending: false })

    if (stockCode) evQuery = evQuery.eq('stock_code', stockCode)
    if (eventType) evQuery = evQuery.eq('event_type', eventType)

    const { data: evData, error: evErr } = await evQuery.limit(limit)
    if (evErr) throw evErr

    const recentEvents = (evData ?? []).map((row: any) => ({
      stock_code:       row.stock_code,
      corp_name:        (row.corp_name_en as string | null) || row.corp_name,
      event_type:       row.event_type,
      disclosure_date:  row.rcept_dt,
      final_score:      row.final_score,
      signal_tag:       row.signal_tag,
    }))

    const result = {
      statistics:    statsData ?? [],
      recent_events: recentEvents,
      date_from:     dtFrom,
      date_to:       dtTo,
    }

    await cacheSet(cacheKey, result, TTL_EVENTS)
    const res = formatResponse(req, result)
    logApiCall({ userId: user.id, plan: user.plan, endpoint: '/api/v1/events', statusCode: 200, latencyMs: Date.now() - _start }).catch(() => {})
    return res
  } catch (e) {
    console.error('[v1/events] DB error:', e)
    logApiCall({ userId: user.id, plan: user.plan, endpoint: '/api/v1/events', statusCode: 500, latencyMs: Date.now() - _start }).catch(() => {})
    return formatResponse(req, { error: 'Failed to fetch events.' }, 500)
  }
}
