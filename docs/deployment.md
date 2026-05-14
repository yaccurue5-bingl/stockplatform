# Deployment Guide

Last updated: 2026-05-14

---

## 브랜치 전략

```
main          → Vercel Production 자동 배포
claude/dev    → Vercel Preview 자동 배포 (PR 없어도 Preview URL 생성)
```

**규칙**: 모든 작업은 `claude/dev`에서. `main` 직접 push 금지.

---

## Frontend (Vercel)

### 자동 배포
```bash
git push origin claude/dev   # Preview
git push origin main          # Production (PR merge 후)
```

### 수동 배포 (긴급 시)
```bash
cd frontend
npx vercel --prod   # Vercel CLI 필요: npm i -g vercel
```

### 빌드 검증 (push 전 필수)
```bash
cd frontend
npx tsc --noEmit 2>&1 | grep "error TS"
# 출력 없으면 OK
```

### 환경변수 설정
Vercel Dashboard → Project → Settings → Environment Variables  
→ Production / Preview / Development 환경별 설정

---

## Backend Workers (Railway)

### 배포 방법
Railway는 Git push 기반 자동 배포 또는 Railway CLI 사용.

```bash
# Railway CLI (railway login 필요)
railway up   # 현재 디렉토리 배포
```

### 주요 설정 (railway.toml)
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
```

### 환경변수
Railway Dashboard → Service → Variables

---

## Python Scripts (로컬 실행)

### 환경 설정
```bash
cd stockplatform
pip install -r requirements.txt

# .env.local에 필요한 키 설정 후:
python scripts/dart_crawler.py
python scripts/auto_analyst.py
python scripts/post_tweet.py --dry-run
```

### 주요 스크립트 실행 순서 (일일 배치)
```
1. dart_crawler.py         # 새 공시 수집
2. auto_analyst.py         # AI 분석
3. fetch_market_data.py    # 시장 데이터
4. fetch_ecos_foreign_flow.py  # 외국인 자금 흐름
5. post_tweet.py --dry-run # 트윗 초안 확인 → 수동 게시
```

---

## Supabase

### 마이그레이션
```bash
# Supabase MCP 또는 대시보드에서 직접 SQL 실행
# 파일: docs/sql/ 참고
```

### 타입 재생성 (스키마 변경 후 필수)
```bash
# Supabase MCP generate_typescript_types 사용
# 결과를 frontend/types/database.ts에 덮어쓰기
```

---

## Sentry 소스맵 업로드

`SENTRY_AUTH_TOKEN`이 Vercel에 설정되어 있으면 빌드 시 자동 업로드됨.  
수동 확인: Sentry Dashboard → Releases

---

## 롤백

### Vercel
Dashboard → Deployments → 이전 배포 → "Promote to Production"

### Supabase
마이그레이션 롤백 SQL을 수동으로 작성 후 실행 (자동 롤백 없음)

---

## 체크리스트 (Production 배포 전)

- [ ] `npx tsc --noEmit` 에러 없음
- [ ] `npx playwright test` 통과 (E2E)
- [ ] Supabase RLS 정책 확인 (`get_advisors(type: "security")`)
- [ ] 새 환경변수 Vercel/Railway에 추가
- [ ] Supabase 타입 재생성 완료 (스키마 변경 시)
