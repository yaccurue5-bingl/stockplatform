# Claude Code 작업 지침

## 브랜치 정책 (필수)

**새 세션을 시작할 때마다 새 브랜치를 생성하지 말 것.**

모든 작업은 단일 브랜치 `claude/dev`에서만 수행한다:

```bash
git checkout claude/dev
git pull origin claude/dev
# 작업 후:
git add .
git commit -m "..."
git push origin claude/dev
```

- `main` 브랜치에는 직접 커밋하지 않는다.
- `claude/dev` 외에 새로운 `claude/*` 브랜치를 생성하지 않는다.
- 세션이 달라도 항상 `claude/dev` 브랜치를 사용한다.

---

## Next.js 파일 컨벤션 (필수)

### 미들웨어 파일명: `proxy.ts` (NOT `middleware.ts`)

**Next.js 16부터 미들웨어 파일명이 변경되었다:**

```
frontend/proxy.ts    ✅ Next.js 16이 인식하고 실행하는 미들웨어
frontend/middleware.ts  ❌ deprecated — 경고만 발생, 실행 안 됨
```

- `proxy.ts`를 절대 삭제하거나 `middleware.ts`로 이름 변경하지 말 것.
- 인증, Cron 보안, Pro 플랜 체크 등 모든 미들웨어 로직은 반드시 `proxy.ts` 하나에만 작성.
- 세부 내용: `frontend/MIDDLEWARE.md` 참조.

### Supabase TypeScript 타입 갱신

새 테이블/컬럼 추가 후 반드시 `types/database.ts`를 재생성해야 빌드 에러가 사라진다:

```bash
# Supabase MCP generate_typescript_types 도구 사용 (project_id: ojzxvaojuglgqmvxhlzh)
# 생성 결과를 frontend/types/database.ts에 덮어쓰기
```

Supabase 쿼리에서 `GenericStringError` TS 에러 발생 시:
→ `database.ts` 타입이 구식이거나, 쿼리 결과에 명시적 타입 캐스팅 필요:
```ts
import type { Tables } from '@/types/database'
// 반드시 unknown을 경유해야 함 (직접 캐스팅은 TS 에러)
const rows = (data ?? []) as unknown as Tables<'table_name'>[]
```

---

## 빌드 검증 (필수)

**코드 작성 후 커밋 전에 반드시 TypeScript 타입 체크를 통과시킨다.**

```bash
cd ~/stockplatform/frontend && npx tsc --noEmit 2>&1 | grep -E "error TS"
# 출력이 없어야 커밋 가능
```

- 에러가 있으면 수정 후 재확인 → 통과 후 커밋
- `git push` 전에 항상 위 명령 실행
- 빌드 에러를 사용자에게 보고하지 않고 먼저 해결한다

### 자주 발생하는 빌드 에러 패턴

| 에러 | 원인 | 해결 |
|---|---|---|
| `Could not find declaration file for module 'X'` | 타입 미포함 패키지 | `types/X.d.ts` 에 `declare module 'X';` 추가 |
| `GenericStringError` (Supabase) | `database.ts` 구식 | Supabase MCP `generate_typescript_types` 재생성 |
| `implicitly has 'any' type` | 타입 누락 | 명시적 타입 지정 또는 `.d.ts` stub 추가 |

### 새 패키지 설치 시 체크리스트

1. `npm install --save 패키지명` (dependencies에 저장 필수 — Vercel 빌드 대상)
2. 패키지에 타입 포함 여부 확인: `ls node_modules/패키지명/index.d.ts`
3. 타입 없으면 `@types/패키지명` 시도 → 없으면 `types/패키지명.d.ts` stub 작성
4. `npx tsc --noEmit` 통과 확인 후 커밋

---

## 보안 규칙 (필수)

### 시크릿·API 키 절대 하드코딩 금지

**소스 코드·설정 파일에 키 값을 직접 쓰지 않는다.**

```bash
# ❌ 절대 금지 — 값 직접 명시
API_KEY="20e813cb..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbGci..."

# ✅ 올바른 방식 — 환경변수 참조
API_KEY="$API_KEY"
curl -H "X-API-Key: $API_KEY" ...
```

- 모든 키·토큰은 `.env` (gitignore됨) 또는 GitHub Actions Secrets에만 보관한다.
- 코드·커밋 메시지·PR 본문·로그 어디에도 실제 키 값을 쓰지 않는다.
- `.claude/settings.local.json`은 Claude Code 권한 로그이므로 **gitignore 처리** (tracked 상태면 `git rm --cached` 후 `.gitignore`에 추가).

### GitHub Secret Scanning Alert 처리

- **open** alert 발견 시 → 해당 키를 즉시 rotate(무효화)한 뒤 `resolved / revoked`로 닫는다.
- Alert를 닫기 전에 키가 실제로 rotate됐는지 반드시 확인한다.
- Supabase 키 rotate: Supabase Dashboard → Project Settings → API → "Reset" 버튼.

### `.claude/settings.local.json` 관리

- 이 파일은 Claude Code가 자동 생성하는 로컬 권한 캐시이며, 과거 실행 명령이 그대로 기록된다.
- **절대 git에 추적시키지 않는다.** `.gitignore`에 반드시 포함:
  ```
  .claude/settings.local.json
  ```
- 이미 tracked 상태라면: `git rm --cached .claude/settings.local.json`
