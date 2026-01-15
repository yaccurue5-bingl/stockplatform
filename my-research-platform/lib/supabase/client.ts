/**
 * Supabase Client (브라우저용)
 *
 * 사용 위치: React 컴포넌트, 클라이언트 사이드
 *
 * 예시:
 * ```tsx
 * import { supabase } from '@/lib/supabase/client';
 *
 * const { data, error } = await supabase.auth.signInWithPassword({
 *   email: 'user@example.com',
 *   password: 'password123',
 * });
 * ```
 */

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/database';

// 브라우저에서 사용하는 Supabase 클라이언트
// ✅ 자동으로 쿠키에서 JWT 토큰 읽어옴
export const supabase = createClientComponentClient<Database>();

/**
 * 로그인 헬퍼 함수
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * 회원가입 헬퍼 함수
 */
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * 로그아웃 헬퍼 함수
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Google OAuth 로그인
 */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * 현재 사용자 정보 가져오기
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  return user;
}

/**
 * 사용자 플랜 정보 가져오기
 */
export async function getUserPlan(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('plan, subscription_status')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
