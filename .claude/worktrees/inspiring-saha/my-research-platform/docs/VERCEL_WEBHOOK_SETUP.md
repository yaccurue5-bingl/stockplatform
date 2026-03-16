# Supabase → Vercel Webhook 설정 가이드

## 🔴 404 에러 해결 방법

### 문제: Vercel Deploy Hook 호출 시 404 에러

```
Vercel Response Code: 404
❌ Deploy Hook failed with status 404
```

---

## ✅ 해결 단계

### Step 1: Vercel Deploy Hook 확인

1. **Vercel Dashboard** 접속
2. 프로젝트 선택 → **Settings** → **Git**
3. **Deploy Hooks** 섹션 확인

**올바른 설정:**
- Hook Name: `supabase-disclosures` (또는 원하는 이름)
- Git Branch: **정확한 브랜치 이름 확인!**
- URL: 자동 생성된 URL 복사

---

### Step 2: 브랜치 이름 확인 ⭐ 중요!

**현재 프로젝트의 메인 브랜치 이름 확인:**

```bash
cd /home/user/stockplatform/my-research-platform
git branch --show-current
```

**가능성:**
- ❌ `main` (일반적)
- ✅ `master` (구버전)
- ✅ `claude/setup-project-build-ICsxg` (현재 작업 브랜치)

**Vercel Deploy Hook은 정확한 브랜치 이름을 사용해야 합니다!**

만약 현재 작업 브랜치가 `claude/setup-project-build-ICsxg`라면:
- Deploy Hook도 `claude/setup-project-build-ICsxg`로 설정해야 함
- 또는 `main`/`master` 브랜치로 먼저 merge 후 Deploy Hook 설정

---

### Step 3: Deploy Hook 재생성

**Vercel Dashboard에서:**

1. **Settings** → **Git** → **Deploy Hooks**
2. 기존 Hook 삭제 (있으면)
3. **Create Hook** 클릭
4. 설정:
   - **Hook Name**: `disclosure-insights-update`
   - **Git Branch**: `main` 또는 실제 배포 브랜치
   - **Create Hook** 클릭
5. 생성된 URL 복사:
   ```
   https://api.vercel.com/v1/integrations/deploy/prj_xxxxx/yyyyy
   ```

---

### Step 4: Supabase Webhook 설정

**Supabase Dashboard에서:**

1. **Database** → **Webhooks** 메뉴
2. **Create a new hook** 클릭
3. 설정:

```
Name: vercel-auto-deploy
Table: disclosure_insights
Events: Insert (체크)
Method: POST ⭐ 중요!
URL: [Step 3에서 복사한 Vercel Deploy Hook URL]
HTTP Headers: (비워두기 - 필요 없음)
```

4. **Create webhook** 클릭

---

### Step 5: 테스트

**수동으로 테스트:**

```bash
# Vercel Deploy Hook URL을 직접 호출
curl -X POST https://api.vercel.com/v1/integrations/deploy/prj_xxxxx/yyyyy

# 성공 응답 예시:
# {"job":{"id":"xxx","state":"PENDING","createdAt":1234567890}}

# 404 응답 예시:
# {"error":{"code":"not_found","message":"..."}}
```

**Supabase에서 테스트:**

1. SQL Editor에서 테스트 데이터 삽입:

```sql
-- 테스트 공시 삽입
INSERT INTO disclosure_insights (
  rcept_no,
  corp_code,
  corp_name,
  stock_code,
  report_nm,
  rcept_dt
) VALUES (
  'TEST' || EXTRACT(EPOCH FROM NOW())::TEXT,
  '00000000',
  'TEST COMPANY',
  '000000',
  'Webhook 테스트 공시',
  TO_CHAR(NOW(), 'YYYYMMDD')
);
```

2. **Database** → **Webhooks** → **Logs** 확인
3. 응답 코드가 200이면 성공!

---

## 🔍 404 에러 원인별 해결

### 원인 1: 잘못된 브랜치 이름

