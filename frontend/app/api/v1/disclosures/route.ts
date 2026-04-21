/**
 * GET /api/v1/disclosures
 * =======================
 * Corporate disclosures + AI analysis results.
 *
 * Plans:
 *   developer: last 3 days, is_visible=true, base fields + scores
 *   pro:       last 30 days, all fields including risk_factors
 *
 * Cache: 300s (5 min)
 */

import { NextRequest, NextResponse } from 'next/server'
import { resolveApiKey, checkPlan, PLAN_HISTORY_DAYS } from '@/lib/v1/auth'
import { makeCacheKey, cacheGet, cacheSet, TTL_DISCLOSURES } from '@/lib/v1/cache'
import { checkRateLimit } from '@/lib/v1/rateLimit'
import { logApiCall } from '@/lib/v1/usage'
import { formatResponse } from '@/lib/v1/format'
import { createServiceClient } from '@/lib/supabase/server'

const DEV_COLUMNS =
  'id, rcept_no, corp_name, corp_name_en, stock_code, report_nm, report_nm_en, rcept_dt, ' +
  'sentiment_score, short_term_impact_score, event_type, ai_summary, ' +
  'base_score, final_score, alpha_score, signal_tag'

const PRO_COLUMNS =
  DEV_COLUMNS + ', headline, financial_impact, base_score_raw, risk_factors'

const SORT_WHITELIST    = new Set(['rcept_dt', 'final_score', 'base_score', 'alpha_score'])
const SIGNAL_TAG_VALUES = new Set(['HIGH_CONVICTION', 'CONSTRUCTIVE', 'NEUTRAL', 'NEGATIVE', 'HIGH_RISK'])

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
  const isPro       = plan === 'pro'

  const today  = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  // date_to
  const rawTo = p.get('date_to')
  const dtTo  = rawTo && /^\d{4}-\d{2}-\d{2}$/.test(rawTo) ? rawTo : todayStr

  // date_from
  const rawFrom  = p.get('date_from')
  let dtFromDate = rawFrom && /^\d{4}-\d{2}-\d{2}$/.test(rawFrom)
    ? new Date(rawFrom)
    : new Date(new Date().setDate(today.getDate() - historyDays))

  // enforce plan limit
  const maxFrom = new Date(new Date().setDate(today.getDate() - historyDays))
  if (historyDays > 0 && dtFromDate < maxFrom) dtFromDate = maxFrom
  const dtFrom = dtFromDate.toISOString().slice(0, 10)

  // YYYYMMDD format for rcept_dt column
  const dtFromStr = dtFrom.replace(/-/g, '')
  const dtToStr   = dtTo.replace(/-/g, '')

  const stockCode      = p.get('stock_code') || ''
  const sentiment      = (p.get('sentiment') || '').toUpperCase()
  const eventType      = p.get('event_type') || ''
  const signalTag      = (p.get('signal_tag') || '').toUpperCase()
  const alphaScoreMin  = parseFloat(p.get('alpha_score_min') || 'NaN')
  const sortBy         = SORT_WHITELIST.has(p.get('sort_by') || '') ? p.get('sort_by')! : 'rcept_dt'
  const limit          = Math.min(Math.max(parseInt(p.get('limit') || '50', 10), 1), 200)

  if (sentiment && !['POSITIVE', 'NEGATIVE', 'NEUTRAL'].includes(sentiment)) {
    return NextResponse.json(
      { error: 'sentiment must be POSITIVE, NEGATIVE, or NEUTRAL' },
      { status: 400 }
    )
  }
  if (signalTag && !SIGNAL_TAG_VALUES.has(signalTag)) {
    return NextResponse.json(
      { error: `signal_tag must be one of: ${[...SIGNAL_TAG_VALUES].join(', ')}` },
      { status: 400 }
    )
  }

  // ── Cache ───────────────────────────────────────────────────────────────────
  const cacheKey = makeCacheKey('v1:disclosures', {
    plan, dtFrom: dtFromStr, dtTo: dtToStr,
    stockCode, sentiment, eventType, signalTag,
    alphaScoreMin: isNaN(alphaScoreMin) ? '' : alphaScoreMin,
    sortBy, limit,
  })
  const cached = await cacheGet<object>(cacheKey)
  if (cached) return formatResponse(req, cached as Record<string, unknown>)

  // ── Supabase ────────────────────────────────────────────────────────────────
  try {
    const sb = createServiceClient()
    const columns = isPro ? PRO_COLUMNS : DEV_COLUMNS

    let query = sb
      .from('disclosure_insights')
      .select(columns)
      .gte('rcept_dt', dtFromStr)
      .lte('rcept_dt', dtToStr)
      .eq('analysis_status', 'completed')
      .order(sortBy, { ascending: false, nullsFirst: false })

    if (!isPro) query = query.eq('is_visible', true)
    if (stockCode) query = query.eq('stock_code', stockCode)
    if (eventType) query = query.eq('event_type', eventType)
    if (signalTag)  query = query.eq('signal_tag', signalTag)
    if (!isNaN(alphaScoreMin)) query = query.gte('alpha_score', alphaScoreMin)
    if (sentiment === 'POSITIVE') query = query.gte('sentiment_score', 0.3)
    else if (sentiment === 'NEGATIVE') query = query.lte('sentiment_score', -0.3)
    else if (sentiment === 'NEUTRAL') query = query.gt('sentiment_score', -0.3).lt('sentiment_score', 0.3)

    const { data, error } = await query.limit(limit)
    if (error) throw error

    const rows = (data ?? []).map((row: any) => ({
      ...row,
      corp_name:   row.corp_name_en  || row.corp_name,
      report_name: row.report_nm_en  || row.report_nm,
      // remove raw Korean / _en fields from output
      corp_name_en:  undefined,
      report_nm:     undefined,
      report_nm_en:  undefined,
    }))

    const result = {
      data:      rows,
      total:     rows.length,
      date_from: dtFrom,
      date_to:   dtTo,
    }

    await cacheSet(cacheKey, result, TTL_DISCLOSURES)
    const res = formatResponse(req, result)
    logApiCall({ userId: user.id, plan: user.plan, endpoint: '/api/v1/disclosures', statusCode: 200, latencyMs: Date.now() - _start }).catch(() => {})
    return res
  } catch (e) {
    console.error('[v1/disclosures] DB error:', e)
    logApiCall({ userId: user.id, plan: user.plan, endpoint: '/api/v1/disclosures', statusCode: 500, latencyMs: Date.now() - _start }).catch(() => {})
    return formatResponse(req, { error: 'Failed to fetch disclosures.' }, 500)
  }
}
