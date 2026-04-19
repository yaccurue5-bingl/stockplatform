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
const rows = (data ?? []) as Tables<'table_name'>[]
```
