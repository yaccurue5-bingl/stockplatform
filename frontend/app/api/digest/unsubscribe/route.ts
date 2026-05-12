/**
 * /api/digest/unsubscribe
 * =======================
 * Daily Digest 이메일 수신 거부 엔드포인트.
 *
 * GET ?uid=USER_UUID  → digest_unsubscribed = true 처리 후 성공 페이지 반환
 *
 * 이메일 하단 수신 거부 링크에서 호출:
 *   https://k-marketinsight.com/api/digest/unsubscribe?uid={user.id}
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const uid = req.nextUrl.searchParams.get('uid');

  if (!uid || typeof uid !== 'string' || uid.length < 10) {
    return new NextResponse(
      html('오류', '올바르지 않은 요청입니다. 이메일의 수신 거부 링크를 다시 확인해 주세요.', false),
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }

  try {
    const sb = createServiceClient();

    const { error } = await sb
      .from('users')
      .update({ digest_unsubscribed: true })
      .eq('id', uid);

    if (error) {
      console.error('[digest/unsubscribe] update error:', error);
      return new NextResponse(
        html('오류', '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', false),
        { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    return new NextResponse(
      html(
        '수신 거부 완료',
        'Daily Digest 이메일 수신 거부가 완료되었습니다.<br>더 이상 이메일을 받지 않으실 겁니다.',
        true
      ),
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (e) {
    console.error('[digest/unsubscribe] unexpected error:', e);
    return new NextResponse(
      html('오류', '서버 오류가 발생했습니다.', false),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

function html(title: string, message: string, success: boolean): string {
  const icon = success ? '✅' : '❌';
  const color = success ? '#16a34a' : '#dc2626';
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — K-MarketInsight</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:480px;margin:80px auto;padding:0 16px;text-align:center;">
    <a href="https://k-marketinsight.com" style="display:inline-block;margin-bottom:32px;">
      <span style="font-size:20px;font-weight:700;color:#1a3fa8;">K-MarketInsight</span>
    </a>
    <div style="background:#ffffff;border-radius:16px;padding:40px 32px;box-shadow:0 1px 3px rgba(0,0,0,.08);">
      <div style="font-size:48px;margin-bottom:16px;">${icon}</div>
      <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#111827;">${title}</h1>
      <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">${message}</p>
      <a href="https://k-marketinsight.com"
         style="display:inline-block;padding:12px 28px;background:#1a3fa8;color:#fff;
                border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
        홈으로 돌아가기
      </a>
    </div>
    <p style="margin-top:20px;font-size:12px;color:#9ca3af;">
      문의: <a href="mailto:support@k-marketinsight.com" style="color:#6b7280;">support@k-marketinsight.com</a>
    </p>
  </div>
</body>
</html>`;
}
