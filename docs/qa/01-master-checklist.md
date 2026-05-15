# QA Master Production-Readiness Checklist

> Last updated: 2026-05-15
> Use before any major release or after large infra changes.

---

## Infrastructure

| # | Item | Priority | Status |
|---|---|---|---|
| 1.1 | Vercel deployment succeeds with zero build errors | `[CRITICAL]` | |
| 1.2 | `npx tsc --noEmit` passes with 0 errors in `frontend/` | `[CRITICAL]` | |
| 1.3 | Railway workers (`dart_crawler.py`, `auto_analyst.py`) are running (check Railway dashboard) | `[CRITICAL]` | |
| 1.4 | Supabase project `ojzxvaojuglgqmvxhlzh` is not paused | `[CRITICAL]` | |
| 1.5 | GitHub Actions `trigger.yml` — last intraday run succeeded (no red X) | `[HIGH]` | |
| 1.6 | `.env.local` / Vercel env vars contain all required keys (no missing `NEXT_PUBLIC_*`) | `[CRITICAL]` | |
| 1.7 | No secrets hardcoded in source — run `git log --all -S "eyJ" --oneline` to check | `[CRITICAL]` | |
| 1.8 | Vercel preview URLs disabled for branches (or protected by Vercel password) | `[MEDIUM]` | |

---

## Frontend (Next.js 16)

| # | Item | Priority | Status |
|---|---|---|---|
| 2.1 | `proxy.ts` exists at `frontend/proxy.ts` (not `middleware.ts`) | `[CRITICAL]` | |
| 2.2 | No React hydration mismatches in browser console on first load | `[HIGH]` | |
| 2.3 | `next.config.js` — `images.domains` includes all external image hosts | `[MEDIUM]` | |
| 2.4 | All dynamic routes (`/signal/[id]`, `/stock/[ticker]`) return 404 gracefully for unknown IDs | `[HIGH]` | |
| 2.5 | `not-found.tsx` renders correctly for 404 paths | `[MEDIUM]` | |
| 2.6 | `global-error.tsx` renders for unhandled errors (test with `/sentry-example-page`) | `[HIGH]` | |
| 2.7 | `robots.ts` and `sitemap.ts` return valid responses at `/robots.txt` and `/sitemap.xml` | `[HIGH]` | |
| 2.8 | `layout.tsx` includes `<Analytics />` (Vercel) and Clarity script | `[MEDIUM]` | |

---

## Backend API Routes

Test each route returns expected status. See `05-api-validation.md` for curl examples.

| Route | Method | Priority | Expected |
|---|---|---|---|
| `/api/health` | GET | `[CRITICAL]` | 200, `{ status:"ok", db:"ok" }` |
| `/api/disclosures/latest` | GET | `[CRITICAL]` | 200, array of disclosures |
| `/api/search` | GET `?q=삼성` | `[HIGH]` | 200, dropdown results |
| `/api/bookmarks` | GET (authed) | `[HIGH]` | 200, bookmark list |
| `/api/market-radar-widget` | GET | `[HIGH]` | 200, TTFB < 1s |
| `/api/hot-stocks` | GET | `[MEDIUM]` | 200, array |
| `/api/paddle/webhook` | POST | `[CRITICAL]` | 200 on valid sig, 401 on invalid |
| `/api/cron/analyze-disclosures` | GET + secret header | `[CRITICAL]` | 200 or 401 without header |
| `/api/request-access` | POST | `[HIGH]` | 200, row in `leads` table |
| `/api/v1/disclosures` | GET + API key | `[HIGH]` | 200 with key, 401 without |
| `/api/digest/unsubscribe` | GET | `[MEDIUM]` | 200, user preference updated |
| `/api/contact` | POST | `[MEDIUM]` | 200, email sent via Resend |
| `/api/event-score/[event_type]` | GET | `[MEDIUM]` | 200, score stats |
| `/api/financials/[stock_code]` | GET | `[MEDIUM]` | 200, financial data |
| `/api/short/[stock_code]` | GET | `[LOW]` | 200, short interest data |

---

## Database (Supabase)

| # | Item | Priority | Status |
|---|---|---|---|
| 3.1 | All production tables have RLS enabled | `[CRITICAL]` | |
| 3.2 | `disclosure_insights` — RLS + authenticated SELECT policy | `[CRITICAL]` | |
| 3.3 | `leads` — RLS + INSERT policy for anon | `[HIGH]` | |
| 3.4 | `users` — RLS + `auth.uid() = id` policy | `[CRITICAL]` | |
| 3.5 | `snapshot_signals` — RLS on, no public SELECT (internal only) | `[HIGH]` | |
| 3.6 | `daily_indicators` — RLS + public SELECT policy + GRANT to anon | `[HIGH]` | |
| 3.7 | Supabase Advisor security check: `get_advisors(type:"security")` returns 0 errors | `[HIGH]` | |
| 3.8 | Index on `disclosure_insights(rcept_dt DESC, stock_code)` exists (verify with EXPLAIN) | `[HIGH]` | |
| 3.9 | GRANT rules present for tables accessed via PostgREST (`/rest/v1/`) | `[HIGH]` | |
| 3.10 | `dart_corp_codes` — stock_code column present (not corp_code) | `[MEDIUM]` | |

