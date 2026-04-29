import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const resend  = new Resend(process.env.RESEND_API_KEY);
const FROM    = 'K-MarketInsight <support@k-marketinsight.com>';
const ADMIN   = process.env.CONTACT_RECIPIENT_EMAIL ?? '';

// ── 관리자 알림 HTML ──────────────────────────────────────────
function adminHtml(email: string, plan: string, useCase: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>New Lead</title></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
        style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#0b1f3a;padding:24px;text-align:center;color:#fff;">
            <h1 style="margin:0;font-size:20px;">🔔 New Access Request</h1>
            <p style="margin:6px 0 0;font-size:13px;opacity:.75;">K-MarketInsight Pricing Lead</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;color:#333;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;">
                <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;">Plan</p>
                <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#2563eb;">${plan}</p>
              </td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;">
                <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;">Email</p>
                <p style="margin:4px 0 0;font-size:15px;">
                  <a href="mailto:${email}" style="color:#2563eb;">${email}</a>
                </p>
              </td></tr>
              <tr><td style="padding:10px 0;">
                <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;">Use Case</p>
                <p style="margin:8px 0 0;font-size:14px;line-height:1.7;white-space:pre-wrap;">${useCase || '—'}</p>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f1f5f9;padding:16px;text-align:center;font-size:12px;color:#888;">
            k-marketinsight.com · Pricing Lead
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── 사용자 자동응답 HTML ─────────────────────────────────────
function userHtml(plan: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Access Request Received</title></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
        style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:#0b1f3a;padding:24px;text-align:center;color:#fff;">
            <h1 style="margin:0;font-size:22px;">K-MarketInsight</h1>
            <p style="margin:8px 0 0;font-size:14px;opacity:.8;">AI-powered Korean Market Intelligence</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;color:#333;">
            <h2 style="margin-top:0;">Request Received ✅</h2>
            <p style="line-height:1.7;">
              Thanks for your interest in the <strong>${plan}</strong> plan.
            </p>
            <p style="line-height:1.7;">
              We've received your request and will review it shortly.
              You'll hear from us within <strong>1–2 business days</strong>.
            </p>
            <p style="line-height:1.7;">
              In the meantime, feel free to explore our API documentation:
            </p>
            <div style="text-align:center;margin:28px 0;">
              <a href="https://k-marketinsight.com/api-docs"
                style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;display:inline-block;font-weight:bold;">
                View API Docs →
              </a>
            </div>
            <p style="line-height:1.7;">— K-MarketInsight Team</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f1f5f9;padding:16px;text-align:center;font-size:12px;color:#888;">
            © 2026 K-MarketInsight ·
            <a href="https://k-marketinsight.com" style="color:#2563eb;text-decoration:none;">Website</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── POST handler ─────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email   = (body.email   ?? '').trim();
    const useCase = (body.useCase ?? '').trim();
    const plan    = (body.plan    ?? 'Unknown').trim();

    // 기본 유효성 검사
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required.' }, { status: 400 });
    }

    // 1. DB 저장
    const { error: dbError } = await supabase.from('leads').insert([
      { email, use_case: useCase, plan, source: 'pricing' },
    ]);
    if (dbError) {
      console.error('[request-access] DB insert error:', dbError);
      // DB 실패해도 이메일은 발송 (운영 연속성)
    }

    // 2. 관리자 알림 + 3. 사용자 자동응답 — 병렬 발송
    const [adminResult, userResult] = await Promise.allSettled([
      ADMIN
        ? resend.emails.send({
            from:    FROM,
            to:      [ADMIN],
            replyTo: email,
            subject: `[Lead] ${plan} — ${email}`,
            html:    adminHtml(email, plan, useCase),
          })
        : Promise.resolve(null),

      resend.emails.send({
        from:    FROM,
        to:      [email],
        subject: 'Access Request Received — K-MarketInsight',
        html:    userHtml(plan),
      }),
    ]);

    if (adminResult.status === 'rejected') {
      console.error('[request-access] Admin email failed:', adminResult.reason);
    }
    if (userResult.status === 'rejected') {
      console.error('[request-access] User email failed:', userResult.reason);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[request-access] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
