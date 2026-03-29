/**
 * GET /api/v1/sector-signals
 * ==========================
 * Sector-level sentiment aggregation (Bullish/Bearish/Neutral)
 * with confidence score and disclosure drivers.
 *
 * Plans: developer (3d), pro (30d)
 * Cache: 600s (10 min)
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveApiKey, checkPlan, PLAN_HISTORY_DAYS } from '@/lib/v1/auth'
import { makeCacheKey, cacheGet, cacheSet, TTL_SECTOR_SIGNALS } from '@/lib/v1/cache'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const { user, error: authError } = await resolveApiKey(req)
  if (authError) return authError

  const planError = checkPlan(user, ['developer', 'pro'])
  if (planError) return planError

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

  const sector = p.get('sector') || ''
  const signal = p.get('signal') || ''
  const limit  = Math.min(Math.max(parseInt(p.get('limit') || '50', 10), 1), 200)

  if (signal && !['Bullish', 'Bearish', 'Neutral'].includes(signal)) {
    return NextResponse.json(
      { error: 'signal must be Bullish, Bearish, or Neutral' },
      { status: 400 }
    )
  }

  // ── Cache ───────────────────────────────────────────────────────────────────
  const cacheKey = makeCacheKey('v1:sector-signals', {
    plan, dtFrom, dtTo, sector, signal, limit,
  })
  const cached = await cacheGet<object>(cacheKey)
  if (cached) return NextResponse.json(cached)

  // ── Supabase ────────────────────────────────────────────────────────────────
  try {
    const sb = createServiceClient()

    let query = sb
      .from('sector_signals')
      .select(
        'date, sector, sector_en, signal, confidence, ' +
        'disclosure_count, positive_count, negative_count, neutral_count, drivers'
      )
      .gte('date', dtFrom)
      .lte('date', dtTo)
      .order('date', { ascending: false })
      .order('disclosure_count', { ascending: false })

    if (sector) query = query.eq('sector', sector)
    if (signal) query = query.eq('signal', signal)

    const { data, error } = await query.limit(limit)
    if (error) throw error

    const result = {
      data:      data ?? [],
      total:     (data ?? []).length,
      date_from: dtFrom,
      date_to:   dtTo,
    }

    await cacheSet(cacheKey, result, TTL_SECTOR_SIGNALS)
    return NextResponse.json(result)
  } catch (e) {
    console.error('[v1/sector-signals] DB error:', e)
    return NextResponse.json({ error: 'Failed to fetch sector signals.' }, { status: 500 })
  }
}
