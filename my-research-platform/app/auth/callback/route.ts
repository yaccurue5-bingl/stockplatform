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
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/';

  if (code) {
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
            } catch {
              // Server Component에서는 쿠키 설정이 불가능할 수 있음
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // 이메일 확인인 경우 confirm 페이지로 리다이렉트
      if (type === 'signup' || type === 'email') {
        return NextResponse.redirect(new URL('/auth/confirm', request.url));
      }
      // 일반 로그인인 경우 대시보드로
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }
  }

  // 에러 발생 시에도 confirm 페이지로 (에러가 발생해도 인증은 완료될 수 있음)
  return NextResponse.redirect(new URL('/auth/confirm', request.url));
}
