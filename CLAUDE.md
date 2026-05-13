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

## Supabase RLS 정책 규칙 (필수)

**DB 테이블을 신규 생성하거나 수정할 때마다, 그 자리에서 즉시 RLS 상태를 확인하고 정책을 설정한다.**

### 테이블 생성·수정 시 체크리스트

1. **테이블 생성 직후** → RLS 활성화 + 정책 추가 (migration SQL에 함께 포함)
2. **기존 테이블 컬럼 추가/변경** → 해당 테이블 RLS 정책 재확인
3. **정책 설계 원칙**:
   - 프론트엔드 클라이언트(anon/authenticated)가 직접 읽는 테이블 → SELECT 정책 명시
   - 스크립트(service_role)만 쓰는 내부 테이블 → RLS만 켜고 정책 없음 (service_role은 자동 bypass)
   - 사용자별 데이터 테이블 → `auth.uid() = user_id` 조건 필수
   - `USING(true)` 남용 금지 → Supabase Advisor "RLS Policy Always True" 경고 발생

### 확인 SQL (작업 후 반드시 실행)

```sql
-- 작업한 테이블의 RLS 상태 확인
SELECT t.tablename, t.rowsecurity, p.policyname, p.cmd, p.roles, p.qual
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
WHERE t.schemaname = 'public' AND t.tablename = '{{테이블명}}'
ORDER BY p.policyname;
```

### 잘못된 패턴 → Supabase Advisor ERROR 발생

```sql
-- ❌ RLS만 켜고 정책 없이 방치 (rls_disabled_in_public or rls_enabled_no_policy)
ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;
-- (정책 추가 안 함)

-- ✅ 올바른 패턴: 용도에 맞는 정책 바로 추가
ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read new_table" ON public.new_table FOR SELECT USING (true);
```

### 정기 점검

세션 시작 시 또는 대규모 DB 변경 후에는 Supabase MCP `get_advisors(type: "security")`로 전체 확인:
```
mcp__supabase__get_advisors(project_id: "ojzxvaojuglgqmvxhlzh", type: "security")
```

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
| 검색 드롭다운 | "삼성" 입력 → 삼성증권/삼성SDS 등 드롭다운 표시 | 브라우저 직접 | ✅ 정상 | 2026-05-01 |
| 페이지네이션 | 다음 페이지 클릭 → 다른 종목 표시 | 버튼 클릭 | ✅ 페이지2 정상 전환 | 2026-05-01 |
| 종목 상세 | 목록 행 클릭 → 공시 상세 화면 전환 | 클릭 | ✅ AI 분석/Key Numbers/Signal Strength 표시 | 2026-05-01 |
| 뒤로가기 | 상세에서 Back → 목록 복원 + 스크롤 위치 | 버튼 클릭 | ✅ 626개 목록 복원 | 2026-05-01 |
| Free 유저 접근 차단 | Free 계정으로 /disclosures 접근 → / 리다이렉트 | 브라우저 | ✅ /pricing → / 정상 차단 | 2026-05-01 |

### Navbar 플랜 배지

| 기능 | 테스트 항목 | 확인 방법 | 결과 | 날짜 |
|---|---|---|---|---|
| 플랜 표시 | 로그인 후 홈으로 이동 → FREE flash 없이 DEV/PRO 표시 | 페이지 이동 반복 | ✅ localStorage 캐싱으로 수정 | 2026-04-30 |
| 로그아웃 | 로그아웃 → localStorage 캐시 삭제 → Login 버튼 표시 | 브라우저 직접 | ✅ kmi_userPlan=null + Navbar Login 버튼 | 2026-05-01 |

### /api-access 페이지

| 기능 | 테스트 항목 | 확인 방법 | 결과 | 날짜 |
|---|---|---|---|---|
| Request Access 팝업 | 버튼 클릭 → 모달 오픈 → 폼 제출 → mailto 실행 | 클릭 + 폼 작성 | ✅ 팝업 복구 확인 | 2026-04-30 |
| 모달 닫기 | X 버튼 또는 배경 클릭 → 모달 닫힘 | 클릭 | ✅ X 버튼 + 배경 클릭 모두 정상 | 2026-05-01 |

### 랜딩 Pricing 섹션 + Request Access 리드 수집

