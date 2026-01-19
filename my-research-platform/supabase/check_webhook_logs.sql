-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Webhook 로그 및 문제 진단
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 1. Webhook 로그 테이블 구조 확인
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'supabase_functions'
  AND table_name LIKE '%hook%'
ORDER BY table_name, ordinal_position;

-- 2. 최근 HTTP 요청 로그 (Webhook 포함, 최근 20개)
SELECT
  id,
  status_code,
  content_type,
  created
FROM supabase_functions.http_request
WHERE created >= NOW() - INTERVAL '7 days'
ORDER BY created DESC
LIMIT 20;

-- 2. 404 에러 발생한 Webhook만 조회
SELECT
  id,
  request_url,
  response_status_code,
  response_body,
  error_message,
  created_at,
  '❌ 404 Not Found' as error_type
FROM net._http_response
WHERE response_status_code = 404
ORDER BY created_at DESC
LIMIT 10;

-- 3. 모든 에러 (400번대, 500번대)
SELECT
  id,
  request_url,
  response_status_code,
  response_body,
  error_message,
  created_at,
  CASE
    WHEN response_status_code = 404 THEN '404 Not Found'
    WHEN response_status_code = 401 THEN '401 Unauthorized'
    WHEN response_status_code = 403 THEN '403 Forbidden'
    WHEN response_status_code >= 500 THEN '5xx Server Error'
    ELSE 'Other Error'
  END as error_type
FROM net._http_response
WHERE response_status_code >= 400
ORDER BY created_at DESC
LIMIT 20;

-- 4. 성공한 Webhook (200 OK)
SELECT
  id,
  request_url,
  response_status_code,
  response_body,
  created_at,
  '✅ Success' as status
FROM net._http_response
WHERE response_status_code BETWEEN 200 AND 299
ORDER BY created_at DESC
LIMIT 10;

-- 5. Webhook 통계
SELECT
  CASE
    WHEN response_status_code BETWEEN 200 AND 299 THEN '✅ Success (2xx)'
    WHEN response_status_code = 404 THEN '❌ Not Found (404)'
    WHEN response_status_code = 401 THEN '❌ Unauthorized (401)'
    WHEN response_status_code = 403 THEN '❌ Forbidden (403)'
    WHEN response_status_code >= 500 THEN '❌ Server Error (5xx)'
    ELSE '⚠️ Other'
  END as status_category,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM net._http_response
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY status_category
ORDER BY count DESC;

-- 6. 시간대별 Webhook 실행 현황 (최근 24시간)
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE response_status_code BETWEEN 200 AND 299) as success_count,
  COUNT(*) FILTER (WHERE response_status_code = 404) as not_found_count,
  COUNT(*) FILTER (WHERE response_status_code >= 400) as error_count
FROM net._http_response
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- 7. URL별 Webhook 성공률
SELECT
  request_url,
  COUNT(*) as total_requests,
  COUNT(*) FILTER (WHERE response_status_code BETWEEN 200 AND 299) as success_count,
  COUNT(*) FILTER (WHERE response_status_code = 404) as not_found_count,
  ROUND(
    COUNT(*) FILTER (WHERE response_status_code BETWEEN 200 AND 299) * 100.0 / COUNT(*),
    2
  ) as success_rate
FROM net._http_response
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY request_url
ORDER BY total_requests DESC;

-- 8. 마지막 에러 상세 정보
SELECT
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' as separator,
  '🔍 마지막 404 에러 상세 정보' as title;

SELECT
  id,
  request_method as method,
  request_url as url,
  response_status_code as status,
  response_body as response,
  error_message as error,
  created_at,
  NOW() - created_at as time_ago
FROM net._http_response
WHERE response_status_code = 404
ORDER BY created_at DESC
LIMIT 1;

-- 9. 해결 방법 제안
SELECT
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' as separator,
  '💡 문제 해결 방법' as title;

SELECT
  CASE
    WHEN COUNT(*) FILTER (WHERE response_status_code = 404) > 0 THEN
      '❌ 404 에러 발생 중

원인:
1. Vercel Deploy Hook URL이 잘못됨
2. Deploy Hook이 삭제되었음
3. Git Branch가 맞지 않음

해결 방법:
1. Vercel Dashboard → Settings → Git → Deploy Hooks 확인
2. Hook이 존재하는지, Branch가 "main"인지 확인
3. URL 재생성 후 Supabase Webhook 업데이트
4. curl로 직접 테스트:
   curl -X POST [Vercel Deploy Hook URL]'
    WHEN COUNT(*) FILTER (WHERE response_status_code BETWEEN 200 AND 299) > 0 THEN
      '✅ Webhook 정상 작동 중!

최근 성공 기록: ' || COUNT(*) FILTER (WHERE response_status_code BETWEEN 200 AND 299)::TEXT || '건
마지막 성공: ' || (SELECT created_at FROM net._http_response WHERE response_status_code BETWEEN 200 AND 299 ORDER BY created_at DESC LIMIT 1)::TEXT
    ELSE
      '⚠️ Webhook 실행 기록이 없습니다.

원인:
1. Webhook이 비활성화되어 있음
2. 트리거 이벤트가 발생하지 않음
3. 테이블 이름이나 이벤트 설정이 잘못됨

해결 방법:
1. Supabase Dashboard → Database → Webhooks 확인
2. Webhook이 Enabled 상태인지 확인
3. Events 설정 확인 (INSERT/UPDATE)
4. 테스트 데이터 삽입해서 확인'
  END as diagnosis
FROM net._http_response
WHERE created_at >= NOW() - INTERVAL '7 days';
