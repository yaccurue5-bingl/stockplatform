import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * SEO 미들웨어
 * 1. vercel.app 도메인 → X-Robots-Tag: noindex (구글 색인 방지)
 * 2. www → non-www 301 리다이렉트 (canonical 통일)
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';

  // ── 1) vercel.app 도메인: noindex 헤더 추가 ──────────────────────────────
  if (host.includes('vercel.app')) {
    const response = NextResponse.next();
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    return response;
  }

  // ── 2) www → non-www 영구 리다이렉트 ────────────────────────────────────
  if (host.startsWith('www.')) {
    const url = request.nextUrl.clone();
    url.host = host.replace(/^www\./, '');
    return NextResponse.redirect(url, { status: 301 });
  }

  return NextResponse.next();
}

export const config = {
  // 정적 파일·API Route 제외
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
