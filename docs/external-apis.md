# External API Dependencies

Last updated: 2026-05-14

---

## DART / OpenDART (금융감독원)

- **URL**: `https://opendart.fss.or.kr/api/`
- **Key**: `DART_API_KEY`
- **Used in**: `scripts/dart_crawler.py`, `frontend/lib/api/dart.ts`
- **Criticality**: HIGH — 공시 데이터 수집 불가 시 전체 파이프라인 중단
- **Rate limit**: 공시 목록 10,000건/일, 개별 공시 유료 기준 상이
- **주의**: 한국 주말·공휴일 공시 없음 (크롤러 스케줄 조정 필요)

---

## data.go.kr (공공데이터포털)

- **URL**: `https://apis.data.go.kr/`
- **Key**: `PUBLIC_DATA_API_KEY`
- **Used in**: `scripts/fetch_listed_shares.py`, `fetch_corp_basic_info.py`, `fetch_short_interest.py`, `frontend/app/api/datagokr/company/route.ts`
- **Criticality**: MEDIUM — 상장 주식 수, 기업 기본 정보
- **Rate limit**: 서비스별 상이 (일반적으로 1,000~10,000 req/일)

---

## ECOS / 한국은행 (BOK)

- **URL**: `https://ecos.bok.or.kr/api/`
- **Key**: `ECOS_API_KEY`
- **Used in**: `scripts/fetch_ecos_foreign_flow.py`, `backfill_foreign_flow.py`
- **Criticality**: MEDIUM — 외국인 자금 흐름 데이터
- **Rate limit**: 1,000 req/일 (무료 키 기준)

---

## MOFE / 기획재정부 (mofe.go.kr)

- **URL**: `https://www.mofe.go.kr/`
- **Key**: 없음 (공개 웹 scraping)
- **Used in**: `scripts/fetch_mofe_indicator.py`
- **Criticality**: LOW — 거시경제 지표
- **주의**: robots.txt 확인 필요, HTML 구조 변경 시 파싱 깨질 수 있음

---

## CloudConvert

- **URL**: `https://api.cloudconvert.com/v2/jobs`
- **Key**: `CLOUDCONVERT_API_KEY`
- **Used in**: `scripts/backfill_mofe_indicator.py`
- **Purpose**: MOFE PDF 보고서 → 텍스트 변환
- **Criticality**: LOW — backfill 작업에만 사용
- **Rate limit**: 유료 플랜에 따라 상이; 무료: 25 conversion/월

---

## KOSIS (통계청)

- **URL**: `https://kosis.kr/openapi/`
- **Key**: `KOSIS_API_KEY`
- **Status**: ⚠️ Key exists in .env.local but **no active code found**. Reserved for future use.
- **Criticality**: N/A

---

## Groq

- **URL**: `https://api.groq.com/openai/v1/chat/completions`
- **Key**: `GROQ_API_KEY`
- **Used in**: `frontend/lib/api/groq.ts`, AI analysis pipeline
- **Criticality**: HIGH — 1차 공시 분석 엔진
- **Rate limit**: Free tier: 30 req/min, 500 req/day (모델에 따라 상이)
- **주의**: 한국어 출력 방지를 위한 prompt 강화 필요 (auto_analyst.py 참고)

---

## Anthropic (Claude)

- **URL**: `https://api.anthropic.com/v1/messages`
- **Key**: `ANTHROPIC_API_KEY`
- **Model**: `claude-3-5-sonnet-20241022`
- **Used in**: `frontend/lib/api/claude.ts`, analyze-disclosures cron
- **Criticality**: HIGH — 2차 분석 / Groq fallback
- **Rate limit**: Usage tier에 따라 상이

---

## Twitter / X API

- **URL**: Twitter API v2
- **Keys**: `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_TOKEN_SECRET`
- **Used in**: `scripts/post_tweet.py`, `scripts/send_twitter_digest.py`
- **Criticality**: LOW — 마케팅 목적
- **현황**: Free tier는 쓰기 불가 → **수동 게시** 중. Basic($100/월) 결제 시 자동화 가능.
- **Rate limit**: Basic: 1,500 tweets/월

---

## Telegram Bot API

- **URL**: `https://api.telegram.org/bot{token}/`
- **Key**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_ID`
- **Used in**: `scripts/post_telegram.py`
- **Criticality**: LOW — 마케팅 목적
- **Rate limit**: 30 msg/sec per bot (채널 기준 느슨함)

---

## Paddle (Billing)

- **URL**: `https://api.paddle.com/`
- **Key**: `PADDLE_API_KEY`, `PADDLE_WEBHOOK_SECRET`
- **Used in**: `frontend/app/api/paddle/webhook/route.ts`, PaymentModal
- **Criticality**: HIGH — 결제 웹훅 다운 시 구독 처리 불가
- **주의**: Webhook signature 검증 필수 (`PADDLE_WEBHOOK_SECRET`)

---

## Resend (Email)

- **URL**: `https://api.resend.com/emails`
- **Key**: `RESEND_API_KEY`
- **Used in**: welcome email, contact form, digest, request-access
- **Criticality**: MEDIUM
- **Rate limit**: Free: 100 emails/일, 3,000/월

---

## Rate Limit Summary

| API | Free Limit | Paid Plan |
|---|---|---|
| DART | 10,000 req/일 | N/A (무료) |
| data.go.kr | ~1,000 req/일 | N/A (무료) |
| ECOS | 1,000 req/일 | N/A (무료) |
| Groq | 500 req/일 | Usage-based |
| Anthropic | Tier별 | Usage-based |
| Resend | 100 emails/일 | $20/월~ |
| Paddle | N/A | % per transaction |
| Twitter | 쓰기 불가 (Free) | $100/월 (Basic) |
| CloudConvert | 25 conv/월 | 유료 per job |
