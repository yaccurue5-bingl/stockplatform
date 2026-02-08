import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Supabase 클라이언트를 런타임에 생성 (빌드 시점에는 환경변수 없을 수 있음)
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase environment variables are not configured');
  }

  return createClient(supabaseUrl, supabaseKey);
}

// Paddle webhook 서명 검증
function verifyPaddleWebhook(requestBody: string, signature: string): boolean {
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('❌ PADDLE_WEBHOOK_SECRET is not set');
    return false;
  }

  try {
    const hmac = crypto
      .createHmac('sha256', webhookSecret)
      .update(requestBody)
      .digest('hex');

    return hmac === signature;
  } catch (error) {
    console.error('❌ Webhook verification failed:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('paddle-signature') || '';

    // Paddle webhook 서명 검증
    if (!verifyPaddleWebhook(rawBody, signature)) {
      console.error('❌ Invalid webhook signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event_type || event.alert_name;

    console.log(`📬 Paddle webhook received: ${eventType}`);

    switch (eventType) {
      case 'subscription.created':
      case 'subscription_created':
        await handleSubscriptionCreated(event);
        break;

      case 'subscription.updated':
      case 'subscription_updated':
        await handleSubscriptionUpdated(event);
        break;

      case 'subscription.canceled':
      case 'subscription_cancelled':
        await handleSubscriptionCanceled(event);
        break;

      case 'payment.succeeded':
      case 'subscription_payment_succeeded':
        await handlePaymentSucceeded(event);
        break;

      case 'payment.failed':
      case 'subscription_payment_failed':
        await handlePaymentFailed(event);
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${eventType}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// 구독 생성 처리
async function handleSubscriptionCreated(event: any) {
  const { user_id, subscription_id, subscription_plan_id, status, next_bill_date } = event.data || event;

  console.log(`✅ Subscription created: ${subscription_id} for user ${user_id}`);

  // Supabase에 구독 정보 저장
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('subscriptions').upsert({
    user_id,
    paddle_subscription_id: subscription_id,
    paddle_plan_id: subscription_plan_id,
    status: status || 'active',
    next_billing_date: next_bill_date,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error('❌ Failed to save subscription:', error);
  }

  // 사용자 프로필 업데이트 (premium 상태로 변경)
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ subscription_status: 'active', updated_at: new Date().toISOString() })
    .eq('id', user_id);

  if (profileError) {
    console.error('❌ Failed to update profile:', profileError);
  }
}

// 구독 업데이트 처리
async function handleSubscriptionUpdated(event: any) {
  const { subscription_id, status, next_bill_date } = event.data || event;

  console.log(`🔄 Subscription updated: ${subscription_id} -> ${status}`);

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status,
      next_billing_date: next_bill_date,
      updated_at: new Date().toISOString(),
    })
    .eq('paddle_subscription_id', subscription_id);

  if (error) {
    console.error('❌ Failed to update subscription:', error);
  }
}

// 구독 취소 처리
async function handleSubscriptionCanceled(event: any) {
  const { user_id, subscription_id } = event.data || event;

  console.log(`❌ Subscription canceled: ${subscription_id}`);

  const supabase = getSupabaseClient();
  // 구독 상태를 canceled로 변경
  const { error } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('paddle_subscription_id', subscription_id);

  if (error) {
    console.error('❌ Failed to cancel subscription:', error);
  }

  // 사용자 프로필 업데이트
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ subscription_status: 'canceled', updated_at: new Date().toISOString() })
    .eq('id', user_id);

  if (profileError) {
    console.error('❌ Failed to update profile:', profileError);
  }
}

// 결제 성공 처리
async function handlePaymentSucceeded(event: any) {
  const { subscription_id, amount, currency } = event.data || event;

  console.log(`💰 Payment succeeded: ${amount} ${currency} for ${subscription_id}`);

  const supabase = getSupabaseClient();
  // 결제 이력 저장
  const { error } = await supabase.from('payments').insert({
    paddle_subscription_id: subscription_id,
    amount,
    currency,
    status: 'succeeded',
    paid_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('❌ Failed to save payment:', error);
  }
}

// 결제 실패 처리
async function handlePaymentFailed(event: any) {
  const { subscription_id, amount, currency } = event.data || event;

  console.log(`❌ Payment failed: ${amount} ${currency} for ${subscription_id}`);

  const supabase = getSupabaseClient();
  // 결제 실패 이력 저장
  const { error } = await supabase.from('payments').insert({
    paddle_subscription_id: subscription_id,
    amount,
    currency,
    status: 'failed',
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('❌ Failed to save payment failure:', error);
  }

  // 구독 상태를 past_due로 변경
  const { error: subscriptionError } = await supabase
    .from('subscriptions')
    .update({
      status: 'past_due',
      updated_at: new Date().toISOString(),
    })
    .eq('paddle_subscription_id', subscription_id);

  if (subscriptionError) {
    console.error('❌ Failed to update subscription status:', subscriptionError);
  }
}
