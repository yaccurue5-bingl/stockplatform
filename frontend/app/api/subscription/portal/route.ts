/**
 * POST /api/subscription/portal
 *
 * Paddle Customer Portal 세션 URL 생성.
 * 유저가 "구독 관리" 버튼을 누르면 호출 → 1회용 Portal URL 반환.
 *
 * Paddle Docs:
 *   POST /customers/{customer_id}/portal-sessions
 *   https://developer.paddle.com/api-reference/customer-portal/portal-sessions/create
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getUser } from '@/lib/supabase/server';

const PADDLE_API_BASE = 'https://api.paddle.com';

export async function POST(_req: NextRequest) {
  try {
    // 1. 로그인 확인
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Supabase에서 paddle_customer_id 조회
    const supabase = createServiceClient();
    const { data: sub, error: dbError } = await supabase
      .from('subscriptions')
      .select('paddle_customer_id, status, plan_type')
      .eq('user_id', user.id)
      .in('status', ['active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dbError) {
      console.error('DB error fetching subscription:', dbError);
      return NextResponse.json({ error: 'DB error' }, { status: 500 });
    }

    if (!sub?.paddle_customer_id) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // 3. Paddle API — Customer Portal 세션 생성
    const apiKey = process.env.PADDLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Paddle API key not configured' }, { status: 500 });
    }

    const paddleRes = await fetch(
      `${PADDLE_API_BASE}/customers/${sub.paddle_customer_id}/portal-sessions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}), // 빈 body — Paddle이 기본 포털 URL 생성
      }
    );

    if (!paddleRes.ok) {
      const errText = await paddleRes.text();
      console.error(`Paddle portal session error ${paddleRes.status}:`, errText);
      return NextResponse.json(
        { error: 'Failed to create portal session' },
        { status: 502 }
      );
    }

    const paddleData = await paddleRes.json();
    console.log('Paddle portal response:', JSON.stringify(paddleData));

    // Paddle Billing v2 실제 응답 구조:
    // { data: { urls: { general: { overview: "https://..." }, subscriptions: [...] } } }
    const portalUrl: string | undefined =
      paddleData?.data?.urls?.general?.overview      // v2 실제 경로
      ?? paddleData?.data?.urls?.customer_portal      // 구버전 fallback
      ?? paddleData?.data?.url;                       // 기타 fallback

    if (!portalUrl) {
      console.error('Unexpected Paddle portal response:', JSON.stringify(paddleData));
      return NextResponse.json({ error: 'No portal URL in response' }, { status: 502 });
    }

    return NextResponse.json({ url: portalUrl });
  } catch (err) {
    console.error('Portal session error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
