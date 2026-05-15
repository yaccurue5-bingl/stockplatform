# Infrastructure Overview — k-marketinsight

Last updated: 2026-05-14  
Source of truth: this file. Cross-reference `docs/env-registry.md` for all credentials.

---

## Frontend

| Item | Detail |
|---|---|
| Hosting | **Vercel** (region: `icn1` Seoul) |
| Framework | Next.js App Router |
| Domain | k-marketinsight.com |
| Analytics | Vercel Analytics (`@vercel/analytics`) |
| Error tracking | Sentry (`@sentry/nextjs`) — tunnel via `/monitoring` |
| APM | New Relic (`newrelic` package, conditional on `NEW_RELIC_LICENSE_KEY`) |

---

## Database / Auth

| Item | Detail |
|---|---|
| Provider | **Supabase** |
| Project ID | `ojzxvaojuglgqmvxhlzh` |
| DB | PostgreSQL (managed by Supabase) |
| Auth | Supabase Auth (Google OAuth + Email/Password) |
| Storage | Supabase Storage |
| Cache | Redis (`ioredis`, `KV_URL` / `REDIS_URL`) |

---

## Backend Workers

| Item | Detail |
|---|---|
| Host | **Railway** |
| Runtime | FastAPI (`uvicorn main:app`), nixpacks builder |
| Role | Data ingestion workers, cron jobs, event processing |

Python scripts in `scripts/` run locally or via Railway cron.

---

## AI / LLM

| Provider | Model | Used For |
|---|---|---|
| **Groq** | llama / mixtral (OpenAI-compat endpoint) | Primary disclosure analysis |
| **Anthropic (Claude)** | `claude-3-5-sonnet-20241022` | Secondary analysis, summarization |

> ⚠️ `OPENAI_API_KEY` is NOT used — analysis runs on Groq + Anthropic.

---

## Email

| Service | Used For |
|---|---|
| **Resend** | Transactional email (welcome, digest, contact, request-access) |

> ⚠️ **Zoho Mail** — listed in earlier planning docs but NOT integrated in code. Remove from consideration or add manually.

---

## Billing

| Service | Detail |
|---|---|
| **Paddle** | Subscription billing, webhook at `/api/paddle/webhook` |

> ⚠️ **Stripe** — `stripe` npm package installed and DB has `stripe_customer_id` / `stripe_subscription_id` columns, but **no implementation** (`/api/stripe/` route does not exist). Dead code from a previous billing provider. Requires cleanup.

---

## Social / Notifications

| Service | Detail |
|---|---|
| **Twitter / X** | Signals posted via `scripts/post_tweet.py` (manual/Tweepy) |
| **Telegram** | Signals posted via `scripts/post_telegram.py` |

---

## Monitoring

| Tool | Status | Purpose |
|---|---|---|
| **Sentry** | ✅ Integrated | Error tracking, frontend + edge + server |
| **Vercel Analytics** | ✅ Integrated | Page views, web vitals |
| **New Relic** | ⚠️ Conditional | APM — only active if `NEW_RELIC_LICENSE_KEY` is set |
| **Microsoft Clarity** | ❌ Not integrated | Session replay (planned) |
| **PostHog** | ❌ Not integrated | Product analytics (planned) |
| **Better Stack / UptimeRobot** | ❌ Not integrated | Uptime monitoring (planned) |

---

## Stale / Dead Services

| Service | Status |
|---|---|
| **Firebase** | `firebase.json` exists (old frontend SPA config) — no SDK imported. Safe to delete. |
| **Stripe** | Package + DB columns remain — replaced by Paddle. Needs cleanup. |

---

## Service Criticality

| Service | Criticality | Notes |
|---|---|---|
| Supabase | CRITICAL | DB + Auth down = full outage |
| Vercel | HIGH | Frontend down |
| Railway | HIGH | No new data ingestion |
| Paddle | HIGH | No new subscriptions |
| Groq / Anthropic | HIGH | Analysis pipeline stops |
| Resend | MEDIUM | No emails sent |
| DART API | HIGH | No new disclosures |
| Sentry | MEDIUM | Blind to errors |
| Redis | MEDIUM | API cache misses only |
| Telegram / Twitter | LOW | Social posting only |
