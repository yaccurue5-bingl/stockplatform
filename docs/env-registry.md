# Environment Variable Registry

Last updated: 2026-05-14

All variables must be set in:
- **Local dev**: `.env.local` (root of repo, gitignored)
- **Vercel**: Project Settings → Environment Variables
- **Railway**: Service → Variables

---

## Supabase

| Variable | Where set | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + local | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + local | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Railway + local | ✅ (server/scripts only) |

---

## AI / LLM

| Variable | Where set | Required |
|---|---|---|
| `GROQ_API_KEY` | Vercel + Railway + local | ✅ Primary analysis engine |
| `ANTHROPIC_API_KEY` | Vercel + Railway + local | ✅ Secondary analysis |

> `OPENAI_API_KEY` is NOT used. Do not add it.

---

## Paddle (Billing)

| Variable | Where set | Required |
|---|---|---|
| `PADDLE_API_KEY` | Vercel + local | ✅ |
| `PADDLE_WEBHOOK_SECRET` | Vercel | ✅ |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | Vercel + local | ✅ |
| `NEXT_PUBLIC_PADDLE_ENVIRONMENT` | Vercel + local | ✅ (`sandbox` / `production`) |
| `NEXT_PUBLIC_PADDLE_PRICE_ID_STARTER` | Vercel + local | ✅ |
| `NEXT_PUBLIC_PADDLE_PRICE_ID_PRO` | Vercel + local | ✅ |

---

## Resend (Email)

| Variable | Where set | Required |
|---|---|---|
| `RESEND_API_KEY` | Vercel + local | ✅ |
| `CONTACT_RECIPIENT_EMAIL` | Vercel + local | ✅ |

---

## Sentry

| Variable | Where set | Required |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Vercel + local | ✅ |
| `SENTRY_AUTH_TOKEN` | Vercel (CI only) | ✅ for source maps upload |

---

## New Relic (APM)

| Variable | Where set | Required |
|---|---|---|
| `NEW_RELIC_LICENSE_KEY` | Railway | Optional (skipped if missing) |

---

## Redis / KV Cache

| Variable | Where set | Required |
|---|---|---|
| `KV_URL` | Vercel | ✅ (Vercel KV or Upstash) |
| `REDIS_URL` | Railway + local | ✅ (backend) |
| `REDIS_TOKEN` | Railway | If using Upstash REST |

---

## Korean Government / Market Data APIs

| Variable | Service | Where set |
|---|---|---|
| `DART_API_KEY` | OpenDART (FSS) | Railway + local |
| `PUBLIC_DATA_API_KEY` | data.go.kr | Railway + local |
| `ECOS_API_KEY` | 한국은행 ECOS | Railway + local |
| `KOSIS_API_KEY` | KOSIS (통계청) | Railway + local (⚠️ no active code found — reserved) |
| `CLOUDCONVERT_API_KEY` | CloudConvert | Railway + local (PDF conversion for MOFE data) |

---

## Social / Notifications

| Variable | Service | Where set |
|---|---|---|
| `TWITTER_API_KEY` | Twitter/X | local only (manual posting) |
| `TWITTER_API_SECRET` | Twitter/X | local only |
| `TWITTER_ACCESS_TOKEN` | Twitter/X | local only |
| `TWITTER_ACCESS_TOKEN_SECRET` | Twitter/X | local only |
| `TELEGRAM_BOT_TOKEN` | Telegram | local only |
| `TELEGRAM_CHANNEL_ID` | Telegram | local only |

---

## App Config

| Variable | Purpose | Where set |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical URL for OG tags | Vercel + local |
| `NEXT_PUBLIC_APP_URL` | API base URL | Vercel + local |
| `CRON_SECRET_TOKEN` | Auth for `/api/cron/*` routes | Vercel + local |
| `VERCEL_OIDC_TOKEN` | Vercel OIDC (auto-injected) | Vercel (auto) |

---

## Testing (never in production)

| Variable | Purpose |
|---|---|
| `TEST_USER_EMAIL` | Playwright E2E test account |
| `TEST_USER_PASSWORD` | Playwright E2E test account |

---

## Variables NOT used (can remove)

| Variable | Reason |
|---|---|
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe replaced by Paddle |
| `OPENAI_API_KEY` | Not used — Groq + Anthropic instead |