| 기능 | 테스트 항목 | 확인 방법 | 결과 | 날짜 |
|---|---|---|---|---|
| Pricing 섹션 노출 | 랜딩 페이지 스크롤 → Pricing 카드 2개(Pro/API) 표시 | 브라우저 | ✅ 삽입 확인 | 2026-04-30 |
| Request Access 모달 | 플랜 버튼 클릭 → 모달 오픈 → email+use_case 입력 → Submit | curl POST | ✅ API 200 반환 | 2026-04-30 |
| DB 저장 | Submit 후 Supabase leads 테이블 row 저장 | Supabase MCP SELECT | ✅ 3개 테스트 row 확인 | 2026-04-30 |
| 이메일 발송 | Submit 후 admin + user 자동응답 이메일 발송 | 실계정 수신 확인 | 미확인 (Resend 키 설정 필요) |  |
| 모달 성공 상태 | Submit 성공 → CheckCircle + "1-2 business days" 메시지 | 브라우저 직접 | ✅ "Request Received" + CheckCircle 정상 | 2026-05-01 |
| 중복 제출 | 같은 email 두 번 Submit → 두 번째도 200 반환 | curl 2회 | ✅ 정상 허용 (중복 차단 없음) | 2026-04-30 |
| 긴 use_case | 3000자 use_case 전송 → 저장 성공 | curl edge | ✅ TEXT 컬럼 무제한 저장 | 2026-04-30 |

### /pricing 리다이렉트

