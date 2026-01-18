# Vercel 배포 가이드

## 1. Vercel 프로젝트 생성

1. [Vercel Dashboard](https://vercel.com/dashboard)에 로그인
2. "Add New" → "Project" 클릭
3. GitHub 저장소 `yaccurue5-bingl/stockplatform` 선택
4. Root Directory: `my-research-platform` 설정
5. Framework Preset: **Next.js** 자동 감지

## 2. 도메인 설정

### k-marketinsight.com 연결

1. Vercel 프로젝트 → **Settings** → **Domains**
2. `k-marketinsight.com` 추가
3. 도메인 registrar에서 DNS 설정:

```
Type: A
Name: @
Value: 76.76.21.21

Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

## 3. 환경 변수 설정

Vercel 프로젝트 → **Settings** → **Environment Variables**에서 아래 변수들을 추가하세요.

### 필수 환경 변수

#### Supabase 설정
```bash
NEXT_PUBLIC_SUPABASE_URL=https://rxcwqsolfrjhomeusyza.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

**⚠️ 중요**: Supabase Dashboard → Project Settings → API에서 확인

#### 결제 시스템 (Paddle)
```bash
PADDLE_VENDOR_ID=your-paddle-vendor-id
PADDLE_API_KEY=your-paddle-api-key
PADDLE_WEBHOOK_SECRET=your-paddle-webhook-secret
NEXT_PUBLIC_PADDLE_VENDOR_ID=your-paddle-vendor-id
```

**설정 방법**:
1. [Paddle Dashboard](https://vendors.paddle.com/) 로그인
2. Developer Tools → Authentication → API Key 생성
3. Developer Tools → Notifications → Webhook Secret 확인

#### AI API (선택사항 - AI 분석 기능용)
```bash
OPENAI_API_KEY=sk-...
# 또는
GROQ_API_KEY=gsk_...
```

#### 한국 공시 API (DART)
```bash
DART_API_KEY=your-dart-api-key
```

**설정 방법**:
1. [DART OpenAPI](https://opendart.fss.or.kr/) 가입
2. 인증키 발급

#### Cron Job 보안
```bash
CRON_SECRET_TOKEN=random-secure-token-here
```

**생성 방법**:
```bash
# 로컬에서 실행
openssl rand -base64 32
```

#### 앱 URL
```bash
NEXT_PUBLIC_APP_URL=https://k-marketinsight.com
```

### 환경별 설정

- **Production**: 모든 환경 변수 필수
- **Preview**: Production과 동일 (테스트용)
- **Development**: `.env.local` 파일 사용 (Git에 커밋 안 됨)

## 4. 빌드 설정

Vercel은 자동으로 감지하지만, 수동 설정이 필요한 경우:

### General Settings
```
Framework: Next.js
Build Command: npm run build
Output Directory: .next
Install Command: npm install
Root Directory: my-research-platform
```

### Node.js Version
```
Node.js Version: 20.x
```

## 5. Webhook URL 설정

배포 완료 후, Webhook URL을 각 서비스에 등록하세요.

### Paddle Webhook
```
URL: https://k-marketinsight.com/api/paddle/webhook
Events: subscription.created, subscription.updated, subscription.canceled, payment.succeeded, payment.failed
```

### Vercel Cron Jobs
Vercel Dashboard → Project → Cron Jobs:

```json
{
  "crons": [
    {
      "path": "/api/cron/collect-krx",
      "schedule": "0 9 * * 1-5"
    },
    {
      "path": "/api/cron/analyze-disclosures",
      "schedule": "0 10 * * 1-5"
    }
  ]
}
```

**Headers 추가**:
```
Authorization: Bearer your-cron-secret-token
```

## 6. 배포 확인

### 체크리스트

- [ ] 빌드 성공 (Build logs 확인)
- [ ] 도메인 연결 완료 (`https://k-marketinsight.com` 접속 가능)
- [ ] 로그인/회원가입 테스트
- [ ] Supabase 연결 확인
- [ ] Paddle 결제 테스트 (Sandbox)
- [ ] Cron job 실행 확인

### 빌드 로그 확인

```bash
# 로컬 빌드 테스트
npm run build

# 빌드 성공 시 출력:
✓ Compiled successfully
✓ Generating static pages
✓ Finalizing page optimization
Route (app)
  ○ /
  ○ /login
  ○ /signup
  ○ /dashboard
  ƒ /api/stripe/webhook
```

## 7. 문제 해결

### 빌드 실패

**증상**: `Module not found` 또는 `Type error`

**해결**:
```bash
# 로컬에서 빌드 테스트
npm run build

# 실패 시 로그 확인
```

### 환경 변수 누락

**증상**: `Missing XXXX environment variable`

**해결**: Vercel Settings → Environment Variables에서 누락된 변수 추가 후 재배포

### 도메인 연결 실패

**증상**: `ERR_NAME_NOT_RESOLVED`

**해결**:
1. DNS 설정 확인 (전파에 최대 48시간 소요)
2. `nslookup k-marketinsight.com` 명령어로 DNS 확인

### Supabase 연결 오류

**증상**: `Failed to fetch user` 또는 `Invalid JWT`

**해결**:
1. Supabase Dashboard → Project Settings → API에서 키 확인
2. Vercel 환경 변수에 올바른 키 입력
3. 재배포

## 8. 성능 최적화

### Edge Functions
Middleware는 자동으로 Edge Runtime에서 실행됩니다.

### Image Optimization
Next.js Image Optimization 자동 활성화

### Caching
- Static pages: 자동 캐싱
- API routes: `revalidate` 옵션 설정

## 9. 모니터링

### Vercel Analytics
```bash
npm install @vercel/analytics
```

### Error Tracking
Vercel Logs → Runtime Logs에서 에러 확인

## 10. 보안 체크리스트

- [ ] `SUPABASE_SERVICE_ROLE_KEY`는 절대 클라이언트에 노출 안 됨
- [ ] `CRON_SECRET_TOKEN`으로 Cron job 보호
- [ ] Paddle Webhook 서명 검증
- [ ] CORS 설정 확인
- [ ] Rate limiting 적용 (Vercel Firewall)
- [ ] HTTPS 강제 (자동 적용)

## 11. 배포 명령어

### 자동 배포
- `main` 브랜치 push 시 자동 배포
- PR 생성 시 Preview 배포

### 수동 배포
```bash
# Vercel CLI 설치
npm i -g vercel

# 배포
vercel --prod
```

## 12. 롤백

문제 발생 시:
1. Vercel Dashboard → Deployments
2. 이전 정상 배포 선택
3. "Promote to Production" 클릭

---

## 추가 리소스

- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Paddle Documentation](https://developer.paddle.com/)