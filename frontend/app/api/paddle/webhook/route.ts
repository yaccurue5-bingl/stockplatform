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

// Paddle Billing v2 webhook 서명 검증
// 헤더 형식: Paddle-Signature: ts=<timestamp>;h1=<hmac_hex>
// 검증 메시지: "<ts>:<body>"
function verifyPaddleWebhook(requestBody: string, signatureHeader: string): boolean {
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn('⚠️ PADDLE_WEBHOOK_SECRET is not set - skipping verification (sandbox mode)');
    return true; // 샌드박스 테스트 시 검증 스킵
  }

  try {
    // "ts=1234567890;h1=abc123..." 파싱
    const parts: Record<string, string> = {};
    signatureHeader.split(';').forEach((part) => {
      const [k, v] = part.split('=');
      if (k && v) parts[k.trim()] = v.trim();
    });

    const ts = parts['ts'];
    const h1 = parts['h1'];

    if (!ts || !h1) {
      console.error('❌ Invalid signature header format:', signatureHeader);
      return false;
    }

    // Paddle Billing v2: HMAC-SHA256("{ts}:{body}")
    const msg = `${ts}:${requestBody}`;
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(msg)
      .digest('hex');

    return expected === h1;
  } catch (error) {
    console.error('❌ Webhook verification failed:', error);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('paddle-signature') || req.headers.get('Paddle-Signature') || '';

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

// Paddle v2 이벤트에서 user_id 추출 헬퍼
// Paddle checkout 시 custom_data에 { user_id } 를 넣어야 함
// 없으면 customer.email → users 테이블 이메일 조회 폴백
async function resolveUserId(event: any): Promise<string | null> {
  const data = event.data || event;

  // 1순위: custom_data.user_id (Paddle checkout passthrough)
  const fromCustom = data.custom_data?.user_id || data.passthrough?.user_id;
  if (fromCustom) return fromCustom;

  // 2순위: customer 이메일로 users 테이블 조회
  const email = data.customer?.email || data.email;
  if (email) {
    const supabase = getSupabaseClient();
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
    if (user?.id) return user.id;
  }

  return null;
}

// 구독 플랜 ID → plan 문자열 매핑
// 환경변수 우선: PADDLE_PRICE_ID_PRO, PADDLE_PRICE_ID_DEVELOPER
// 폴백: price ID 문자열 포함 검사
function resolvePlan(planId: string): string {
  const id = (planId || '').toLowerCase();

  const proPriceId  = (process.env.PADDLE_PRICE_ID_PRO       || '').toLowerCase();
  const devPriceId  = (process.env.PADDLE_PRICE_ID_DEVELOPER  || '').toLowerCase();

  if (proPriceId  && id === proPriceId)  return 'pro';
  if (devPriceId  && id === devPriceId)  return 'developer';

  // 폴백: 이름 기반 매칭
  if (id.includes('pro'))                        return 'pro';
  if (id.includes('developer') || id.includes('dev')) return 'developer';

  return 'developer'; // 기본값
}

// 구독 생성 처리
async function handleSubscriptionCreated(event: any) {
  const data = event.data || event;
  const subscriptionId = data.id || data.subscription_id;
  const planId = data.items?.[0]?.price?.id || data.subscription_plan_id || '';
  const status = data.status || 'active';
  const nextBillDate = data.next_billed_at || data.next_bill_date || null;

  const userId = await resolveUserId(event);
  if (!userId) {
    console.error('❌ [subscription.created] user_id 추출 실패. custom_data.user_id를 Paddle checkout에 설정하세요.');
    return;
  }

  const plan = resolvePlan(planId);
  console.log(`✅ Subscription created: ${subscriptionId} → user=${userId} plan=${plan}`);

  const supabase = getSupabaseClient();

  // 1. subscriptions 테이블 upsert
  const { error: subError } = await supabase.from('subscriptions').upsert({
    user_id: userId,
    paddle_subscription_id: subscriptionId,
    paddle_plan_id: planId,
    plan_type: plan,
    status,
    next_billing_date: nextBillDate,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (subError) console.error('❌ subscriptions upsert 실패:', subError);

  // 2. users 테이블: plan + subscription_status + api_key 생성
  const apiKey = crypto.randomBytes(32).toString('hex');
  const { error: userError } = await supabase
    .from('users')
    .update({
      plan,
      subscription_status: 'active',
      api_key: apiKey,
      api_key_created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (userError) console.error('❌ users 업데이트 실패:', userError);
  else console.log(`🔑 API Key 생성 완료: user=${userId}`);
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
  const data = event.data || event;
  const subscriptionId = data.id || data.subscription_id;

  console.log(`🚫 Subscription canceled: ${subscriptionId}`);

  const supabase = getSupabaseClient();

  // 1. subscriptions 상태 → canceled
  const { error: subError } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('paddle_subscription_id', subscriptionId);
  if (subError) console.error('❌ subscriptions 취소 실패:', subError);

  // 2. users: plan → free, subscription_status → canceled, api_key 삭제
  const userId = await resolveUserId(event);
  if (userId) {
    const { error: userError } = await supabase
      .from('users')
      .update({
        plan: 'free',
        subscription_status: 'canceled',
        api_key: null,
        api_key_created_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    if (userError) console.error('❌ users 취소 업데이트 실패:', userError);
  }
}

// 결제 성공 처리
async function handlePaymentSucceeded(event: any) {
  const data = event.data || event;
  const subscription_id = data.subscription_id || data.id;
  const amount   = data.amount   || data.total;
  const currency = data.currency || 'USD';

  console.log(`💰 Payment succeeded: ${amount} ${currency} for ${subscription_id}`);

  const userId  = await resolveUserId(event);
  const supabase = getSupabaseClient();

  const { error } = await supabase.from('payments').insert({
    user_id:                userId,
    paddle_subscription_id: subscription_id,
    amount,
    currency,
    status:   'succeeded',
    paid_at:  new Date().toISOString(),
    created_at: new Date().toISOString(),
  });
  if (error) console.error('❌ Failed to save payment:', error);

  // 결제 성공 시 구독 status → active 재확인
  if (subscription_id) {
    await supabase
      .from('subscriptions')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('paddle_subscription_id', subscription_id);
  }
}

// 결제 실패 처리
async function handlePaymentFailed(event: any) {
  const data = event.data || event;
  const subscription_id = data.subscription_id || data.id;
  const amount   = data.amount   || data.total;
  const currency = data.currency || 'USD';

  console.log(`❌ Payment failed: ${amount} ${currency} for ${subscription_id}`);

  const userId  = await resolveUserId(event);
  const supabase = getSupabaseClient();

  const { error } = await supabase.from('payments').insert({
    user_id:                userId,
    paddle_subscription_id: subscription_id,
    amount,
    currency,
    status: 'failed',
    created_at: new Date().toISOString(),
  });
  if (error) console.error('❌ Failed to save payment failure:', error);

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