| 기능 | 테스트 항목 | 확인 방법 | 결과 | 날짜 |
|---|---|---|---|---|
| 비로그인 접근 | /pricing → 로그인 페이지 아닌 홈으로 리다이렉트 | curl | ✅ proxy.ts public path 추가로 수정 | 2026-04-30 |
| 영구 리다이렉트 | /pricing → 308 (Permanent) 반환 | curl -I | ✅ permanentRedirect() 적용 (PR #58) | 2026-04-30 |

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

### 보안·인프라 점검 (2026-05-11)

| 항목 | 테스트 항목 | 확인 방법 | 결과 | 날짜 |
|---|---|---|---|---|
| RLS — snapshot_signals | RLS 켜기 (내부 전용, 정책 없음) | Supabase MCP | ✅ rowsecurity=true | 2026-05-11 |
| RLS — daily_indicators | RLS 켜기 + public SELECT 정책 | Supabase MCP | ✅ Public read 정책 적용 | 2026-05-11 |
| 보안 헤더 | vercel.json에 CSP/X-Frame/X-Content-Type/Referrer/Permissions 추가 | vercel.json | ✅ 엣지 레벨 적용 (배포 후 활성화) | 2026-05-11 |
| /api/health | 헬스체크 엔드포인트 구현 | curl/Playwright | ✅ edge runtime, DB 연결 확인 포함 | 2026-05-11 |
| Leaked password protection | HaveIBeenPwned 연동 | Supabase Dashboard | ⚠️ 수동 설정 필요 (아래 참고) | 2026-05-11 |

### /disclosures 성능 최적화 (2026-05-11)

| 항목 | Before | After | 방법 | 날짜 |
|---|---|---|---|---|
| API 응답 시간 (첫 로드) | 12,800ms (timeout) | ~2,981ms | RPC DISTINCT ON + covering index | 2026-05-11 |
| API 응답 시간 (캐시) | N/A | 532ms | CDN 캐시 히트 | 2026-05-11 |
| DB 쿼리 시간 | 9,918ms (timeout) | 172ms | VACUUM ANALYZE + Index Only Scan (Heap Fetches: 0) | 2026-05-11 |
| /api/health DB check | ❌ 400 (corp_code 컬럼 없음) | ✅ stock_code로 수정 | health/route.ts 수정 | 2026-05-11 |
| users PATCH 400 | ❌ last_session_id 컬럼 없음 | ✅ 컬럼 추가 migration | Supabase migration | 2026-05-11 |

### /disclosures 성능 최적화 2차 (2026-05-13)

| 항목 | Before | After | 방법 | 날짜 |
|---|---|---|---|---|
| DB 쿼리 시간 (heap fetches 재증가) | 2,578ms (Heap Fetches: 9,575) | 650ms (Heap Fetches: 0) | VACUUM ANALYZE 재실행 | 2026-05-13 |
| auth blocking 제거 | 8.6s "Loading..." (auth 완료 대기) | 데이터 도착 즉시 표시 (~3-5s) | accessAllowed===null early return 제거 → 병렬 로딩 | 2026-05-13 |
| 북마크 ids_only 최적화 | 1,362ms TTFB (full JOIN) | ~300ms | ?ids_only=true (disclosure_id만 반환, JOIN 없음) | 2026-05-13 |

### Dashboard MarketRadar 3s 지연 수정 (2026-05-13)

| 항목 | Before | After | 방법 | 날짜 |
|---|---|---|---|---|
| `/api/market-radar-widget` TTFB | 3,267ms (5개 쿼리 순차) | ~600ms (예상) | 5→4 쿼리 + Promise.all 1단계 병렬화 | 2026-05-13 |
| 원인 분석 | `/api/market-radar-widget` 순차 쿼리 5개 | — | Performance Resource Timing API로 측정 | 2026-05-13 |
| sector_signals 2-step 제거 | 날짜 조회 → 데이터 조회 (2 serial) | 단일 쿼리 + client-side filter | `.limit(10)` + `filter(date === maxDate).slice(0,3)` | 2026-05-13 |

### /disclosures 신규 기능 (2026-05-13)

| 기능 | 테스트 항목 | 확인 방법 | 결과 | 날짜 |
|---|---|---|---|---|
| 북마크 아이콘 | 목록 카드 우하단 bookmark 버튼 토글 | 브라우저 클릭 | ✅ BookmarkButton 추가, stopPropagation 적용 | 2026-05-13 |
| 북마크 초기화 | 페이지 로드 시 북마크 상태 로드 | ids_only=true API | ✅ bookmarkedIds Set 초기화 | 2026-05-13 |
| Search onSearch fix | 검색창 입력 → setSearchQuery 직접 호출 | 브라우저 입력 | ✅ router.push silent no-op 버그 수정 | 2026-05-13 |
| 외부 데이터 면책 | ExternalDataNotice 컴포넌트 추가 | 페이지 하단 | ✅ DART/data.go.kr 출처 표시 | 2026-05-13 |
| 로딩 성능 (CDN 캐시 워밍 후) | 10개 카드 표시까지 시간 | DOM 상태 + 타이밍 | ✅ 419ms API 응답, ~2초 내 데이터 표시 | 2026-05-13 |
| 로딩 성능 (콜드 스타트) | 첫 요청 (CDN 캐시 없음) | 콘솔 로그 | ⚠️ ~9초 (Supabase 다중 쿼리 + free tier 지연) | 2026-05-13 |

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

---

## 제품 로드맵 & 시기별 리마인더 (필수)

**세션 시작 시 현재 날짜(currentDate)와 아래 일정을 대조해서, 해당 시기가 되면 사용자에게 먼저 언급한다.**

| 시기 | 목표 | 항목 | 상태 |
|---|---|---|---|
| 2026-05 (이번 달) | 이메일 리스트 확보 | Daily Digest 이메일 (무료 유저 훅) | ✅ 완료 (2026-05-12) |
| 2026-06 (다음 달) | 검색 유입 | `/company/[ticker]` SEO 페이지 | 🔲 미착수 |
| 2026-07 (2개월 후) | 소셜 공유 유발 | `/trending` 공개 대시보드 | 🔲 미착수 |
| 2026-08+ (3개월+) | 데이터 볼륨 충분해지면 | 기관 B2B 영업 시작 | 🔲 미착수 |

### 리마인더 규칙

- 세션 시작 시 `currentDate`가 해당 월에 들어오면 → **"이번 달 로드맵 항목: [항목명] 착수할까요?"** 라고 먼저 말한다.
- 항목 완료 시 위 표의 상태를 `✅ 완료 (YYYY-MM-DD)` 로 업데이트한다.
- 착수 중이면 `🔄 진행 중`으로 표시한다.

### X(Twitter) 수동 게시 워크플로우

Twitter API Free tier는 쓰기 불가 → 트래픽 늘면 Basic($100/mo) 결제 예정. 그 전까지 수동 게시.

**수동 게시 명령어** (매일 또는 배치 후 실행):
```bash
cd ~/stockplatform && python scripts/post_tweet.py --dry-run --limit 5 > /tmp/tweets.txt 2>&1 && cat /tmp/tweets.txt
```

출력에서 각 트윗 텍스트 블록을 복사해 Twitter에 직접 게시.
게시 후 해당 공시 ID의 `tweeted_at`을 수동으로 업데이트해야 중복 방지:
```bash
# Supabase MCP execute_sql 또는 아래 Python 스크립트
cd ~/stockplatform && python -c "
from supabase import create_client; from dotenv import load_dotenv; import os
load_dotenv('.env.local')
sb = create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])
sb.table('disclosure_insights').update({'tweeted_at': 'now()'}).eq('id', 'PASTE-UUID-HERE').execute()
print('done')
"
```
