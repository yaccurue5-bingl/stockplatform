# K-MarketInsight MVP - 설치 가이드

## 1단계: 패키지 설치

```bash
cd my-research-platform
npm install
```

설치되는 패키지:
- `@supabase/auth-helpers-nextjs` - Next.js Auth 통합
- `stripe` - 결제 처리
- 기존 패키지들은 그대로 유지

---

## 2단계: 환경변수 설정

```bash
cp .env.local.example .env.local
```

그다음 `.env.local` 파일을 열어서 아래 값을 채워주세요:

### Supabase 설정
1. https://supabase.com/dashboard 접속
2. 프로젝트 선택 > Settings > API
3. URL과 anon key 복사

### Stripe 설정
1. https://dashboard.stripe.com/test/apikeys 접속
2. Publishable key, Secret key 복사

### Stripe Webhook 설정
1. https://dashboard.stripe.com/test/webhooks
2. "Add endpoint" 클릭
3. 엔드포인트 URL: `https://your-domain.vercel.app/api/stripe/webhook`
4. 이벤트 선택:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Signing secret 복사

### Stripe Price ID 생성
1. https://dashboard.stripe.com/test/products
2. "Add product" 클릭
3. 이름: "PRO Plan", 가격: $29/month (예시)
4. Price ID 복사 (price_xxx 형식)

---

## 3단계: Supabase 데이터베이스 설정

1. https://supabase.com/dashboard 접속
2. 프로젝트 선택 > SQL Editor
3. `supabase/migrations/001_initial_schema.sql` 파일 내용 복사
4. SQL Editor에 붙여넣기
5. "Run" 버튼 클릭

---

## 4단계: Google OAuth 설정 (선택사항)

1. Supabase Dashboard > Authentication > Providers
2. Google 활성화
3. Google Cloud Console에서 Client ID, Secret 가져오기
4. Redirect URL 설정: `https://your-project.supabase.co/auth/v1/callback`

---

## 5단계: 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 열기

---

## 6단계: Vercel 배포

```bash
# Vercel CLI 설치 (전역)
npm install -g vercel

# 배포
vercel

# 환경변수 설정 (Vercel Dashboard)
# https://vercel.com/your-project/settings/environment-variables
```

환경변수 입력:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PLAN_PRICE_ID`
- `OPENAI_API_KEY`
- `CRON_SECRET_TOKEN` (openssl rand -base64 32로 생성)
- `NEXT_PUBLIC_APP_URL`

---

## 7단계: Cron Job 설정 (Vercel)

`vercel.json` 파일 생성:

```json
{
  "crons": [
    {
      "path": "/api/cron/collect-krx",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/analyze-disclosures",
      "schedule": "0 10 * * *"
    }
  ]
}
```

---

## 문제 해결

### Supabase 연결 안 됨
- `.env.local` 파일 확인
- Supabase 프로젝트 활성화 확인

### Stripe Webhook 안 옴
- Stripe Dashboard > Webhooks에서 이벤트 로그 확인
- 엔드포인트 URL이 정확한지 확인
- HTTPS 사용 중인지 확인 (로컬에서는 Stripe CLI 사용)

### 로그인 안 됨
- Supabase > Authentication > Email Templates 확인
- 이메일 인증 활성화 확인
- RLS 정책 확인

---

## 다음 단계

1. 인증 페이지 작성 (login, signup)
2. 대시보드 UI 구현
3. 결제 버튼 추가
4. 배치 작업 구현

자세한 내용은 개발자에게 문의하세요!
