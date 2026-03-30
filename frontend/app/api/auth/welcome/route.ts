export const dynamic = 'force-dynamic';

import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FROM_EMAIL = 'K-MarketInsight <support@k-marketinsight.com>';

function buildWelcomeHtml(userName: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Welcome to K-MarketInsight</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f7fa; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f7fa; padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 20px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td style="background:#0b1f3a; padding:24px; text-align:center; color:#ffffff;">
              <h1 style="margin:0; font-size:22px;">K-MarketInsight</h1>
              <p style="margin:8px 0 0; font-size:14px; opacity:0.8;">
                AI-powered Korean Market Intelligence
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px; color:#333333;">
              <h2 style="margin-top:0;">Welcome aboard 👋</h2>
              <p style="line-height:1.6;">
                Hi <strong>${userName}</strong>,
              </p>
              <p style="line-height:1.6;">
                Welcome to <strong>K-MarketInsight</strong>.
                You now have access to structured, AI-powered insights into the Korean stock market —
                built specifically for global investors.
              </p>
              <p style="line-height:1.6;">
                Here's what you can start exploring right away:
              </p>
              <ul style="line-height:1.8; padding-left:18px;">
                <li>📊 AI-analyzed disclosures (DART filings)</li>
                <li>⚡ Real-time signal detection</li>
                <li>📈 Structured financial insights</li>
                <li>🌏 English-translated corporate data</li>
              </ul>
              <!-- CTA Button -->
              <div style="text-align:center; margin:32px 0;">
                <a href="https://k-marketinsight.com/dashboard"
                   style="background:#2563eb; color:#ffffff; text-decoration:none; padding:14px 28px; border-radius:8px; display:inline-block; font-weight:bold;">
                  Go to Dashboard →
                </a>
              </div>
              <p style="line-height:1.6;">
                If you have any questions or need help getting started,
                feel free to reach out anytime.
              </p>
              <p style="line-height:1.6;">
                — K-MarketInsight Team
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f1f5f9; padding:20px; text-align:center; font-size:12px; color:#666;">
              <p style="margin:0;">© 2026 K-MarketInsight. All rights reserved.</p>
              <p style="margin:8px 0 0;">
                <a href="https://k-marketinsight.com" style="color:#2563eb; text-decoration:none;">
                  Visit Website
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function POST(request: Request) {
  try {
    const { email, name } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }

    // name 없으면 email prefix 사용 (예: john@gmail.com → john)
    const userName = name || email.split('@')[0];

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [email],
      subject: 'Welcome to K-MarketInsight 👋',
      html: buildWelcomeHtml(userName),
    });

    if (error) {
      console.error('[welcome-email] Resend error:', error);
      await supabase.from('mail_logs').insert({
        recipient: email,
        subject: 'Welcome to K-MarketInsight 👋',
        mail_type: 'welcome',
        status: 'failed',
        error_message: error.message,
      });
      return NextResponse.json({ error }, { status: 500 });
    }

    await supabase.from('mail_logs').insert({
      resend_id: data?.id,
      recipient: email,
      subject: 'Welcome to K-MarketInsight 👋',
      mail_type: 'welcome',
      status: 'sent',
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[welcome-email] Unexpected error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
