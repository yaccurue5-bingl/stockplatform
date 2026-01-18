# K-MarketInsight Setup Guide

## 1. Supabase 데이터베이스 설정

### SQL 스크립트 실행 순서:

Supabase Dashboard → SQL Editor에서 다음 순서로 실행:

```sql
-- 1. disclosure_insights 테이블 생성 (공시 분석 메인 테이블)
\i supabase/create_disclosure_insights.sql

-- 2. Hash 테이블 생성 (중복 방지)
\i supabase/hash_tables.sql

-- 3. Hot stocks 테이블 생성 (5분 폴링용)
\i supabase/hot_stocks_table.sql

-- 4. RLS 정책 생성 (보안)
\i supabase/policies.sql

-- 5. 테스트 계정을 Premium으로 업그레이드
\i supabase/upgrade_test_user.sql
```

**또는 파일 내용을 복사해서 SQL Editor에 직접 붙여넣기**

---

## 2. Vercel 환경변수 설정

Vercel Dashboard → Settings → Environment Variables

### 필수 환경변수:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# DART API (금융감독원 전자공시시스템)
DART_API_KEY=your-dart-api-key
# 발급: https://opendart.fss.or.kr/

# Groq AI (무료 토큰)
GROQ_API_KEY=your-groq-api-key
# 발급: https://console.groq.com/

# Claude Sonnet API (프리미엄 분석)
ANTHROPIC_API_KEY=sk-ant-your-api-key
# 발급: https://console.anthropic.com/
# ⚠️ 중요: API 키는 "sk-ant-"로 시작합니다

# Cron Job 보안 토큰 (무작위 문자열)
CRON_SECRET_TOKEN=your-random-secret-token-here
# 예: openssl rand -hex 32

# 기능 플래그
ENABLE_SONNET_SAMPLE=true
# Sonnet 샘플 분석 활성화 (무료 사용자용 샘플 1개)

ENABLE_HOT_STOCKS=false
# Hot stocks 5분 폴링 (베타까지 비활성화)
```

---

## 3. Anthropic API 키 발급 방법

### 3-1. Anthropic Console 접속
1. https://console.anthropic.com/ 방문
2. Google/Email로 회원가입/로그인

### 3-2. API 키 생성
1. 좌측 메뉴 → **API Keys** 클릭
2. **Create Key** 버튼 클릭
3. Key 이름 입력 (예: "K-MarketInsight Production")
4. 생성된 키 복사 (**sk-ant-**로 시작)
5. ⚠️ 한 번만 표시되므로 안전한 곳에 저장!

### 3-3. Vercel에 등록
```
Variable Name: ANTHROPIC_API_KEY
Value: sk-ant-api03-xxxxxxxxxxxx...
Environment: Production, Preview, Development
```

---

## 4. 환경변수 확인 방법

### 4-1. Vercel CLI (로컬)
```bash
vercel env pull .env.local
```

### 4-2. 환경변수 리스트 확인
```bash
vercel env ls
```

---

## 5. Cron Job 설정 확인

`vercel.json`에 다음 Cron이 설정되어 있는지 확인:

```json
{
  "crons": [
    {
      "path": "/api/cron/analyze-disclosures",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/cleanup-hashes",
      "schedule": "0 0 * * *"
    }
  ]
}
```

---

## 6. 테스트 계정 정보

### Premium 계정:
- Email: **yaccurue3@naver.com**
- 권한: 모든 Sonnet 분석 접근 가능
- 구독 기간: 1년 (upgrade_test_user.sql 실행 후)

### 확인 방법:
```sql
SELECT
  u.email,
  s.plan_type,
  s.status,
  s.current_period_end
FROM auth.users u
LEFT JOIN subscriptions s ON u.id = s.user_id
WHERE u.email = 'yaccurue3@naver.com';
```

---

## 7. 공시 분석 테스트

### 수동 Cron 실행:
```bash
curl -X GET https://k-marketinsight.com/api/cron/analyze-disclosures \
  -H "Authorization: Bearer YOUR_CRON_SECRET_TOKEN"
```

### 응답 예시:
```json
{
  "success": true,
  "analyzed": 15,
  "failed": 0,
  "tokens_used": 3250,
  "stocks_analyzed": 8,
  "duplicates_skipped": 5,
  "sonnet_sample_analyzed": true,
  "timestamp": "2026-01-17T10:30:00Z"
}
```

---

## 8. 문제 해결

### 8-1. SQL 에러 발생 시
```sql
-- 테이블 존재 확인
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%disclosure%';

-- 테이블 삭제 후 재생성 (주의!)
DROP TABLE IF EXISTS disclosure_insights CASCADE;
```

### 8-2. Anthropic API 키 오류
- 키가 `sk-ant-`로 시작하는지 확인
- Console에서 키가 활성화되어 있는지 확인
- Rate limit 확인: https://console.anthropic.com/settings/limits

### 8-3. 공시 데이터가 안 나올 때
```bash
# DART API 테스트
curl "https://opendart.fss.or.kr/api/list.json?crtfc_key=YOUR_DART_KEY&bgn_de=20260117&end_de=20260117"

# Supabase 데이터 확인
SELECT * FROM disclosure_insights ORDER BY analyzed_at DESC LIMIT 5;
```

### 8-4. 로그인 후 공시 카드 클릭 시 에러
- `subscriptions` 테이블에 데이터가 있는지 확인
- `upgrade_test_user.sql` 실행 확인
- Premium 플래그가 올바른지 확인

---

## 9. 배포 체크리스트

- [ ] Supabase SQL 스크립트 모두 실행
- [ ] Vercel 환경변수 모두 설정
- [ ] ANTHROPIC_API_KEY 발급 및 등록
- [ ] CRON_SECRET_TOKEN 생성 및 등록
- [ ] 테스트 계정 Premium 업그레이드 확인
- [ ] Vercel에 push 후 자동 배포 확인
- [ ] Cron job 수동 실행 테스트
- [ ] 로그인 → 공시 카드 클릭 테스트
- [ ] Sonnet 샘플 분석 결과 확인

---

## 10. 모니터링

### Vercel Logs
```bash
vercel logs --since 1h
```

### Supabase Logs
Supabase Dashboard → Logs → Postgres Logs

### Cron 실행 내역
Vercel Dashboard → Deployments → Logs → Search "cron"

---

완료! 🎉

문제가 있으면 에러 메시지와 함께 문의주세요.
