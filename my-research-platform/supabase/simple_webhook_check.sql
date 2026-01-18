-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- 간단한 Webhook 테스트 및 확인
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 1. 테스트용 공시 데이터 삽입 (Webhook 자동 트리거)
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
  '웹훅 테스트 회사',
  '000000',
  '🔔 Vercel Webhook 테스트 - ' || TO_CHAR(NOW(), 'HH24:MI:SS'),
  TO_CHAR(NOW(), 'YYYYMMDD'),
  'HIGH',
  'pending'
)
RETURNING
  id,
  corp_name,
  report_nm,
  created_at,
  '✅ 테스트 데이터 삽입 완료 - 이제 Webhook이 트리거되어야 합니다!' as status;

-- 2. 최근 삽입된 테스트 데이터 확인
SELECT
  id,
  corp_name,
  report_nm,
  rcept_no,
  created_at,
  NOW() - created_at as time_since_insert
FROM disclosure_insights
WHERE rcept_no LIKE 'WEBHOOK_TEST_%'
ORDER BY created_at DESC
LIMIT 5;

-- 3. 다음 확인 사항
SELECT '
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 다음 확인 사항:

1. Supabase Dashboard → Database → Webhooks → Logs
   → 방금 트리거된 webhook 로그 확인
   → Response Status가 200이면 성공! ✅
   → Response Status가 404이면 실패 ❌

2. Vercel Dashboard → Deployments
   → Source: "Deploy Hook (trigger.yml)" 확인
   → 새 배포가 시작되었는지 확인

3. 404 에러가 발생하면:
   → Vercel Deploy Hook URL을 curl로 직접 테스트
   → curl -X POST https://api.vercel.com/v1/integrations/deploy/prj_TtzqVSvIYB9fwZWPz2lYTpOFpygU/6wq65wIjTQ

4. curl 테스트에서도 404가 나오면:
   → Vercel Dashboard에서 Deploy Hook 재생성
   → 새 URL을 Supabase Webhook에 업데이트

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
' as instructions;
