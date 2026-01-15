/**
 * Stripe Client
 *
 * 사용 위치: API Routes (서버 사이드만)
 *
 * ⚠️ 주의: Stripe Secret Key는 절대 클라이언트에 노출되면 안 됩니다!
 * 이 파일은 API Routes에서만 import하세요.
 */

import Stripe from 'stripe';

// Stripe 클라이언트 초기화 (빌드 타임에는 환경 변수가 없을 수 있음)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2025-02-24.acacia', // 최신 API 버전
  typescript: true,
});

/**
 * Stripe Checkout 세션 생성
 *
 * @param customerId - Stripe Customer ID (있으면 재사용, 없으면 생성)
 * @param customerEmail - 사용자 이메일
 * @param userId - Supabase User ID (metadata로 저장)
 * @returns Checkout Session URL
 */
export async function createCheckoutSession(
  customerId: string | null,
  customerEmail: string,
  userId: string
): Promise<string> {
  const priceId = process.env.STRIPE_PRO_PLAN_PRICE_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (!priceId) {
    throw new Error('Missing STRIPE_PRO_PLAN_PRICE_ID');
  }

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${appUrl}/dashboard?success=true`,
    cancel_url: `${appUrl}/dashboard?canceled=true`,
    metadata: {
      userId, // Webhook에서 사용자 식별용
    },
    subscription_data: {
      metadata: {
        userId,
      },
    },
  };

  // 기존 고객이면 customer ID 재사용
  if (customerId) {
    sessionParams.customer = customerId;
  } else {
    // 신규 고객이면 이메일로 생성
    sessionParams.customer_email = customerEmail;
  }

  const session = await stripe.checkout.sessions.create(sessionParams);

  if (!session.url) {
    throw new Error('Failed to create checkout session');
  }

  return session.url;
}

/**
 * Webhook 이벤트 검증
 *
 * @param body - Request body (raw string)
 * @param signature - Stripe-Signature 헤더
 * @returns Stripe Event
 */
export function constructWebhookEvent(
  body: string,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('Missing STRIPE_WEBHOOK_SECRET');
  }

  try {
    return stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const error = err as Error;
    throw new Error(`Webhook signature verification failed: ${error.message}`);
  }
}

/**
 * 구독 취소
 *
 * @param subscriptionId - Stripe Subscription ID
 */
export async function cancelSubscription(subscriptionId: string) {
  return await stripe.subscriptions.cancel(subscriptionId);
}

/**
 * Customer Portal 세션 생성 (구독 관리 페이지)
 *
 * @param customerId - Stripe Customer ID
 * @returns Portal Session URL
 */
export async function createCustomerPortalSession(
  customerId: string
): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${appUrl}/settings`,
  });

  return session.url;
}
