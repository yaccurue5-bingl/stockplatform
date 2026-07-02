/**
 * GET /api/admin/approve-api-key?token=<hmac>&uid=<userId>&exp=<timestamp>
 *
 * 관리자 알림 이메일의 "Send Key to User" 버튼 → 이 엔드포인트 호출
 * → DB에서 기존 api_key 조회 → 유저에게 키 이메일 발송
 *
 * 토큰: HMAC-SHA256(uid:exp, CRON_SECRET_TOKEN) — 7일 유효
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import crypto from 'crypto'

const FROM_EMAIL = 'K-MarketInsight <support@k-marketinsight.com>'
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7일

function makeToken(uid: string, exp: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${uid}:${exp}`).digest('hex')
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
            <p style="line-height:1.6;">Your API key has been generated and is waiting for you:</p>
            <div style="text-align:center;margin:32px 0;">
              <a href="https://k-marketinsight.com/api-key"
                style="background:#2563eb;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;display:inline-block;font-weight:bold;">
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const uid   = searchParams.get('uid')   ?? ''
  const exp   = searchParams.get('exp')   ?? ''
  const token = searchParams.get('token') ?? ''

  // ── 1. 파라미터 확인 ────────────────────────────────────────────────────────
  if (!uid || !exp || !token) {
    return new NextResponse('Missing parameters', { status: 400 })
  }

  // ── 2. 만료 확인 ────────────────────────────────────────────────────────────
  const expMs = parseInt(exp, 10)
  if (isNaN(expMs) || Date.now() > expMs) {
    return new NextResponse('Link expired', { status: 410 })
  }

  // ── 3. 토큰 검증 ────────────────────────────────────────────────────────────
  const secret = process.env.CRON_SECRET_TOKEN
  if (!secret) {
    console.error('[approve-api-key] CRON_SECRET_TOKEN not set')
    return new NextResponse('Server configuration error', { status: 500 })
  }

  const expected = makeToken(uid, exp, secret)
  if (!crypto.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'))) {
    return new NextResponse('Invalid token', { status: 401 })
  }

  // ── 4. 유저 조회 ────────────────────────────────────────────────────────────
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: user, error } = await sb
    .from('users')
    .select('id, email, api_key, plan')
    .eq('id', uid)
    .maybeSingle()

  if (error || !user) {
    console.error('[approve-api-key] user lookup failed:', error)
    return new NextResponse('User not found', { status: 404 })
  }

  // ── 5. 키 없으면 자동 생성 ─────────────────────────────────────────────────
  if (!user.api_key) {
    const newKey = crypto.randomBytes(32).toString('hex')
    const { error: updateErr } = await sb
      .from('users')
      .update({
        api_key: newKey,
        api_key_created_at: new Date().toISOString(),
        plan: user.plan ?? 'starter',
        updated_at: new Date().toISOString(),
      })
      .eq('id', uid)
    if (updateErr) {
      console.error('[approve-api-key] 키 생성 실패:', updateErr)
      return new NextResponse('Failed to generate API key', { status: 500 })
    }
    user.api_key = newKey
    console.log(`[approve-api-key] 🔑 키 신규 생성: user=${uid}`)
  }

  // ── 7. 이메일 발송 ──────────────────────────────────────────────────────────
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    return new NextResponse('RESEND_API_KEY not configured', { status: 500 })
  }

  const resend = new Resend(resendKey)
  const { error: mailError } = await resend.emails.send({
    from:    FROM_EMAIL,
    to:      [user.email],
    replyTo: 'support@k-marketinsight.com',
    subject: '🔑 Your API Key is Ready — K-MarketInsight',
    html:    buildApiKeyReadyHtml(user.plan ?? 'starter'),
  })

  if (mailError) {
    console.error('[approve-api-key] 이메일 발송 실패:', mailError)
    return new NextResponse('Email send failed', { status: 502 })
  }

  console.log(`[approve-api-key] ✅ 이메일 발송 완료: ${user.email} (user=${uid})`)

  // ── 8. 브라우저 확인 페이지 ─────────────────────────────────────────────────
  return new NextResponse(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:60px;">
      <h2>✅ Key email sent</h2>
      <p>API key notification sent to <strong>${user.email}</strong>.</p>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  )
}

// 관리자 알림 이메일용 approve URL 생성 헬퍼 (paddle webhook에서 사용)
export function buildApproveUrl(userId: string, secret: string): string {
  const exp   = (Date.now() + TOKEN_TTL_MS).toString()
  const token = makeToken(userId, exp, secret)
  return `https://k-marketinsight.com/api/admin/approve-api-key?uid=${userId}&exp=${exp}&token=${token}`
}
