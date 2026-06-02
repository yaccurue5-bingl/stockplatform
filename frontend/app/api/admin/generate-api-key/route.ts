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
import { Resend } from 'resend'
import crypto from 'crypto'

const VALID_PLANS = ['free', 'developer', 'starter', 'pro', 'enterprise'] as const
type ValidPlan = typeof VALID_PLANS[number]

const FROM_EMAIL = 'K-MarketInsight <support@k-marketinsight.com>'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

function buildApiKeyReadyHtml(plan: string): string {
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1)
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Your API Key is Ready</title></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:#0b1f3a;padding:24px;text-align:center;color:#fff;">
            <h1 style="margin:0;font-size:22px;">K-MarketInsight</h1>
            <p style="margin:8px 0 0;font-size:14px;opacity:.8;">AI-powered Korean Market Intelligence</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;color:#333;">
            <h2 style="margin-top:0;">🔑 Your API Key is Ready</h2>
            <p style="line-height:1.6;">Your <strong>${planLabel}</strong> subscription is now active.</p>
            <p style="line-height:1.6;">Your API key has been generated and is waiting for you. Visit your API Key page to view it and get started:</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="https://k-marketinsight.com/api-key" style="background:#2563eb;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;display:inline-block;font-weight:bold;">
                View My API Key →
              </a>
            </div>
            <p style="line-height:1.6;font-size:13px;color:#666;">
              Keep your API key secure — treat it like a password. Do not share it publicly.<br>
              If you need to rotate your key, contact us at support@k-marketinsight.com.
            </p>
            <p style="line-height:1.6;">— K-MarketInsight Team</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f1f5f9;padding:20px;text-align:center;font-size:12px;color:#666;">
            <p style="margin:0;">© 2026 K-MarketInsight. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
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
  let body: { email?: string; plan?: string; note?: string; send_email?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email      = (body.email ?? '').trim().toLowerCase()
  const plan       = (body.plan  ?? '').trim().toLowerCase() as ValidPlan
  const note       = (body.note  ?? '').trim()
  const sendEmail  = body.send_email === true

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

  // ── 5. 이메일 발송 (send_email: true 일 때만) ───────────────────────────────
  let emailSent = false
  if (sendEmail) {
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      try {
        const resend = new Resend(resendKey)
        const { error: mailError } = await resend.emails.send({
          from:    FROM_EMAIL,
          to:      [email],
          replyTo: 'support@k-marketinsight.com',
          subject: '🔑 Your API Key is Ready — K-MarketInsight',
          html:    buildApiKeyReadyHtml(plan),
        })
        if (mailError) {
          console.error('[admin/generate-api-key] 이메일 발송 실패:', mailError)
        } else {
          emailSent = true
          console.log(`[admin/generate-api-key] 이메일 발송 완료: ${email}`)
        }
      } catch (mailErr) {
        console.error('[admin/generate-api-key] 이메일 예외:', mailErr)
      }
    } else {
      console.warn('[admin/generate-api-key] RESEND_API_KEY 없음 — 이메일 스킵')
    }
  }

  // ── 6. Response ─────────────────────────────────────────────────────────────
  return NextResponse.json({
    success:       true,
    email,
    plan,
    api_key:       apiKey,
    created_at:    now,
    replaced_key:  prevKey ? true : false,
    previous_plan: prevPlan !== plan ? prevPlan : undefined,
    note:          note || undefined,
    email_sent:    emailSent,
  })
}
