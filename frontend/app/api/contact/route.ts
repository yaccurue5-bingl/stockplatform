import { Resend } from 'resend';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY);

// 수신: 실제 받은편지함 (Gmail 등) — CONTACT_RECIPIENT_EMAIL 환경변수로 지정
const SUPPORT_EMAIL = process.env.CONTACT_RECIPIENT_EMAIL ?? '';
const FROM_EMAIL    = 'K-MarketInsight <support@k-marketinsight.com>';

function buildContactHtml(name: string, email: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>New Contact Inquiry</title></head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
        style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#0b1f3a;padding:24px;text-align:center;color:#ffffff;">
            <h1 style="margin:0;font-size:20px;">New Contact Inquiry</h1>
            <p style="margin:6px 0 0;font-size:13px;opacity:0.75;">K-MarketInsight Contact Form</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;color:#333;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #eee;">
                  <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.05em;">Name</p>
                  <p style="margin:4px 0 0;font-size:15px;font-weight:600;">${name}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;border-bottom:1px solid #eee;">
                  <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.05em;">Email</p>
                  <p style="margin:4px 0 0;font-size:15px;">
                    <a href="mailto:${email}" style="color:#2563eb;">${email}</a>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0;">
                  <p style="margin:0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.05em;">Message</p>
                  <p style="margin:8px 0 0;font-size:14px;line-height:1.7;white-space:pre-wrap;">${message}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f1f5f9;padding:16px;text-align:center;font-size:12px;color:#888;">
            Sent via k-marketinsight.com contact form
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, message } = body as {
      name?: string;
      email?: string;
      message?: string;
    };

    if (!SUPPORT_EMAIL) {
      console.error('[contact] CONTACT_RECIPIENT_EMAIL not set');
      return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 });
    }

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }

    // 기본 이메일 형식 검사
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    }

    const { error } = await resend.emails.send({
      from:    FROM_EMAIL,
      to:      [SUPPORT_EMAIL],
      replyTo: email,
      subject: `[Contact] ${name} — ${message.slice(0, 60)}`,
      html:    buildContactHtml(name.trim(), email.trim(), message.trim()),
    });

    if (error) {
      console.error('[contact] Resend error:', error);
      return NextResponse.json({ error: 'Failed to send message.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[contact] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
