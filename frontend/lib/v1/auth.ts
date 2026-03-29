/**
 * lib/v1/auth.ts
 * ==============
 * B2B API key authentication for /api/v1/* routes.
 *
 * Usage:
 *   const { user, error } = await resolveApiKey(request)
 *   if (error) return error  // NextResponse with 401/403
 *
 * Auth:
 *   Header: X-API-Key: <key>
 *   Query:  ?api_key=<key>  (legacy)
 *
 * Plans:
 *   developer → disclosures only, 3-day history
 *   pro       → all endpoints, 30-day history
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const PLAN_RANK: Record<string, number> = {
  free:      0,
  developer: 1,
  pro:       2,
}

export const PLAN_HISTORY_DAYS: Record<string, number> = {
  free:      0,
  developer: 3,
  pro:       30,
}

export interface ApiUser {
  id:    string
  email: string
  plan:  string
}

type AuthResult =
  | { user: ApiUser; error: null }
  | { user: null;    error: NextResponse }

export async function resolveApiKey(req: NextRequest): Promise<AuthResult> {
  const apiKey =
    req.headers.get('x-api-key') ||
    req.nextUrl.searchParams.get('api_key')

  if (!apiKey) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'API key required. Provide X-API-Key header or ?api_key= query param.' },
        { status: 401, headers: { 'WWW-Authenticate': 'ApiKey' } }
      ),
    }
  }

  try {
    const sb = createServiceClient()
    const { data: user } = await sb
      .from('users')
      .select('id, email, plan')
      .eq('api_key', apiKey)
      .maybeSingle()

    if (!user) {
      return {
        user: null,
        error: NextResponse.json(
          { error: 'Invalid API key.' },
          { status: 401 }
        ),
      }
    }

    return {
      user: { ...user, plan: (user.plan || 'free').toLowerCase() },
      error: null,
    }
  } catch (e) {
    console.error('[v1/auth] lookup error:', e)
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Authentication service unavailable.' },
        { status: 503 }
      ),
    }
  }
}

/** Check plan access. Returns 403 NextResponse or null (allowed). */
export function checkPlan(
  user: ApiUser,
  minPlans: string[]
): NextResponse | null {
  const plan = user.plan
  const userRank = PLAN_RANK[plan] ?? 0
  const minRank  = Math.min(...minPlans.map(p => PLAN_RANK[p] ?? 99))

  if (userRank < minRank) {
    return NextResponse.json(
      {
        error: `This endpoint requires ${minPlans.join(' or ')} plan. Your plan: ${plan}`,
      },
      { status: 403 }
    )
  }
  return null
}
