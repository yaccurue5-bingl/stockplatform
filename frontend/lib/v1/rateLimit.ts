/**
 * lib/v1/rateLimit.ts
 * ===================
 * 플랜별 API 호출 quota 검사.
 *
 * 플랜 quota:
 *   free      → 50 calls / day
 *   developer → 8,000 calls / month
 *   pro       → 80,000 calls / month
 *
 * 방식:
 *   - api_usage_daily 테이블에서 현재 사용량 조회
 *   - 초과 시 429 반환
 *   - Supabase service role로 조회 (RLS 우회)
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export const PLAN_QUOTA = {
  free:      { window: 'daily',   limit: 50 },
  developer: { window: 'monthly', limit: 8_000 },
  pro:       { window: 'monthly', limit: 80_000 },
} as const

type Plan = keyof typeof PLAN_QUOTA

function getWindowDates(window: 'daily' | 'monthly'): { from: string; to: string } {
  const now = new Date()
  if (window === 'daily') {
    const today = now.toISOString().slice(0, 10)
    return { from: today, to: today }
  }
  // monthly: first day of current month → today
  const from = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString().slice(0, 10)
  const to = now.toISOString().slice(0, 10)
  return { from, to }
}

export async function checkRateLimit(
  userId: string,
  plan: string,
): Promise<NextResponse | null> {
  const p = (plan as Plan) in PLAN_QUOTA ? (plan as Plan) : 'free'
  const { window, limit } = PLAN_QUOTA[p]
  const { from, to } = getWindowDates(window)

  try {
    const sb = createServiceClient()

    const { data, error } = await (sb as any)
      .from('api_usage_daily')
      .select('call_count')
      .eq('user_id', userId)
      .gte('date', from)
      .lte('date', to)

    if (error) {
      console.error('[rateLimit] DB error:', error)
      return null // DB 오류 시 차단하지 않음 (fail-open)
    }

    const used = (data ?? []).reduce((sum: number, r: any) => sum + (r.call_count ?? 0), 0)
    const remaining = Math.max(0, limit - used)

    if (used >= limit) {
      const resetLabel =
        window === 'daily'
          ? 'tomorrow'
          : `${new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString().slice(0, 10)}`

      return NextResponse.json(
        {
          error: 'Rate limit exceeded.',
          plan,
          used,
          limit,
          reset: resetLabel,
          upgrade_url: 'https://k-marketinsight.com/pricing',
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit':     String(limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset':     resetLabel,
            'Retry-After':           window === 'daily' ? '86400' : '2592000',
          },
        },
      )
    }

    return null // OK — 통과
  } catch (e) {
    console.error('[rateLimit] unexpected error:', e)
    return null // fail-open
  }
}
