-- Test User Pro Account Upgrade
-- yaccurue3@naver.com을 PRO 계정으로 업그레이드

-- 1. 사용자 ID 확인
DO $$
DECLARE
  v_user_id UUID;
  v_profile_exists BOOLEAN;
  v_subscription_exists BOOLEAN;
BEGIN
  -- auth.users에서 사용자 ID 찾기
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'yaccurue3@naver.com';

  IF v_user_id IS NULL THEN
    RAISE NOTICE '❌ User not found: yaccurue3@naver.com';
    RAISE NOTICE 'Please sign up first at https://k-marketinsight.com/signup';
    RETURN;
  END IF;

  RAISE NOTICE '✅ User found: %', v_user_id;

  -- 2. profiles 테이블 확인/생성
  SELECT EXISTS(
    SELECT 1 FROM profiles WHERE id = v_user_id
  ) INTO v_profile_exists;

  IF NOT v_profile_exists THEN
    INSERT INTO profiles (id, email, created_at, updated_at)
    VALUES (v_user_id, 'yaccurue3@naver.com', NOW(), NOW());
    RAISE NOTICE '✅ Profile created';
  ELSE
    RAISE NOTICE '✅ Profile already exists';
  END IF;

  -- 3. subscriptions 테이블 확인
  SELECT EXISTS(
    SELECT 1 FROM subscriptions WHERE user_id = v_user_id
  ) INTO v_subscription_exists;

  -- 4. Premium 구독 생성/업데이트
  IF v_subscription_exists THEN
    -- 기존 구독 업데이트
    UPDATE subscriptions
    SET
      plan_type = 'premium',
      status = 'active',
      current_period_start = NOW(),
      current_period_end = NOW() + INTERVAL '1 year',
      updated_at = NOW()
    WHERE user_id = v_user_id;
    RAISE NOTICE '✅ Subscription updated to premium';
  ELSE
    -- 새 구독 생성
    INSERT INTO subscriptions (
      user_id,
      plan_type,
      status,
      current_period_start,
      current_period_end,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      'premium',
      'active',
      NOW(),
      NOW() + INTERVAL '1 year',
      NOW(),
      NOW()
    );
    RAISE NOTICE '✅ Premium subscription created';
  END IF;

  -- 5. 결과 확인
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '🎉 yaccurue3@naver.com is now a PREMIUM user!';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

END $$;

-- 최종 확인 쿼리
SELECT
  u.email,
  s.plan_type,
  s.status,
  s.current_period_start,
  s.current_period_end
FROM auth.users u
LEFT JOIN subscriptions s ON u.id = s.user_id
WHERE u.email = 'yaccurue3@naver.com';
