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
  // 0. B2B API Key 요청 — 세션 인증 완전 우회
  //    X-API-Key 헤더 또는 ?api_key= 파라미터가 있으면
  //    /api/v1/* 라우트가 자체적으로 인증을 처리하므로 바로 통과.
  // -----------------------------------
  const hasApiKey =
    req.headers.get('x-api-key') ||
    req.nextUrl.searchParams.get('api_key');
  if (hasApiKey && pathname.startsWith('/api/v1')) {
    return supabaseResponse;
  }

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
  // '/' 는 정확히 일치, 나머지는 startsWith 사용
  const exactPublicPaths = ['/'];
  const prefixPublicPaths = [
    '/auth/callback',
    '/auth/confirm',
    '/auth/reset-password',    // 비밀번호 재설정 (recovery 토큰으로 접근)
    '/forgot-password',        // 비밀번호 찾기 (미인증 접근 허용)
    '/api/stripe/webhook',    // Stripe Webhook은 서명 검증으로 보호됨
    '/api/paddle/webhook',    // Paddle Webhook은 서명 검증으로 보호됨
    '/api/v1/',               // B2B REST API — X-API-Key 자체 인증 처리
    '/api/disclosures/latest', // 메인 페이지 공시 목록 API
    '/api/financials/',        // 재무 YoY API (공개)
    '/api/short/',             // 대차잔고 Short Pressure API (공개)
    '/disclosures/',           // 개별 공시 상세 페이지 (공개 미끼 상품)
    '/signal/',               // SEO 공시 시그널 페이지 (공개, 구글 인덱싱 대상)
    '/korea-earnings-signals',  // SEO 랜딩 페이지 (공개)
    '/korea-dilution-filings',  // SEO 랜딩 페이지 (공개)
    '/korea-contract-signals',  // SEO 랜딩 페이지 (공개)
    '/pricing',                 // 가격 페이지 (공개, SEO 대상)
    '/api-docs',                // API 문서 (공개, SEO 대상)
    '/datasets',                // 데이터셋 페이지 (공개, SEO 대상)
    '/terms',                   // 이용약관 (공개)
    '/privacy',                 // 개인정보처리방침 (공개)
    '/refund-policy',           // 환불정책 (공개)
    '/sitemap.xml',             // 구글 서치 콘솔 크롤링 허용
    '/robots.txt',              // 크롤러 접근 허용
  ];

  // 로그인한 사용자가 /login, /signup 접근 시 redirectTo 혹은 홈으로 리다이렉트
  // (뒤로가기로 /login에 다시 진입하는 히스토리 루프 방지)
  const authPaths = ['/login', '/signup'];
  if (session && authPaths.some((path) => pathname.startsWith(path))) {
    const raw = req.nextUrl.searchParams.get('redirectTo') || '/';
    // open-redirect 방어: 반드시 내부 상대 경로만 허용
    const safe = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
    return NextResponse.redirect(new URL(safe, req.url));
  }

  // /login, /signup은 로그인 안한 사용자만 접근 가능
  if (authPaths.some((path) => pathname.startsWith(path))) {
    return supabaseResponse;
  }

  const isPublic =
    exactPublicPaths.includes(pathname) ||
    prefixPublicPaths.some((path) => pathname.startsWith(path));

  if (isPublic) {
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
    // 먼저 subscription 레코드 확인
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('plan_type, status')
      .eq('user_id', session.user.id)
      .maybeSingle() as { data: { plan_type: string; status: string } | null; error: any };

    if (subError) {
      console.error('[PROXY] Subscription check error:', subError);
    }

    const isPremium = subscription?.plan_type === 'premium' && subscription?.status === 'active';

    if (!isPremium) {
      console.log(`[PROXY] Non-premium user ${session.user.email} trying to access ${pathname}`);
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
