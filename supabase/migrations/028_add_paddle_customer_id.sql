-- migration 028: subscriptions 테이블에 paddle_customer_id 추가
-- Paddle Customer Portal 세션 생성에 필요

-- subscriptions 테이블이 없으면 생성 (최초 환경 대비)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID REFERENCES public.users(id) ON DELETE CASCADE,
  paddle_subscription_id TEXT UNIQUE,
  paddle_plan_id         TEXT,
  plan_type              TEXT NOT NULL DEFAULT 'developer',
  status                 TEXT NOT NULL DEFAULT 'active',
  next_billing_date      TIMESTAMPTZ,
  canceled_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- paddle_customer_id 컬럼 추가 (이미 있으면 무시)
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS paddle_customer_id TEXT;

-- 인덱스: portal 세션 조회 시 user_id → paddle_customer_id 빠르게 찾기
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON public.subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_paddle_customer_id
  ON public.subscriptions (paddle_customer_id);

COMMENT ON COLUMN public.subscriptions.paddle_customer_id
  IS 'Paddle customer ID (ctm_xxx) — Customer Portal 세션 생성에 사용';
