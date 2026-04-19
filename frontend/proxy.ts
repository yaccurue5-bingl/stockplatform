/**
 * Next.js Middleware (구 proxy.ts 통합본)
 *
 * ⚠️  Next.js는 반드시 이 파일(middleware.ts)만 미들웨어로 인식합니다.
 *     proxy.ts, auth.ts 등 다른 이름의 파일은 빌드 시 타입 검사만 되고
 *     절대 실행되지 않습니다. 인증 로직은 반드시 이 파일에 있어야 합니다.
 *
 * 처리 순서:
 * 1. SEO: vercel.app 도메인 → X-Robots-Tag: noindex
 * 2. SEO: www → non-www 301 리다이렉트
 * 3. B2B API Key 요청 → /api/v1/* 직접 통과
 * 4. Cron Job 보안 (Authorization 헤더 검증)
 * 5. Public 경로 → 통과
 * 6. Protected 경로 → 세션 없으면 /login 리다이렉트
 * 7. /stock/* → Pro 플랜 체크
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { Database } from '@/types/database';

export default async function proxy(req: NextRequest) {
  const host = req.headers.get('host') ?? '';

  // ── 1) SEO: vercel.app 도메인 noindex ───────────────────────────────────
  if (host.includes('vercel.app')) {
    const response = NextResponse.next();
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  }

  // ── 2) SEO: www → non-www 301 ───────────────────────────────────────────
  if (host.startsWith('www.')) {
    const url = req.nextUrl.clone();
    url.host = host.replace(/^www\./, '');
    return NextResponse.redirect(url, { status: 301 });
  }

  // ── Supabase 세션 초기화 ────────────────────────────────────────────────
  let supabaseResponse = NextResponse.next({ request: req });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;

  // ── 3) B2B API Key → /api/v1/* 직접 통과 ───────────────────────────────
  const hasApiKey =
    req.headers.get('x-api-key') ||
    req.nextUrl.searchParams.get('api_key');
  if (hasApiKey && pathname.startsWith('/api/v1')) {
    return supabaseResponse;
  }

  // ── 4) Cron Job 보안 ────────────────────────────────────────────────────
  if (pathname.startsWith('/api/cron/')) {
    const authHeader = req.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET_TOKEN;

    if (!expectedToken) {
      console.error('[MIDDLEWARE] CRON_SECRET_TOKEN not set');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }
    if (authHeader !== `Bearer ${expectedToken}`) {
      console.warn('[MIDDLEWARE] Unauthorized cron access:', pathname);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return supabaseResponse;
  }

  // ── 5) Public 경로 ──────────────────────────────────────────────────────
  const exactPublicPaths = ['/'];
  const prefixPublicPaths = [
    '/auth/callback',
    '/auth/confirm',
    '/auth/reset-password',
    '/forgot-password',
    '/api/stripe/webhook',
    '/api/paddle/webhook',
    '/api/market-radar-widget',   // 랜딩 위젯 (공개)
    '/api/v1/',
    '/api/disclosures/latest',
    '/api/financials/',
    '/api/short/',
    '/disclosures/',
    '/signal/',
    '/korea-earnings-signals',
    '/korea-dilution-filings',
    '/korea-contract-signals',
    '/pricing',
    '/api-docs',
    '/datasets',
    '/terms',
    '/privacy',
    '/refund-policy',
    '/sitemap.xml',
    '/robots.txt',
  ];

  // 로그인한 사용자가 /login, /signup 접근 시 → 홈 또는 redirectTo로
  const authPaths = ['/login', '/signup'];
  if (session && authPaths.some((p) => pathname.startsWith(p))) {
    const raw = req.nextUrl.searchParams.get('redirectTo') || '/';
    const safe = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
    return NextResponse.redirect(new URL(safe, req.url));
  }
  if (authPaths.some((p) => pathname.startsWith(p))) {
    return supabaseResponse;
  }

  const isPublic =
    exactPublicPaths.includes(pathname) ||
    prefixPublicPaths.some((p) => pathname.startsWith(p));

  if (isPublic) return supabaseResponse;

  // ── 6) Protected 경로: 로그인 필수 ─────────────────────────────────────
  if (!session) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── 7) Pro 플랜 체크 (/stock/*) ─────────────────────────────────────────
  if (pathname.startsWith('/stock/')) {
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('plan_type, status')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (subError) {
      console.error('[MIDDLEWARE] Subscription check error:', subError);
    }

    const isPremium =
      subscription?.plan_type === 'premium' &&
      subscription?.status === 'active';

    if (!isPremium) {
      const dashboardUrl = new URL('/dashboard', req.url);
      dashboardUrl.searchParams.set('upgrade', 'true');
      return NextResponse.redirect(dashboardUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
