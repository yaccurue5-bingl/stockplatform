# Claude Code 작업 지침

## 기존 로직 수정 시 규칙 (필수)

**기존 로직을 크게 바꾸는 경우 실행 전 반드시 사용자에게 확인한다.**

- 버그 수정·성능 최적화라도 기존 설계 의도를 바꾸는 경우 → 먼저 설명하고 승인 후 실행
- 새 함수 추가 / 필터 순서 변경 등 minor 개선 → 실행 후 설명해도 OK
- 기존 함수 삭제·대체·호출 방식 변경 → 반드시 먼저 물어볼 것
- 판단 기준: "기존 코드 작성자가 의도한 흐름이 바뀌는가?" → Yes면 확인 필수

### UI 인터랙션 패턴 변경 금지 (절대 금지)

**다른 파일을 수정하다가 기존 UI 인터랙션 패턴을 변경하는 것은 절대 금지.**

금지 사례 (사용자 명시적 승인 없이 절대 하지 말 것):
- 팝업/모달 → `mailto:` 링크 또는 앵커 스크롤로 변경
- 폼 제출 → 외부 링크 열기로 변경
- `onClick` 핸들러 → `href` 링크로 변경
- 모달 → 페이지 내 섹션 스크롤로 변경

판단 기준: 버튼·링크 클릭 시 사용자가 경험하는 동작이 달라지면 → **먼저 물어볼 것**

예: "SEO 수정" 작업 중 api-access 페이지의 Request Access 팝업을 mailto로 바꾸는 행위 → 절대 금지


---

## 기능 테스트 규칙 (필수)

**코드 수정 후, 수정한 기능과 연관된 모든 UI·인터랙션을 직접 확인(또는 API 호출)하고 결과를 CLAUDE.md에 기록한다.**

### 테스트 우선 원칙

- "코드상 맞아 보인다"는 커밋 기준이 아니다. **실제 동작 확인 후 커밋한다.**
- API 엔드포인트를 수정했으면 → `curl` 또는 브라우저에서 실제 응답 확인
- UI 컴포넌트를 수정했으면 → 수정된 상호작용 시나리오 직접 확인
- 검색·필터·페이지네이션 등 사용자 인터랙션 → 입력값 넣어서 결과 확인
- **반례**: `analyzed_at` 컬럼 오류 (존재하지 않는 컬럼 → 검색 결과 항상 빈 배열) — 검색창에 한 글자만 입력했으면 즉시 발견 가능했던 버그

### 테스트 후 CLAUDE.md 기록 형식

새 기능 추가 또는 버그 수정 완료 시, 아래 섹션(기능별 테스트 결과)에 해당 항목을 추가한다:

```
| 기능 | 테스트 항목 | 확인 방법 | 결과 | 날짜 |
```

---

## 기능별 테스트 항목 & 결과 이력

### /disclosures 페이지

| 기능 | 테스트 항목 | 확인 방법 | 결과 | 날짜 |
|---|---|---|---|---|
| 목록 로드 | 로그인 후 /disclosures 진입 → 목록 10개 표시 | 브라우저 접속 | ✅ PAGE_SIZE=10 적용 | 2026-04-30 |
| 검색 (Search Company) | 검색창에 회사명/코드 입력 → 결과 표시 | 검색창 입력 | ✅ analyzed_at→updated_at 수정으로 복구 | 2026-04-30 |
| 검색 (이전 상태) | 동일 | 동일 | ❌ analyzed_at 컬럼 없음 → 결과 항상 빈 배열 | (발견 전) |
| 페이지네이션 | 다음 페이지 클릭 → 다른 종목 표시 | 버튼 클릭 | 미확인 |  |
| 종목 상세 | 목록 행 클릭 → 공시 상세 화면 전환 | 클릭 | 미확인 |  |
| 뒤로가기 | 상세에서 Back → 목록 복원 + 스크롤 위치 | 버튼 클릭 | 미확인 |  |

### Navbar 플랜 배지

| 기능 | 테스트 항목 | 확인 방법 | 결과 | 날짜 |
|---|---|---|---|---|
| 플랜 표시 | 로그인 후 홈으로 이동 → FREE flash 없이 DEV/PRO 표시 | 페이지 이동 반복 | ✅ localStorage 캐싱으로 수정 | 2026-04-30 |
| 로그아웃 | 로그아웃 → localStorage 캐시 삭제 → 재로그인 시 올바른 플랜 | 로그아웃+재로그인 | 미확인 |  |

### /api-access 페이지

| 기능 | 테스트 항목 | 확인 방법 | 결과 | 날짜 |
|---|---|---|---|---|
| Request Access 팝업 | 버튼 클릭 → 모달 오픈 → 폼 제출 → mailto 실행 | 클릭 + 폼 작성 | ✅ 팝업 복구 확인 | 2026-04-30 |
| 모달 닫기 | X 버튼 또는 배경 클릭 → 모달 닫힘 | 클릭 | 미확인 |  |

### korea-*-signals 랜딩 페이지

| 기능 | 테스트 항목 | 확인 방법 | 결과 | 날짜 |
|---|---|---|---|---|
| 내부 링크 | 테이블 첫 번째 컬럼 클릭 → /signal/{id} 이동 | 클릭 | ✅ SEO 내부 링크 추가 완료 | 2026-04-30 |
| 실데이터 표시 | 테이블에 실제 공시 데이터 표시 | 브라우저 확인 | ✅ fetchEventTableRows 연동 | 2026-04-30 |

### /signal/{id} 페이지

| 기능 | 테스트 항목 | 확인 방법 | 결과 | 날짜 |
|---|---|---|---|---|
| JSON-LD 구조화 데이터 | Google Rich Results Test 통과 | 검증 도구 | ✅ image 필드 추가 후 수정 | 2026-04-30 |
| SEO 타이틀 | 60자 이내 truncation | 소스 확인 | ✅ | 2026-04-30 |

---

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
