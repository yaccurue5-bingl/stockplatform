-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Webhook 테스트용 공시 데이터 삽입
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
--
-- 이 스크립트를 Supabase SQL Editor에서 실행하면:
-- 1. 테스트 공시가 disclosure_insights에 삽입됨
-- 2. Supabase Webhook이 자동으로 트리거됨
-- 3. Vercel Deploy Hook이 호출됨
-- 4. Vercel에서 자동 배포 시작
--
-- 실행 후 확인:
-- - Supabase Dashboard → Database → Webhooks → Logs (응답 코드 확인)
-- - Vercel Dashboard → Deployments (새 배포 확인)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 1. 테스트 공시 삽입
INSERT INTO disclosure_insights (
  rcept_no,
  corp_code,
  corp_name,
  stock_code,
  report_nm,
  rcept_dt,
  importance,
  analysis_status
) VALUES (
  'WEBHOOK_TEST_' || EXTRACT(EPOCH FROM NOW())::TEXT,
  '00000000',
  '테스트회사 (Webhook Test)',
  '000000',
  '🔔 Vercel Webhook 테스트 공시 - ' || TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS'),
  TO_CHAR(NOW(), 'YYYYMMDD'),
  'HIGH',
  'pending'
);

-- 2. 방금 삽입한 테스트 데이터 확인
SELECT
  id,
  corp_name,
  report_nm,
  rcept_no,
  created_at,
  '✅ 테스트 공시 삽입 완료' as status
FROM disclosure_insights
WHERE rcept_no LIKE 'WEBHOOK_TEST_%'
ORDER BY created_at DESC
LIMIT 1;

-- 3. 다음 단계 안내
SELECT '
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 테스트 데이터 삽입 완료!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

다음 단계:

1. Supabase Dashboard → Database → Webhooks → Logs
   → 최신 로그 확인
   → Response Status: 200이면 성공! ✅
   → Response Status: 404이면 실패 ❌

2. Vercel Dashboard → Deployments
   → Source: "Deploy Hook (webhook-name)" 확인
   → 새 배포가 시작되었는지 확인

3. 배포 완료 후:
   → https://k-marketinsight.com 접속
   → 새로운 변경사항 반영 확인

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
' as next_steps;
