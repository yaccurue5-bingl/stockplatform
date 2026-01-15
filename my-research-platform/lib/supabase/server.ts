/**
 * Supabase Server Client (서버용)
 *
 * 사용 위치: API Routes, Server Components, Middleware
 *
 * ⚠️ 주의: 이 클라이언트는 SERVICE_ROLE_KEY를 사용하여
 * RLS(Row Level Security)를 우회할 수 있습니다.
 * 절대 클라이언트 코드에서 사용하지 마세요!
 *
 * 예시:
 * ```tsx
 * import { createServerClient, getUser } from '@/lib/supabase/server';
 *
 * const user = await getUser();
 * ```
 */

import { createServerClient as createSSRServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

/**
 * Server Component용 Supabase 클라이언트
 * ✅ 쿠키에서 JWT 토큰 읽어서 사용자 인증
 * ✅ RLS 정책 적용됨
 */
export async function createServerClient() {
  const cookieStore = await cookies();

  return createSSRServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component에서는 쿠키 설정이 불가능할 수 있음
          }
        },
      },
    }
  );
}

/**
 * Service Role Client (RLS 우회)
 * ⚠️ 관리자 작업에만 사용 (예: Stripe Webhook, Cron Job)
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * 현재 로그인한 사용자 정보 가져오기
 */
export async function getUser() {
  const supabase = await createServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

/**
 * 사용자의 플랜 정보 확인
 */
export async function getUserPlan(userId: string) {
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('users')
    .select('plan, subscription_status')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Failed to get user plan:', error);
    return null;
  }

  return data;
}

/**
 * 사용자가 PRO 플랜인지 확인
 */
export async function isProUser(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId);
  return plan?.plan === 'PRO' && plan?.subscription_status === 'active';
}

/**
 * Stripe Customer ID로 사용자 업데이트 (Service Role)
 */
export async function updateUserStripeInfo(
  userId: string,
  data: {
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    plan?: 'FREE' | 'PRO';
    subscription_status?: 'active' | 'canceled' | 'past_due' | 'trialing';
  }
) {
  const supabase = createServiceClient(); // RLS 우회

  const { error } = await supabase
    .from('users')
    .update(data)
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed to update user: ${error.message}`);
  }
}

/**
 * Stripe Customer ID로 사용자 찾기 (Service Role)
 */
export async function getUserByStripeCustomerId(customerId: string) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('stripe_customer_id', customerId)
    .single();

  if (error) {
    console.error('Failed to find user by Stripe customer ID:', error);
    return null;
  }

  return data;
}
