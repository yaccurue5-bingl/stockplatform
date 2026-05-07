/**
 * POST /api/admin/generate-api-key
 * =================================
 * 관리자용 API Key 수동 생성 엔드포인트.
 * 테스트 또는 수동 온보딩 시 사용.
 *
 * Auth:
 *   Authorization: Bearer <CRON_SECRET_TOKEN>
 *
 * Body:
 *   {
 *     email: string          — 대상 유저 이메일
 *     plan: string           — 'starter' | 'pro' | 'enterprise' | 'developer'
 *     note?: string          — 메모 (로그용, 선택)
 *   }
 *
 * Response (200):
 *   {
 *     success: true
 *     email: string
 *     plan: string
 *     api_key: string        — 생성된 키 (이 응답에서만 표시)
 *     created_at: string
 *   }
 *
 * Response (404):
 *   { error: 'User not found' }
 *   → 해당 이메일로 가입된 유저가 없음
 *     → /signup 먼저 한 뒤 재시도
 *
 * 사용 예시 (curl):
 *   curl -X POST https://k-marketinsight.com/api/admin/generate-api-key \
 *     -H "Authorization: Bearer <CRON_SECRET_TOKEN>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"email":"you@example.com","plan":"starter"}'
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const VALID_PLANS = ['free', 'developer', 'starter', 'pro', 'enterprise'] as const
type ValidPlan = typeof VALID_PLANS[number]

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET_TOKEN
  if (!secret) {
    console.error('[admin/generate-api-key] CRON_SECRET_TOKEN not set')
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Body validation ─────────────────────────────────────────────────────
  let body: { email?: string; plan?: string; note?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = (body.email ?? '').trim().toLowerCase()
  const plan  = (body.plan  ?? '').trim().toLowerCase() as ValidPlan
  const note  = (body.note  ?? '').trim()

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }
  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json(
      { error: `Invalid plan. Must be one of: ${VALID_PLANS.join(', ')}` },
      { status: 400 },
    )
  }

  // ── 3. Look up user ─────────────────────────────────────────────────────────
  const sb = getSupabase()
  const { data: user, error: lookupErr } = await sb
    .from('users')
    .select('id, email, plan, api_key')
    .eq('email', email)
    .maybeSingle()

  if (lookupErr) {
    console.error('[admin/generate-api-key] lookup error:', lookupErr)
    return NextResponse.json({ error: 'DB lookup failed' }, { status: 500 })
  }
  if (!user) {
    return NextResponse.json(
      {
        error: 'User not found',
        hint: `No account with email "${email}". Ask the user to sign up at k-marketinsight.com/signup first.`,
      },
      { status: 404 },
    )
  }

  // ── 4. Generate key ─────────────────────────────────────────────────────────
  const apiKey     = crypto.randomBytes(32).toString('hex')
  const now        = new Date().toISOString()
  const prevKey    = user.api_key ?? null
  const prevPlan   = user.plan   ?? 'free'

  const { error: updateErr } = await sb
    .from('users')
    .update({
      api_key:            apiKey,
      api_key_created_at: now,
      plan:               plan,
      updated_at:         now,
    })
    .eq('id', user.id)

  if (updateErr) {
    console.error('[admin/generate-api-key] update error:', updateErr)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }

  console.log(
    `[admin/generate-api-key] key generated: user=${user.id} email=${email} plan=${prevPlan}->${plan}` +
    (prevKey ? ' (replaced existing key)' : ' (new key)') +
    (note ? ` note="${note}"` : ''),
  )

  // ── 5. Response ─────────────────────────────────────────────────────────────
  return NextResponse.json({
    success:       true,
    email,
    plan,
    api_key:       apiKey,
    created_at:    now,
    replaced_key:  prevKey ? true : false,
    previous_plan: prevPlan !== plan ? prevPlan : undefined,
    note:          note || undefined,
  })
}
