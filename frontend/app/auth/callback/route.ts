/**
 * Supabase Auth Callback Route
 *
 * 이메일 인증 링크나 OAuth 로그인 후 리다이렉트되는 곳
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import type { Database } from '@/types/database';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');
  const error_code = requestUrl.searchParams.get('error');
  const error_description = requestUrl.searchParams.get('error_description');
  const redirect_to = requestUrl.searchParams.get('redirect_to') || '/';

  // OAuth 에러가 있는 경우 (Google에서 거부 등)
  if (error_code) {
    console.error('OAuth error:', error_code, error_description);
    const errorUrl = new URL('/login', request.url);
    errorUrl.searchParams.set('error', error_description || 'Authentication failed');
    return NextResponse.redirect(errorUrl);
  }

  // code가 없는 경우
  if (!code) {
    console.error('No code provided in OAuth callback');
    const errorUrl = new URL('/login', request.url);
    errorUrl.searchParams.set('error', 'Invalid authentication response');
    return NextResponse.redirect(errorUrl);
  }

  try {
    const cookieStore = await cookies();

    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: any) {
            try {
              cookiesToSet.forEach(({ name, value, options }: any) =>
                cookieStore.set(name, value, options)
              );
            } catch (error) {
              console.error('Failed to set cookies:', error);
            }
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Failed to exchange code for session:', error);
      const errorUrl = new URL('/login', request.url);

      // 이미 사용됐거나 만료된 토큰 → 친절한 안내
      const isExpiredToken =
        error.message?.toLowerCase().includes('expired') ||
        error.message?.toLowerCase().includes('already') ||
        error.message?.toLowerCase().includes('invalid');

      errorUrl.searchParams.set(
        'error',
        isExpiredToken
          ? 'This confirmation link has already been used or has expired. Please sign in directly.'
          : 'Authentication failed. Please try again.'
      );
      return NextResponse.redirect(errorUrl);
    }

    // 성공 - 사용자 정보 로깅
    console.log('OAuth login successful for user:', data.user?.email);

    // 비밀번호 재설정 링크
    if (type === 'recovery') {
      return NextResponse.redirect(new URL('/auth/reset-password', request.url));
    }

    // 이메일 확인인 경우만 confirm 페이지로 + 웰컴 메일 발송
    if (type === 'signup' || type === 'email') {
      // 웰컴 이메일 발송 (fire-and-forget, 실패해도 흐름 차단 안 함)
      if (data.user?.email) {
        const name = data.user.user_metadata?.full_name || data.user.user_metadata?.name || '';
        fetch(new URL('/api/auth/welcome', request.url).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: data.user.email, name }),
        }).catch((err) => console.error('[welcome-email] fire-and-forget failed:', err));
      }
      return NextResponse.redirect(new URL('/auth/confirm', request.url));
    }

    // ✅ OAuth 로그인 성공 시 원래 페이지로 리디렉션
    console.log('Redirecting to:', redirect_to);
    return NextResponse.redirect(new URL(redirect_to, request.url));

  } catch (error) {
    console.error('Unexpected error in auth callback:', error);
    const errorUrl = new URL('/login', request.url);
    errorUrl.searchParams.set('error', 'An unexpected error occurred');
    return NextResponse.redirect(errorUrl);
  }
}