**증상:**
```
Deploy Hook: main
실제 브랜치: master (또는 claude/...)
→ 404 에러
```

**해결:**
- Vercel Deploy Hook의 브랜치를 실제 배포 브랜치로 변경
- 또는 작업 브랜치를 main으로 merge

---

### 원인 2: 잘못된 URL

**증상:**
```
URL에 오타가 있거나 잘못 복사됨
```

**해결:**
- Vercel Dashboard에서 Deploy Hook URL 다시 복사
- 공백이나 특수문자 확인

---

### 원인 3: HTTP Method 오류

**증상:**
```
Method: GET (잘못됨)
→ 404 에러
```

**해결:**
- Supabase Webhook Method를 **POST**로 변경
- Vercel Deploy Hook은 POST만 허용

---

### 원인 4: Deploy Hook 삭제됨

**증상:**
```
이전에 생성한 Hook이 삭제되거나 비활성화됨
```

**해결:**
- Vercel Dashboard에서 Deploy Hooks 목록 확인
- 없으면 재생성

---

## 📊 모니터링

### Supabase Webhook 로그 확인

**Dashboard → Database → Webhooks → Logs:**

```
✅ 성공: 200 OK
❌ 실패: 404 Not Found
```

### Vercel 배포 확인

**Dashboard → Deployments:**

- Webhook 트리거 시 새 배포가 시작되어야 함
- Source: `Deploy Hook (disclosure-insights-update)`

---

## 🎯 권장 설정

### Option A: 메인 브랜치 배포 (권장)

1. 작업 브랜치 → main merge
2. Deploy Hook → `main` 브랜치
3. Supabase Webhook → Deploy Hook URL

**장점:**
- 안정적인 프로덕션 배포
- 명확한 배포 흐름

### Option B: 작업 브랜치 자동 배포

1. Deploy Hook → `claude/setup-project-build-ICsxg`
2. Supabase Webhook → Deploy Hook URL

**장점:**
- 즉시 테스트 가능
- 개발 환경에 적합

**단점:**
- 프로덕션 환경에는 부적합

---

## 🔧 현재 브랜치 확인

```bash
# 현재 브랜치 확인
git branch --show-current

# 모든 브랜치 확인
git branch -a

# 원격 브랜치 확인
git branch -r
```

**결과에 따라:**
- `claude/setup-project-build-ICsxg` → Deploy Hook도 동일하게 설정
- `main` → Deploy Hook을 main으로 설정

---

## 💡 빠른 해결 체크리스트

- [ ] Vercel Deploy Hook URL 정확히 복사했는가?
- [ ] HTTP Method가 POST인가?
- [ ] Git Branch 이름이 정확한가?
- [ ] URL에 공백이나 특수문자가 없는가?
- [ ] curl로 수동 테스트 시 성공하는가?
- [ ] Supabase Webhook이 활성화되어 있는가?
- [ ] Vercel Deploy Hook이 삭제되지 않았는가?

---

## 📞 추가 디버깅

### 1. Deploy Hook URL 직접 테스트

```bash
# URL 변수 설정
DEPLOY_HOOK_URL="https://api.vercel.com/v1/integrations/deploy/prj_xxxxx/yyyyy"

# POST 요청
curl -X POST $DEPLOY_HOOK_URL

# 성공 시:
# {"job":{"id":"...","state":"PENDING",...}}

# 실패 시:
# {"error":{"code":"not_found",...}}
```

### 2. Webhook 페이로드 확인

Supabase Webhook은 다음과 같은 데이터를 전송:

```json
{
  "type": "INSERT",
  "table": "disclosure_insights",
  "record": {
    "id": "...",
    "corp_name": "...",
    ...
  },
  "schema": "public",
  "old_record": null
}
```

**Vercel Deploy Hook은 페이로드를 무시하고 단순히 배포만 트리거합니다.**

---

현재 설정을 확인하고 위 단계대로 수정 후 결과 알려주세요!
