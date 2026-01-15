/**
 * Stripe Webhook Handler
 *
 * Stripe가 결제 이벤트를 알려주는 엔드포인트
 *
 * 처리하는 이벤트:
 * 1. checkout.session.completed - 결제 완료
 * 2. customer.subscription.updated - 구독 변경 (갱신, 취소 등)
 * 3. customer.subscription.deleted - 구독 삭제
 * 4. invoice.payment_failed - 결제 실패
 *
 * 보안:
 * - Stripe Signature 검증 (필수!)
 * - 검증 실패 시 400 에러 반환
 */

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { constructWebhookEvent } from '@/lib/stripe';
import {
  updateUserStripeInfo,
  getUserByStripeCustomerId,
} from '@/lib/supabase/server';
import type Stripe from 'stripe';

/**
 * ⚠️ 중요: Next.js가 body를 파싱하지 않도록 설정
 * Stripe Webhook 서명 검증을 위해 raw body가 필요함
 */
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.text(); // raw body 가져오기
  const signature = headers().get('stripe-signature');

  if (!signature) {
    console.error('[Webhook] Missing stripe-signature header');
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    // ✅ 1단계: Stripe Signature 검증
    event = constructWebhookEvent(body, signature);
  } catch (err) {
    const error = err as Error;
    console.error('[Webhook] Signature verification failed:', error.message);
    return NextResponse.json(
      { error: `Webhook Error: ${error.message}` },
      { status: 400 }
    );
  }

  console.log(`[Webhook] Received event: ${event.type}`);

  try {
    // ✅ 2단계: 이벤트 타입별 처리
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err) {
    const error = err as Error;
    console.error(`[Webhook] Error processing ${event.type}:`, error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

/**
 * 결제 완료 처리
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!userId) {
    throw new Error('Missing userId in session metadata');
  }

  console.log(`[Webhook] Checkout completed for user: ${userId}`);

  await updateUserStripeInfo(userId, {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    plan: 'PRO',
    subscription_status: 'active',
  });

  console.log(`[Webhook] User ${userId} upgraded to PRO`);
}

/**
 * 구독 업데이트 처리 (갱신, 일시정지 등)
 */
async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const user = await getUserByStripeCustomerId(customerId);

  if (!user) {
    console.warn(`[Webhook] User not found for customer: ${customerId}`);
    return;
  }

  const status = subscription.status;
  let plan: 'FREE' | 'PRO' = 'FREE';
  let subscriptionStatus: 'active' | 'canceled' | 'past_due' | 'trialing' = 'canceled';

  // Stripe 구독 상태에 따라 플랜 결정
  if (status === 'active' || status === 'trialing') {
    plan = 'PRO';
    subscriptionStatus = status === 'active' ? 'active' : 'trialing';
  } else if (status === 'past_due') {
    plan = 'PRO'; // 결제 실패해도 일단 PRO 유지 (grace period)
    subscriptionStatus = 'past_due';
  } else {
    plan = 'FREE';
    subscriptionStatus = 'canceled';
  }

  console.log(`[Webhook] Subscription updated for user: ${user.id}, status: ${status}`);

  await updateUserStripeInfo(user.id, {
    plan,
    subscription_status: subscriptionStatus,
  });
}

/**
 * 구독 삭제 처리 (취소)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const user = await getUserByStripeCustomerId(customerId);

  if (!user) {
    console.warn(`[Webhook] User not found for customer: ${customerId}`);
    return;
  }

  console.log(`[Webhook] Subscription deleted for user: ${user.id}`);

  await updateUserStripeInfo(user.id, {
    plan: 'FREE',
    subscription_status: 'canceled',
  });
}

/**
 * 결제 실패 처리
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const user = await getUserByStripeCustomerId(customerId);

  if (!user) {
    console.warn(`[Webhook] User not found for customer: ${customerId}`);
    return;
  }

  console.warn(`[Webhook] Payment failed for user: ${user.id}`);

  // 결제 실패 시 일단 past_due 상태로 변경 (바로 취소 안 함)
  await updateUserStripeInfo(user.id, {
    subscription_status: 'past_due',
  });

  // TODO: 사용자에게 이메일 알림 보내기 (선택사항)
}
