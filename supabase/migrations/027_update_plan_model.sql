-- migration 027: 플랜 모델 업데이트
-- FREE / PRO → free / developer / pro (소문자 + developer 플랜 추가)

-- 1. 기존 constraint 제거
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_plan_check;

-- 2. 기존 대문자 값 소문자로 변환
UPDATE public.users SET plan = LOWER(plan) WHERE plan IS NOT NULL;

-- 3. 새 constraint 적용 (free / developer / pro)
ALTER TABLE public.users
  ADD CONSTRAINT users_plan_check
  CHECK (plan IN ('free', 'developer', 'pro'));

-- 4. 기본값 소문자로 변경
ALTER TABLE public.users
  ALTER COLUMN plan SET DEFAULT 'free';

COMMENT ON COLUMN public.users.plan IS '구독 플랜: free / developer / pro';
