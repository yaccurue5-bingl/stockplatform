-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 테스트 계정 확인 및 Premium 업그레이드
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 1. 현재 계정 상태 확인
SELECT
  u.id as user_id,
  u.email,
  u.created_at as user_created_at,
  p.id as profile_id,
  s.id as subscription_id,
  s.plan_type,
  s.status,
  s.current_period_end
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
LEFT JOIN subscriptions s ON u.id = s.user_id
WHERE u.email = 'yaccurue3@naver.com';

-- 2. Profile 생성 (없으면)
INSERT INTO profiles (id, email, created_at, updated_at)
SELECT
  id,
  email,
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'yaccurue3@naver.com'
  AND NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT id FROM auth.users WHERE email = 'yaccurue3@naver.com')
  );

-- 3. Premium Subscription 생성/업데이트
INSERT INTO subscriptions (
  user_id,
  plan_type,
  status,
  current_period_start,
  current_period_end,
  created_at,
  updated_at
)
SELECT
  id,
  'premium',
  'active',
  NOW(),
  NOW() + INTERVAL '1 year',
  NOW(),
  NOW()
FROM auth.users
WHERE email = 'yaccurue3@naver.com'
ON CONFLICT (user_id)
DO UPDATE SET
  plan_type = 'premium',
  status = 'active',
  current_period_start = NOW(),
  current_period_end = NOW() + INTERVAL '1 year',
  updated_at = NOW();

-- 4. 결과 확인
SELECT
  '✅ Premium 업그레이드 완료' as message,
  u.email,
  s.plan_type,
  s.status,
  s.current_period_end
FROM auth.users u
LEFT JOIN subscriptions s ON u.id = s.user_id
WHERE u.email = 'yaccurue3@naver.com';
