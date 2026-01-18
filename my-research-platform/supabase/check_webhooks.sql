-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- Supabase Webhook 설정 확인 및 수정
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- 1. 기존 Webhook 확인
SELECT
  id,
  name,
  url,
  events,
  http_method,
  http_headers,
  enabled,
  created_at
FROM supabase_functions.hooks
ORDER BY created_at DESC;

-- 2. Webhook 로그 확인 (최근 10개)
SELECT
  id,
  hook_id,
  event_id,
  status,
  response_status,
  response_body,
  created_at
FROM supabase_functions.hook_logs
ORDER BY created_at DESC
LIMIT 10;

-- 3. 에러 상세 확인
SELECT
  hl.id,
  h.name as hook_name,
  h.url,
  hl.status,
  hl.response_status,
  hl.response_body,
  hl.error,
  hl.created_at
FROM supabase_functions.hook_logs hl
JOIN supabase_functions.hooks h ON hl.hook_id = h.id
WHERE hl.response_status >= 400
ORDER BY hl.created_at DESC
LIMIT 10;
