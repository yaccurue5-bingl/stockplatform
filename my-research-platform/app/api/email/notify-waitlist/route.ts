import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FROM_EMAIL = 'K-MarketInsight <noreply@k-marketinsight.com>';

// 런치 알림 이메일 템플릿
const getLaunchEmailHtml = (siteUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0a0a0a; color: #ffffff; margin: 0; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #111111; border-radius: 16px; overflow: hidden;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%); padding: 40px 30px; text-align: center;">
      <h1 style="margin: 0; font-size: 28px; font-weight: bold;">K-MarketInsight</h1>
      <p style="margin: 10px 0 0; color: #93c5fd; font-size: 14px;">Korean Stock Market Intelligence</p>
    </div>

    <!-- Content -->
    <div style="padding: 40px 30px;">
      <h2 style="margin: 0 0 20px; font-size: 24px; color: #ffffff;">We're Live! 🎉</h2>

      <p style="color: #9ca3af; line-height: 1.6; margin-bottom: 20px;">
        Thank you for joining our waitlist! We're excited to announce that K-MarketInsight is now officially launched.
      </p>

      <p style="color: #9ca3af; line-height: 1.6; margin-bottom: 30px;">
        Start exploring AI-powered analysis and translations of Korean stock market disclosures today.
      </p>

      <a href="${siteUrl}" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
        Explore K-MarketInsight →
      </a>
    </div>

    <!-- Footer -->
    <div style="padding: 20px 30px; border-top: 1px solid #333; text-align: center;">
      <p style="color: #6b7280; font-size: 12px; margin: 0;">
        © 2026 K-MarketInsight. All rights reserved.
      </p>
      <p style="color: #6b7280; font-size: 11px; margin: 10px 0 0;">
        You received this email because you signed up for our waitlist.
      </p>
    </div>
  </div>
</body>
</html>
`;

export async function POST(request: Request) {
  try {
    // 인증 확인 (CRON_SECRET_TOKEN 또는 관리자 인증)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET_TOKEN;

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 아직 알림 안 받은 waitlist 사용자 조회
    const { data: waitlistUsers, error: fetchError } = await supabase
      .from('waitlist')
      .select('id, email')
      .is('notified_at', null)
      .eq('subscribed', true);

    if (fetchError) {
      console.error('Failed to fetch waitlist:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch waitlist users' },
        { status: 500 }
      );
    }

    if (!waitlistUsers || waitlistUsers.length === 0) {
      return NextResponse.json(
        { message: 'No users to notify', count: 0 },
        { status: 200 }
      );
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://k-marketinsight.com';
    const emailHtml = getLaunchEmailHtml(siteUrl);

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    // 각 사용자에게 이메일 발송 (배치 처리)
    for (const user of waitlistUsers) {
      try {
        const { error: sendError } = await resend.emails.send({
          from: FROM_EMAIL,
          to: user.email,
          subject: '🚀 K-MarketInsight is Now Live!',
          html: emailHtml,
        });

        if (sendError) {
          failCount++;
          errors.push(`${user.email}: ${sendError.message}`);
        } else {
          successCount++;

          // 발송 성공 시 notified_at 업데이트
          await supabase
            .from('waitlist')
            .update({ notified_at: new Date().toISOString() })
            .eq('id', user.id);
        }
      } catch (err) {
        failCount++;
        errors.push(`${user.email}: Unknown error`);
      }

      // Rate limiting: Resend 무료 플랜 제한 대응
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Waitlist notification: ${successCount} sent, ${failCount} failed`);

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Notify waitlist error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
