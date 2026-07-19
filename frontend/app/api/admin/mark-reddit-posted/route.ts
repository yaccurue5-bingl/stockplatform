/**
 * GET /api/admin/mark-reddit-posted?id=<disclosure_id>&exp=<timestamp>&token=<hmac>
 *
 * Reddit 다이제스트 이메일의 "Mark as Posted" 버튼 → 이 엔드포인트 호출
 * → disclosure_insights.reddit_posted_at = now() 로 갱신 (중복 재선정 방지)
 *
 * 기존에는 터미널에서 python -c "..." 한 줄을 직접 실행해야 했는데, 매번
 * 까먹고 안 하면 같은 종목이 계속 재선정되는 문제가 있었음 — 이메일 클릭
 * 한 번으로 대체 (approve-api-key와 동일한 HMAC 토큰 링크 패턴).
 *
 * 토큰: HMAC-SHA256(id:exp, CRON_SECRET_TOKEN) — 7일 유효
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일

function makeToken(id: string, exp: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(`${id}:${exp}`).digest('hex');
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id    = searchParams.get('id')    ?? '';
  const exp   = searchParams.get('exp')   ?? '';
  const token = searchParams.get('token') ?? '';

  if (!id || !exp || !token) {
    return new NextResponse('Missing parameters', { status: 400 });
  }

  const expMs = parseInt(exp, 10);
  if (isNaN(expMs) || Date.now() > expMs) {
    return new NextResponse('Link expired', { status: 410 });
  }

  const secret = process.env.CRON_SECRET_TOKEN;
  if (!secret) {
    console.error('[mark-reddit-posted] CRON_SECRET_TOKEN not set');
    return new NextResponse('Server configuration error', { status: 500 });
  }

  const expected = makeToken(id, exp, secret);
  const tokenBuf = Buffer.from(token, 'hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  if (tokenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
    return new NextResponse('Invalid token', { status: 401 });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await sb
    .from('disclosure_insights')
    .update({ reddit_posted_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, corp_name')
    .maybeSingle();

  if (error) {
    console.error('[mark-reddit-posted] update failed:', error);
    return new NextResponse('Failed to mark as posted', { status: 500 });
  }
  if (!data) {
    return new NextResponse('Disclosure not found', { status: 404 });
  }

  console.log(`[mark-reddit-posted] ✅ marked id=${id} (${data.corp_name})`);

  return new NextResponse(
    `<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:60px;">
      <h2>✅ Marked as posted</h2>
      <p><strong>${data.corp_name ?? id}</strong> won't be re-selected for future Reddit digests.</p>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}
