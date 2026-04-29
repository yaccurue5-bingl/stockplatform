/**
 * Next.js Middleware (proxy.ts — Next.js 16+ 미들웨어 파일명)
 *
 * 처리 순서:
 * 1. SEO: vercel.app 도메인 → X-Robots-Tag: noindex
 * 2. B2B API Key 요청 → /api/v1/* 직접 통과
 * 3. Cron Job 보안 (Authorization 헤더 검증)
 * 4. Public 경로 → 통과
 * 5. Protected 경로 → 세션 없으면 /login 리다이렉트
 *    (로그인 사용자는 모든 콘텐츠 접근 가능)
 *
 * ⚠️  www → non-www 리다이렉트는 미들웨어에서 하지 않는다.
 *     이유: Vercel 도메인 설정의 Primary domain 방향과 충돌 시
 *     모든 페이지에서 ERR_TOO_MANY_REDIRECTS 무한 루프 발생.
 *     www/non-www 리다이렉트는 Vercel 대시보드 Domains 설정에서만 관리한다.
 *     (Vercel: Settings → Domains → non-www를 Primary로 설정 → www는 자동 redirect)
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // ⚠️ Must use getUser() not getSession() — getUser() validates the JWT
  // with the Supabase auth server and refreshes the token if needed.
  // getSession() only reads from cookies without server-side validation.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const session = user ? { user } : null;

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
    '/disclosures',   // trailing slash 없이 → /disclosures 목록 + /disclosures/* 모두 공개
    '/signal/',
    '/korea-earnings-signals',
    '/korea-dilution-filings',
    '/korea-contract-signals',
    '/api-access',    // B2B 랜딩 페이지 공개
    '/api-docs',
    '/datasets',
    '/terms',
    '/privacy',
    '/refund-policy',
    '/sitemap.xml',
    '/sitemap/',          // paginated sub-sitemaps: /sitemap/0.xml, /sitemap/1.xml, …
    '/robots.txt',
  ];

  // 로그인/회원가입/비밀번호 찾기 페이지 → 세션 상태와 무관하게 통과
  // ⚠️ 여기서 "이미 로그인 → redirectTo로 이동" 서버 리다이렉트를 하지 않는다.
  //    이유: session이 불안정한 상태(토큰 만료 직전)일 때 아래 루프가 발생함:
  //      /dashboard → /login?redirectTo=/dashboard → /dashboard → ∞ (ERR_TOO_MANY_REDIRECTS)
  //    대신 클라이언트(LoginForm useEffect)에서 이미 로그인된 경우를 처리한다.
  const authPaths = ['/login', '/signup', '/forgot-password'];
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

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
