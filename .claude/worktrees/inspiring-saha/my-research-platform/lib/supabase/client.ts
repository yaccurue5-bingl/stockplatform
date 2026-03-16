/**
 * Supabase Client (브라우저용)
 *
 * 사용 위치: React 컴포넌트, 클라이언트 사이드
 *
 * 예시:
 * ```tsx
 * import { createClient } from '@/lib/supabase/client';
 *
 * const supabase = createClient();
 * const { data, error } = await supabase.auth.signInWithPassword({
 *   email: 'user@example.com',
 *   password: 'password123',
 * });
 * ```
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

// __InternalSupabase 키를 제거한 순수 DB 타입 (createBrowserClient 제네릭용)
type CleanDatabase = Omit<Database, '__InternalSupabase'>;

// 브라우저용 Supabase 클라이언트 생성 함수
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }

  return createBrowserClient<CleanDatabase>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

// 세션 만료 체크 (30분 = 1800000ms)
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
let sessionTimer: ReturnType<typeof setTimeout> | null = null;
let lastActivityTime: number = Date.now();

export function getLastActivityTime() {
  return lastActivityTime;
}

export function startSessionTimer(onExpire: () => void) {
  lastActivityTime = Date.now();
  if (sessionTimer) clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => {
    const supabase = getSupabase();
    supabase.auth.signOut();
    onExpire();
  }, SESSION_TIMEOUT_MS);
}

export function resetSessionTimer(onExpire: () => void) {
  startSessionTimer(onExpire);
}

/**
 * 모바일 백그라운드 복귀 시 실제 경과 시간 기반으로 만료 체크
 * (모바일 브라우저는 백그라운드에서 setTimeout을 일시정지하므로
 *  타이머만으로는 세션 만료가 작동하지 않음)
 */
export function checkSessionExpiry(onExpire: () => void): boolean {
  const elapsed = Date.now() - lastActivityTime;
  if (elapsed >= SESSION_TIMEOUT_MS) {
    clearSessionTimer();
    const supabase = getSupabase();
    supabase.auth.signOut();
    onExpire();
    return true;
  }
  // 아직 만료되지 않았으면 남은 시간으로 타이머 재설정
  if (sessionTimer) clearTimeout(sessionTimer);
  sessionTimer = setTimeout(() => {
    const supabase = getSupabase();
    supabase.auth.signOut();
    onExpire();
  }, SESSION_TIMEOUT_MS - elapsed);
  return false;
}

export function clearSessionTimer() {
  if (sessionTimer) {
    clearTimeout(sessionTimer);
    sessionTimer = null;
  }
}

// 편의를 위한 싱글톤 인스턴스
let supabaseInstance: ReturnType<typeof createClient> | null = null;

export function getSupabase() {
  if (!supabaseInstance) {
    supabaseInstance = createClient();
  }
  return supabaseInstance;
}

/**
 * 로그인 헬퍼 함수
 */
export async function signIn(email: string, password: string) {
  const supabase = getSupabase();
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
  const supabase = getSupabase();

  // ✅ 개발 환경에서는 localhost 사용, 프로덕션에서는 환경변수 사용
  const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
  const siteUrl = isDevelopment ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin);
  const redirectUrl = `${siteUrl}/auth/callback`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
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
  const supabase = getSupabase();
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Google OAuth 로그인
 */
export async function signInWithGoogle(redirectTo: string = '/') {
  const supabase = getSupabase();

  // ✅ 개발 환경에서는 localhost 사용, 프로덕션에서는 환경변수 사용
  const isDevelopment = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
  const siteUrl = isDevelopment ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin);

  // ✅ callback URL에 최종 redirect 경로를 쿼리 파라미터로 전달
  const callbackUrl = `${siteUrl}/auth/callback?redirect_to=${encodeURIComponent(redirectTo)}`;

  console.log('🔐 Google OAuth callbackUrl:', callbackUrl); // 디버깅용

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: callbackUrl,
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
  const supabase = getSupabase();
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
  const supabase = getSupabase();
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

