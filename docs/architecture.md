# System Architecture — k-marketinsight

Last updated: 2026-05-14

---

## High-Level Overview

```
외부 데이터                 백엔드 워커               프론트엔드
────────────               ─────────────            ──────────────
DART (FSS)  ──┐            Railway (FastAPI)         Vercel (Next.js)
data.go.kr  ──┤─→ Python ──→ Supabase (PostgreSQL) ←─── SSR / API Routes
ECOS (BOK)  ──┤   Scripts    + Auth + Storage        ↓
MOFE        ──┘              + Redis (cache)      k-marketinsight.com
KRX                          ↓
                        Groq + Anthropic
                        (AI Analysis)
                             ↓
                        disclosure_insights 테이블
```

---

## Data Flow

### 1. 공시 수집 (DART Crawler)
```
scripts/dart_crawler.py
  → opendart.fss.or.kr API 호출
  → raw_disclosures 테이블 저장 (Supabase)
```

### 2. AI 분석 (auto_analyst)
```
scripts/auto_analyst.py  (또는 /api/cron/analyze)
  → raw_disclosures에서 미분석 공시 조회
  → Groq / Anthropic API로 분석 요청
  → disclosure_insights 테이블에 저장
    (headline, key_numbers, sentiment_score, event_type 등)
```

### 3. 시장 데이터 수집
```
scripts/fetch_market_data.py     → daily_indicators
scripts/fetch_ecos_foreign_flow.py → foreign_flow_data
scripts/fetch_listed_shares.py   → listed_shares
scripts/fetch_corp_basic_info.py → corp_basic_info
```

### 4. 프론트엔드 데이터 서빙
```
Vercel Next.js
  → /api/* routes (SSR API)
  → Supabase 직접 쿼리 (RLS 적용)
  → Redis 캐시 (고빈도 쿼리)
```

### 5. 소셜 배포 (수동)
```
scripts/post_tweet.py --dry-run  → 트윗 초안 확인
scripts/post_telegram.py         → Telegram 채널 발송
scripts/send_twitter_digest.py   → 이메일 digest (Resend)
```

---

## 주요 Supabase 테이블

| 테이블 | 설명 |
|---|---|
| `raw_disclosures` | DART에서 수집한 원본 공시 |
| `disclosure_insights` | AI 분석 결과 (headline, sentiment, event_type 등) |
| `daily_indicators` | 시장 지표 (KOSPI/KOSDAQ, 외국인순매수 등) |
| `foreign_flow_data` | ECOS 외국인 자금 흐름 |
| `listed_shares` | 상장 주식 수 |
| `corp_basic_info` | 기업 기본 정보 |
| `snapshot_signals` | 분석 스냅샷 |
| `sector_signals` | 섹터별 신호 |
| `users` | 가입 사용자 (Supabase Auth 연동) |
| `leads` | Request Access 리드 |
| `bookmarks` | 사용자 북마크 |

---

## 인증 흐름

```
사용자 → /login
  → Google OAuth (Supabase) 또는 Email/Password
  → Supabase Session (HttpOnly cookie, sb-*-auth-token)
  → proxy.ts (Next.js middleware) — 보호 라우트 검증
  → /dashboard, /disclosures, /api-key 등 접근
```

Free tier: 50 API calls/day, 기본 기능만  
Member/Pro tier: Paddle 결제 → Supabase users.plan 업데이트 → 전체 기능

---

## 배포 파이프라인

```
git push → claude/dev 브랜치
  → Vercel Preview Deploy (자동)
  → PR → main merge
  → Vercel Production Deploy (자동)
  → Railway는 별도 배포 (Railway CLI 또는 git push)
```

---

## 보안 레이어

| 레이어 | 구현 |
|---|---|
| 미들웨어 | `frontend/proxy.ts` — 인증, 플랜 체크, Cron 보안 |
| DB 접근 | Supabase RLS (Row Level Security) 전 테이블 적용 |
| API 인증 | `CRON_SECRET_TOKEN` (크론 라우트), Supabase Service Role (스크립트) |
| 보안 헤더 | `vercel.json` — CSP, X-Frame-Options, Referrer-Policy 등 |
| Sentry | 에러 추적 + 소스맵 |