**Quick RLS audit SQL:**
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;
-- Must return 0 rows
```

---

## Cron Jobs (GitHub Actions `trigger.yml`)

| Job | Schedule (KST) | Priority | Verify |
|---|---|---|---|
| Intraday crawl | Every 15 min, Mon–Fri 07:30–15:45 | `[CRITICAL]` | Last run < 30 min ago |
| EOD batch | 16:35 KST weekdays | `[CRITICAL]` | Last run green same day |
| Monthly batch | 15th of month | `[HIGH]` | Last run green on 15th |
| Groq analysis (`analyze-disclosures`) | Triggered by intraday | `[CRITICAL]` | No `--limit` exceeded (≤30/batch) |

Check at: `https://github.com/<org>/stockplatform/actions/workflows/trigger.yml`

---

## Auth Flow (`proxy.ts` Middleware)

| # | Item | Priority | Status |
|---|---|---|---|
| 4.1 | Unauthenticated GET `/disclosures` → redirects to `/` | `[CRITICAL]` | |
| 4.2 | Unauthenticated GET `/dashboard` → redirects to `/` | `[CRITICAL]` | |
| 4.3 | Unauthenticated GET `/bookmarks` → redirects to `/` | `[CRITICAL]` | |
| 4.4 | Free-plan user GET `/disclosures` → redirects to `/` | `[CRITICAL]` | |
| 4.5 | Expired session cookie → redirect to login, not crash | `[HIGH]` | |
| 4.6 | `/pricing` is in public paths list in `proxy.ts` | `[HIGH]` | |
| 4.7 | `kmi_userPlan` localStorage cleared on logout | `[HIGH]` | |
| 4.8 | Navbar shows correct plan badge (no FREE flash on page nav) | `[MEDIUM]` | |

---

## Payment & Subscription (Paddle)

| # | Item | Priority | Status |
|---|---|---|---|
| 5.1 | Paddle webhook `/api/paddle/webhook` validates `Paddle-Signature` header | `[CRITICAL]` | |
| 5.2 | Successful payment → `users` table `plan` updated to `pro` | `[CRITICAL]` | |
| 5.3 | Cancellation event → plan downgraded correctly | `[HIGH]` | |
| 5.4 | Paddle test mode (`sandbox`) used in staging, live keys in prod | `[CRITICAL]` | |
| 5.5 | `/api/subscription/portal` returns valid Paddle portal URL | `[HIGH]` | |
| 5.6 | Plan gating: `/disclosures` accessible after subscription activation | `[CRITICAL]` | |

---

## SEO

| # | Item | Priority | Status |
|---|---|---|---|
| 6.1 | `/sitemap.xml` — includes `/signal/[id]` pages, SEO landing pages | `[HIGH]` | |
| 6.2 | `/robots.txt` — disallows `/api/`, `/auth/`, `/dashboard` | `[HIGH]` | |
| 6.3 | `/signal/[id]` — JSON-LD `NewsArticle` schema passes Google Rich Results Test | `[HIGH]` | |
| 6.4 | SEO landing pages (`/korea-earnings-signals`, etc.) have unique `<title>` under 60 chars | `[MEDIUM]` | |
| 6.5 | `og:image` present on all public pages | `[MEDIUM]` | |
| 6.6 | Canonical URLs set (no duplicate content from pagination) | `[MEDIUM]` | |

---

## Monitoring

| # | Item | Priority | Status |
|---|---|---|---|
| 7.1 | Sentry DSN set in env (`NEXT_PUBLIC_SENTRY_DSN`) | `[HIGH]` | |
| 7.2 | Test Sentry: visit `/sentry-example-page` → error appears in Sentry dashboard | `[HIGH]` | |
| 7.3 | Vercel Analytics: `<Analytics />` in `layout.tsx` | `[MEDIUM]` | |
| 7.4 | Microsoft Clarity: script with ID `wqsx12yrv2` in `layout.tsx` | `[MEDIUM]` | |
| 7.5 | `/api/health` pinged externally every 5 min (UptimeRobot/BetterStack) | `[HIGH]` | |

---

## Security

| # | Item | Priority | Status |
|---|---|---|---|
| 8.1 | CSP header in `vercel.json` (`Content-Security-Policy`) | `[HIGH]` | |
| 8.2 | `X-Frame-Options: DENY` in `vercel.json` | `[HIGH]` | |
| 8.3 | `X-Content-Type-Options: nosniff` in `vercel.json` | `[HIGH]` | |
| 8.4 | No `.env` or `.env.local` committed to git | `[CRITICAL]` | |
| 8.5 | `.claude/settings.local.json` in `.gitignore` | `[HIGH]` | |
| 8.6 | GitHub Secret Scanning alerts: all resolved/revoked | `[CRITICAL]` | |
| 8.7 | Supabase "Leaked password protection" enabled (Dashboard → Auth settings) | `[MEDIUM]` | |

---

## Mobile & Browser Compatibility

| # | Item | Priority | Status |
|---|---|---|---|
| 9.1 | `/disclosures` usable on iPhone 14 viewport (375px) | `[HIGH]` | |
| 9.2 | iOS Safari back-swipe returns to list with scroll position restored | `[HIGH]` | |
| 9.3 | Touch targets ≥ 44px on all interactive elements | `[MEDIUM]` | |
| 9.4 | No horizontal overflow on mobile (no x-scroll on body) | `[MEDIUM]` | |
| 9.5 | Android Chrome tested (search dropdown, auth flow) | `[MEDIUM]` | |

---

## Legal Pages

| # | Item | Priority | Status |
|---|---|---|---|
| 10.1 | `/terms` returns 200, content present | `[HIGH]` | |
| 10.2 | `/privacy` returns 200, content present | `[HIGH]` | |
| 10.3 | `/refund-policy` returns 200, content present | `[HIGH]` | |
| 10.4 | Footer links to all three legal pages on every public page | `[HIGH]` | |
