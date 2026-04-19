# Middleware 가이드

## ⚠️ 핵심 규칙: 파일 이름은 반드시 `middleware.ts`

Next.js는 **프로젝트 루트의 `middleware.ts` (또는 `middleware.js`)** 파일만 미들웨어로 실행합니다.

```
frontend/
├── middleware.ts   ✅ Next.js가 인식하고 실행
├── proxy.ts        ❌ 빌드 시 타입 검사만, 절대 실행 안 됨 (삭제됨)
├── auth.ts         ❌ 마찬가지
└── guard.ts        ❌ 마찬가지
```

### 왜 proxy.ts가 빌드 에러를 유발했나?

Next.js 빌드는 `tsconfig.json`에 포함된 **모든 `.ts` 파일을 TypeScript 타입 검사**합니다.  
`proxy.ts`는 미들웨어로 실행되지 않지만, `next/server`, `@supabase/ssr` 등을 임포트하기 때문에  
타입 불일치가 생기면 빌드가 실패합니다.

→ 해결책: **`middleware.ts` 하나로 통합, `proxy.ts` 삭제**

---

## middleware.ts 처리 순서

```
요청
 │
 ├─ 1. vercel.app 도메인? → X-Robots-Tag: noindex 응답 (SEO)
 │
 ├─ 2. www.* 도메인? → non-www 301 리다이렉트 (SEO canonical)
 │
 ├─ 3. X-API-Key 헤더 + /api/v1/*? → 통과 (B2B API 자체 인증)
 │
 ├─ 4. /api/cron/*? → Authorization: Bearer {CRON_SECRET_TOKEN} 검증
 │
 ├─ 5. Public 경로? → 통과 (아래 목록 참조)
 │
 ├─ 6. 세션 없음? → /login?redirectTo=... 리다이렉트
 │
 └─ 7. /stock/*? → subscriptions 테이블 Pro 플랜 확인
```

## Public 경로 목록

인증 없이 접근 가능한 경로 (`prefixPublicPaths`):

| 경로 | 설명 |
|------|------|
| `/` | 랜딩 페이지 |
| `/signal/*` | SEO 공시 시그널 페이지 |
| `/disclosures/*` | 공시 상세 (공개 미끼) |
| `/korea-*-signals` | SEO 랜딩 페이지 |
| `/pricing` | 가격 페이지 |
| `/api-docs` | API 문서 |
| `/datasets` | 데이터셋 소개 |
| `/api/v1/*` | B2B REST API (X-API-Key 자체 인증) |
| `/api/market-radar-widget` | 랜딩 Market Radar 위젯 |
| `/api/disclosures/latest` | 메인 공시 목록 |
| `/auth/callback`, `/auth/confirm` | Supabase OAuth 콜백 |
| `/terms`, `/privacy`, `/refund-policy` | 법적 문서 |

---

## 새 공개 API 추가 시

`middleware.ts`의 `prefixPublicPaths` 배열에 경로를 추가해야 합니다.

```ts
const prefixPublicPaths = [
  // ...기존 경로...
  '/api/my-new-public-endpoint',  // ← 추가
];
```

추가하지 않으면 미인증 요청이 `/login`으로 리다이렉트됩니다.

---

## TypeScript 타입 갱신

새 테이블/컬럼 추가 후 `types/database.ts`를 갱신해야 빌드 에러가 사라집니다.

```bash
# Supabase MCP 또는 CLI로 재생성
npx supabase gen types typescript --project-id <PROJECT_ID> > types/database.ts
```

갱신하지 않으면 `.from('new_table')` 호출 시 TypeScript 에러가 발생합니다.
