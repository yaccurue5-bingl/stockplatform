# Webhook 테스트 가이드

## 🎯 목표

Supabase Webhook → Vercel Deploy Hook 연동이 정상 작동하는지 확인

---

## 📋 사전 확인 사항

### 1. Vercel Deploy Hook 설정 확인

**Vercel Dashboard → Settings → Git → Deploy Hooks:**

```
✅ Hook Name: supabase-disclosures (또는 다른 이름)
✅ Git Branch: main
✅ Status: Active
✅ URL: https://api.vercel.com/v1/integrations/deploy/prj_xxxxx/yyyyy
```

### 2. Supabase Webhook 설정 확인

**Supabase Dashboard → Database → Webhooks:**

```
✅ Name: vercel-auto-deploy (또는 다른 이름)
✅ Table: disclosure_insights
✅ Events: Insert (체크됨)
✅ Method: POST
✅ URL: [Vercel Deploy Hook URL]
✅ Enabled: true
```

---

## 🧪 테스트 실행

### Step 1: 테스트 공시 삽입

**Supabase Dashboard → SQL Editor:**

1. `supabase/test_webhook.sql` 파일 열기
2. 전체 복사 → 붙여넣기
3. **Run** 클릭

**예상 결과:**
```sql
✅ 테스트 공시 삽입 완료
corp_name: 테스트회사 (Webhook Test)
report_nm: 🔔 Vercel Webhook 테스트 공시 - 2026-01-18 00:15:23
```

---

### Step 2: Webhook 로그 확인

**Supabase Dashboard → Database → Webhooks → Logs:**

최신 로그 클릭하여 확인:

#### ✅ 성공한 경우:
```
Status: Success
Response Status: 200
Response Body: {"job":{"id":"...","state":"PENDING",...}}
```

#### ❌ 실패한 경우 (404):
```
Status: Failed
Response Status: 404
Response Body: {"error":{"code":"not_found",...}}
```

**404 에러 발생 시:**
1. Vercel Deploy Hook URL이 정확한지 확인
2. Git Branch가 `main`인지 확인
3. Deploy Hook이 삭제되지 않았는지 확인

---

### Step 3: Vercel 배포 확인

**Vercel Dashboard → Deployments:**

**성공 시 보이는 것:**
```
✅ Building...
   Source: Deploy Hook (supabase-disclosures)
   Branch: main
   Commit: 318d919 (최신 커밋)
   Time: Just now
```

**실패 시:**
- 새 배포가 생성되지 않음
- Webhook 로그에서 404 또는 다른 에러 확인 필요

---

## 📊 상세 로그 확인 (SQL)

Supabase SQL Editor에서 실행:

```sql
-- Webhook 로그 확인 (최근 10개)
SELECT
  id,
  hook_name,
  event_type,
  status,
  response_status,
  response_body,
  created_at
FROM supabase_functions.hook_logs
ORDER BY created_at DESC
LIMIT 10;

-- 실패한 Webhook만 확인
SELECT
  hook_name,
  status,
  response_status,
  response_body,
  error,
  created_at
FROM supabase_functions.hook_logs
WHERE status = 'failed'
   OR response_status >= 400
ORDER BY created_at DESC
LIMIT 5;

-- 테스트 공시가 제대로 삽입되었는지 확인
SELECT
  corp_name,
  report_nm,
  rcept_no,
  created_at
FROM disclosure_insights
WHERE rcept_no LIKE 'WEBHOOK_TEST_%'
ORDER BY created_at DESC
LIMIT 5;
```

---

## 🔧 문제 해결

### 문제 1: Response Status 404

**원인:**
- Vercel Deploy Hook URL이 잘못됨
- Git Branch 이름이 맞지 않음
- Deploy Hook이 삭제됨

**해결:**
1. Vercel Dashboard에서 Deploy Hook 재생성
2. 정확한 URL 복사
3. Supabase Webhook URL 업데이트

---

### 문제 2: Response Status 401/403

**원인:**
- Deploy Hook URL에 인증 토큰이 포함되어야 하는데 누락됨

**해결:**
- Vercel Deploy Hook은 URL 자체에 인증 정보가 포함됨
- 전체 URL을 정확히 복사했는지 확인

---

### 문제 3: Webhook이 트리거되지 않음

**원인:**
- Webhook이 비활성화됨
- Events 설정이 잘못됨

**해결:**
1. Supabase Dashboard → Database → Webhooks
2. Webhook 상태가 Enabled인지 확인
3. Events에 "Insert"가 체크되어 있는지 확인

---

### 문제 4: Vercel 배포는 성공했지만 변경사항이 반영 안 됨

**원인:**
- 캐시 문제
- 배포는 되었지만 빌드 실패

**해결:**
1. Vercel Deployment 로그 확인
2. 빌드 에러가 있는지 확인
3. 브라우저 캐시 삭제 (Ctrl+Shift+R)

---

## ✅ 성공 체크리스트

테스트가 성공하면 다음이 모두 확인되어야 합니다:

- [ ] Supabase에 테스트 공시 삽입 성공
- [ ] Webhook 로그에서 Response Status: 200
- [ ] Vercel에 새 배포 생성됨
- [ ] Deployment Source: Deploy Hook
- [ ] 배포 성공 (녹색 체크마크)
- [ ] k-marketinsight.com 접속 가능

---

## 🎉 자동화 완료!

모든 체크리스트가 완료되면 이제 자동화가 작동합니다:

**동작 방식:**
```
1. 새 공시 발생 (Cron Job)
   ↓
2. disclosure_insights에 INSERT
   ↓
3. Supabase Webhook 트리거
   ↓
4. Vercel Deploy Hook 호출
   ↓
5. Vercel 자동 배포
   ↓
6. k-marketinsight.com 업데이트
```

**주기:**
- Cron Job: 15분마다 새 공시 크롤링
- Webhook: 공시 삽입 시 즉시 트리거
- 배포 시간: 약 1~3분

---

## 📞 추가 테스트

### 실제 크롤링 테스트

```bash
# Cron Job 수동 실행
./scripts/trigger-cron.sh
```

**예상 결과:**
1. 새 공시 크롤링 (0~20건)
2. disclosure_insights에 INSERT
3. Webhook 자동 트리거 (각 공시마다!)
4. Vercel 자동 배포

**주의:**
- 공시가 많으면 Webhook이 여러 번 트리거될 수 있음
- Vercel은 중복 배포를 자동으로 병합함
- 걱정하지 마세요!

---

결과를 확인하고 알려주세요! 🚀
