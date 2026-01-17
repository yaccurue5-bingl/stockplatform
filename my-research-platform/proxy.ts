/**
 * Next.js Proxy (경비원 역할)
 *
 * 모든 요청이 페이지에 도달하기 전에 이 파일을 거쳐갑니다.
 *
 * 역할:
 * 1. 로그인 체크 (JWT 토큰 확인)
 * 2. PRO 플랜 체크 (종목 상세 페이지 접근 제한)
 * 3. Cron Job 보안 (외부에서 무단 호출 방지)
 *
 * 동작 방식:
 * - /dashboard 접근 시 → 로그인 안 했으면 /login으로 리다이렉트
 * - /stock/[code] 접근 시 → FREE 사용자면 /dashboard로 리다이렉트
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@/types/database';

export default async function proxy(req: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: req,
  });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: any) {
          cookiesToSet.forEach(({ name, value, options }: any) => {
            req.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Supabase Auth 쿠키 갱신
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;

  // -----------------------------------
  // 1. Cron Job 보안 (Authorization 체크)
  // -----------------------------------
  if (pathname.startsWith('/api/cron/')) {
    const authHeader = req.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET_TOKEN;

    if (!expectedToken) {
      console.error('[CRON] CRON_SECRET_TOKEN not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${expectedToken}`) {
      console.warn('[CRON] Unauthorized access attempt:', pathname);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // ✅ 토큰 일치, 통과
    return supabaseResponse;
  }

  // -----------------------------------
  // 2. Public 경로 (인증 불필요)
  // -----------------------------------
  const publicPaths = [
    '/',
    '/auth/callback',
    '/auth/confirm',
    '/api/stripe/webhook', // Stripe Webhook은 서명 검증으로 보호됨
  ];

  // 로그인한 사용자가 /login, /signup 접근 시 홈으로 리다이렉트
  const authPaths = ['/login', '/signup'];
  if (session && authPaths.some((path) => pathname.startsWith(path))) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // /login, /signup은 로그인 안한 사용자만 접근 가능
  if (authPaths.some((path) => pathname.startsWith(path))) {
    return supabaseResponse;
  }

  if (publicPaths.some((path) => pathname.startsWith(path))) {
    return supabaseResponse;
  }

  // -----------------------------------
  // 3. Protected 경로 (로그인 필수)
  // -----------------------------------
  if (!session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // -----------------------------------
  // 4. PRO 플랜 체크 (종목 상세 페이지)
  // -----------------------------------
  if (pathname.startsWith('/stock/')) {
    const { data: user } = await supabase
      .from('users')
      .select('plan, subscription_status')
      .eq('id', session.user.id)
      .single() as any;

    const isPro = user?.plan === 'PRO' && user?.subscription_status === 'active';

    if (!isPro) {
      const dashboardUrl = new URL('/dashboard', req.url);
      dashboardUrl.searchParams.set('upgrade', 'true');
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return supabaseResponse;
}

// Proxy가 실행될 경로 설정
export const config = {
  matcher: [
    /*
     * 아래 경로를 제외한 모든 경로에서 실행:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
