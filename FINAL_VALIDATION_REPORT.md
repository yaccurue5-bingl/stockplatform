# Final Validation Report — k-marketinsight
> Generated: 2026-05-15
> Scope: Production codebase audit (real files + live DB queries)

---

## Executive Summary

- **Auth gate is correct**: middleware uses `getUser()` (server-validated JWT), not `getSession()`. However, `/api/disclosures/latest/route.ts` uses deprecated `getSession()` for session validation — this is a real security gap.
- **52,155 pending disclosures** in backlog. The current Groq rate limit (24 calls/min) means clearing the backlog at this batch size would take ~36 days. This is a data quality risk for B2B launch.
- **7,916 completed disclosures are missing `alpha_score`** despite having `headline` — these are invisible to the API's score-based sort/filter.
- **579 records with non-canonical `event_type` values** (ONE_TIME, NEUTRAL, STRUCTURAL, IPO, DEBT, PROXY) will silently be ignored by `compute_signal_tag()` — no tag assigned, no error raised.
- **Search API (`/api/search`) has no auth check** — open to unauthenticated queries and has an N+1 query pattern (one DB call per company result) that will degrade at scale.

---

## 1. Auth & Session

### Findings

| Area | Status | Finding |
|---|---|---|
| Middleware JWT validation | ✅ PASS | `proxy.ts` line 61: uses `supabase.auth.getUser()` — validates JWT against Supabase server on every request |
| Protected route gating | ✅ PASS | All non-public paths redirect to `/login?redirectTo=<path>` if session is absent |
| `/api/disclosures/latest` auth | ❌ FAIL | Line 137: `authClient.auth.getSession()` — reads from cookie without server validation. Malformed/forged cookie passes auth check |
| Cron/admin route protection | ✅ PASS | `proxy.ts` lines 76-93: `CRON_SECRET_TOKEN` checked before route handler runs; 500 if env unset, 401 if header mismatch |
| B2B API key bypass | ✅ PASS | `proxy.ts` lines 68-73: API key routes bypass session middleware correctly |
| Session timer | ✅ PASS | `client-layout.tsx`: 30-minute inactivity timer with `visibilitychange` check on tab restore |
| Multi-device FIFO session | ✅ PASS | `client-layout.tsx` lines 67-123: Supabase Realtime watches `users.last_session_id`; duplicate login triggers forced logout with SweetAlert modal |
| Plan badge flash | ✅ PASS | `localStorage` caching implemented per CLAUDE.md test record (2026-04-30) |
| `/disclosures` public exposure | ⚠️ WARNING | `proxy.ts` line 109: `/disclosures` prefix is fully public. Auth check is done inside the page component (client-side), not in middleware. A user who inspects network traffic can call `/api/disclosures/latest` directly |

### Critical Fix Required

**File**: `frontend/app/api/disclosures/latest/route.ts`, line 137

```ts
// CURRENT (insecure):
const { data: { session } } = await authClient.auth.getSession();

// REQUIRED:
const { data: { user } } = await authClient.auth.getUser();
```

`getSession()` only reads the local cookie without validating the JWT with Supabase. An attacker can craft a syntactically valid but revoked or forged JWT and bypass the plan check that follows.

---

## 2. Disclosure Pipeline

### DB State (live query results, 2026-05-15)

| Status | Count |
|---|---|
| skipped | 56,867 |
| completed | 53,805 |
| **pending** | **52,155** |
| low_quality | 3,953 |
| failed | 62 |
| processing (stuck) | 3 |

### Findings

| Area | Status | Finding |
|---|---|---|
| Duplicate dedup | ✅ PASS | `dart_crawler.py` uses batch `rcept_no` check + `disclosure_hashes` table with 730-day TTL |
| Optimistic locking | ✅ PASS | `auto_analyst.py` lines 519-525: `UPDATE ... WHERE analysis_status='pending'` — only one concurrent instance picks each item |
| Null headline in completed | ✅ PASS | DB query confirms: 0 rows with `analysis_status='completed' AND headline IS NULL` |
| key_numbers null in completed | ✅ PASS | Only 55 rows with `headline IS NOT NULL AND key_numbers IS NULL` — acceptable |
| Stuck `processing` rows | ⚠️ WARNING | 3 rows have `analysis_status='processing'` and `updated_at` > 1 hour ago (last_updated: 2026-05-14 02:35). These will never be retried — the retry loop only fetches `pending`. Need manual reset or a reaper job |
| Pending backlog | 🔴 CRITICAL | 52,155 rows in `pending`. At 24 calls/min (2.5s sleep), throughput is ~1,440/hr. Assuming 200-item batches and single-pass: ~36 hours to clear. This silently suppresses the product's signal quality |
| low_quality rate | ⚠️ WARNING | 3,953 low_quality (6.8% of analyzed). These have no headline/key_numbers and are excluded from the disclosures API |
| non-canonical event_type | ⚠️ WARNING | 579 completed rows have event_type values not in the prompt's 11-value enum: ONE_TIME(377), NEUTRAL(130), STRUCTURAL(61), IPO(8), DEBT(2), PROXY(1). These are Groq hallucinations. `compute_signal_tag()` silently returns `None` for them |
| bare `except: pass` in hash save | ⚠️ WARNING | `dart_crawler.py` lines 503-504: hash save failure is silently ignored. If `disclosure_hashes` insert fails repeatedly, the same disclosure will be reprocessed in next batch |

---

## 3. Score System

### DB State (live query results)

| Metric | base_score | alpha_score |
|---|---|---|
| Min | 3.23 | 9.82 |
| Max | 94.77 | 91.79 |
| Avg | 51.40 | 39.92 |
| Stddev | — | 14.33 |

### Signal Tag Distribution (live)

| Tag | Count |
|---|---|
| 🔥 High Conviction | 8,361 |
| 📉 Earnings Miss | 4,312 |
| ⚖️ Legal Alert | 1,253 |
| ⛔ High Risk | 161 |
| ⚠️ Dilution Risk | 100 |
| ⚠️ Smart Money Selling | 18 |
| ⚠️ Dilution Watch | 3 |
| 🔄 Buyback Signal | 2 |

### Findings

| Area | Status | Finding |
|---|---|---|
| base_score formula | ✅ PASS | S+I+E linear sum (0-100), correct clamp, documented in file header |
| alpha_score formula | ✅ PASS | Weighted sum (base×0.5 + sector×0.2 + market×0.1 + regime×0.2), range 2.5-97.5 correct |
| Null handling | ✅ PASS | All three score functions have explicit neutral fallbacks (S→20, I→15, E→15) when inputs are None |
| LPS collection discontinued | ✅ PASS | Both `auto_analyst.py` line 158 and `compute_base_score.py` line 174 document 2026-04-20 cutoff; `lps=None` → 0 penalty applied correctly |
| alpha_score gap | ⚠️ WARNING | 7,916 completed rows with headlines have `alpha_score IS NULL`. These rows appear in `/api/v1/disclosures` but cannot be sorted/filtered by `alpha_score`. The `compute_alpha_score.py` backfill hasn't been run or completed for these |
| "Smart Money Selling" tag | ❌ FAIL | 18 rows have `signal_tag='⚠️ Smart Money Selling'` — this tag is NOT defined in the current `compute_signal_tag()` function in `compute_base_score.py`. These are stale values from a previous schema that was removed. The tag will appear in the API/UI with no matching filter logic |
| High Conviction rate | ⚠️ WARNING | 8,361 "High Conviction" tags out of ~53,805 completed = 15.5%. If the threshold is `base_score >= 63 AND sentiment >= 0.5`, this rate should be verified against backtested signal quality |
| Score pipeline ordering | ✅ PASS | `trigger.yml` EOD batch runs: DART → LPS → AI → BaseScore → SectorSignals → event_stats in correct sequence |
| event_stats Z-score fallback | ✅ PASS | `compute_base_score.py` lines 851-854: correctly falls back from Z-score to `avg_5d_return` when `z_score is None` |

---

## 4. Disclosures Page & API

### Findings

| Area | Status | Finding |
|---|---|---|
| `/api/disclosures/latest` auth | ❌ FAIL | Uses `getSession()` (see Section 1). Plan check follows the insecure session — the entire auth+plan gate is bypassable |
| `/api/disclosures/latest` unbounded query (stock param) | ⚠️ WARNING | Line 163: `SELECT * FROM disclosure_insights ... LIMIT 50` with `SELECT *` — exposes all columns including raw AI prompts, internal fields. Should column-restrict |
| RPC `get_disclosure_companies` | ✅ PASS | Used in production to replace full-table JS DISTINCT — good |
| CDN cache headers | ✅ PASS | `Cache-Control: s-maxage=60, stale-while-revalidate=300` on list endpoint |
| `/api/v1/disclosures` auth | ✅ PASS | `resolveApiKey()` + `checkPlan()` + `checkRateLimit()` chain before any DB access |
| `/api/v1/disclosures` sort injection | ✅ PASS | `SORT_WHITELIST` Set used at line 78; unrecognized sort params silently default to `rcept_dt` |
| `/api/v1/disclosures` signal_tag filter | ❌ FAIL | `SIGNAL_TAG_VALUES` at line 30 is `['HIGH_CONVICTION', 'CONSTRUCTIVE', 'NEUTRAL', 'NEGATIVE', 'HIGH_RISK']` — these are old enum strings. The DB actually stores emoji-prefixed tags like `"🔥 High Conviction"`. Filtering by `signal_tag` via the API will always return 0 results |
| Bookmarks API auth | ✅ PASS | `route.ts` line 18: `getUser()` checked on both POST and GET before any query |
| Bookmarks unbounded GET | ⚠️ WARNING | `ids_only=true` path limited to 500; full list limited to 200 — acceptable for current scale |
| `/disclosures` page plan check | ⚠️ WARNING | Plan check is client-side only (`useEffect` + `getSupabase()`). SSR renders page HTML before auth check completes. Data isn't loaded until client auth resolves, so no data leak, but the page shell is briefly visible |

---

## 5. API Security & Validation

### Findings

| Area | Status | Finding |
|---|---|---|
| Paddle webhook signature | ✅ PASS | `verifyPaddleWebhook()` uses HMAC-SHA256 with `ts:body` format. Dev bypass only when `NODE_ENV === 'development'` |
| Cron secret enforcement | ✅ PASS | `proxy.ts` and `analyze-disclosures/route.ts` both verify `Bearer <CRON_SECRET_TOKEN>` |
| `/api/search` — no auth | ⚠️ WARNING | `frontend/app/api/search/route.ts`: No session/API key check. Any unauthenticated request can enumerate companies. This route is also listed in `prefixPublicPaths` in proxy.ts (implicitly, via no block) |
| `/api/search` N+1 query | ⚠️ WARNING | Lines 51-69: For each company in results (up to 20), one additional Supabase call fetches its latest disclosure. 20 companies = 21 DB calls per search request. At scale this will be slow |
| `/api/search` ilike injection | ✅ PASS | PostgREST `.ilike()` uses parameterized queries under the hood — `%${query}%` is passed as a bind parameter, not interpolated into SQL |
| `/api/health` | ✅ PASS | Edge runtime, `force-dynamic`, uses `companies` table SELECT for DB check |
| Admin `generate-api-key` | ✅ PASS | Bearer token against `CRON_SECRET_TOKEN`, email regex validation, plan enum validation before any DB write |
| `analyze-disclosures/route.ts` token cap | ✅ PASS | Line 298: stops processing at 5,000 tokens to prevent runaway Groq costs |
| Security headers | ✅ PASS | Per CLAUDE.md: CSP/X-Frame/X-Content-Type/Referrer/Permissions added to `vercel.json` (2026-05-11) |

---

## 6. Monitoring & Reliability

### Findings

| Area | Status | Finding |
|---|---|---|
| Sentry client config | ✅ PASS | `sentry.client.config.ts`: production-only, PII scrubbing (auth/cookie/x-api-key headers stripped), 10% trace sample rate, 100% error replay |
| Sentry server config | ✅ PASS | `sentry.server.config.ts`: same scrubbing policy, production-only |
| `NEXT_PUBLIC_SENTRY_DSN` | ✅ PASS | Confirmed in `docs/env-registry.md` as set in Vercel env vars |
| `/api/health` | ✅ PASS | Checks DB connectivity via `companies` table; returns 503 on failure |
| `check_processing_lag.py` | ✅ PASS | P90 lag alerting in EOD batch (`--alert` flag), 30-min threshold |
| EOD batch monitoring | ✅ PASS | `trigger.yml` line 149: lag check runs after EOD batch with `continue-on-error: true` — alert surfaced as Actions warning |
| GitHub Actions cron schedule | ✅ PASS | 15-min intraday prod batches with `concurrency: cancel-in-progress: true` (no pile-up) |
| Stuck `processing` rows | ⚠️ WARNING | 3 rows stuck since 2026-05-14. No reaper job exists to reset `processing` → `pending` after a timeout. Silent failure — no alert |
| `except: pass` in hash save | ⚠️ WARNING | `dart_crawler.py` line 503-504: hash save failure silently swallowed. Should at minimum log at WARNING level |
| EOD `--alert` is non-blocking | ⚠️ WARNING | `trigger.yml` line 149: `|| true` makes the lag alert non-blocking. The Actions job will show green even if P90 > 30 min. CI/CD intent of `--alert` is defeated |
| Script error handling breadth | ⚠️ WARNING | `auto_analyst.py` top-level `except Exception` on line 175 catches all score computation errors and silently continues. Good for resilience, but errors are only logged at WARNING — no Sentry capture from Python scripts |

---

## 7. Test Coverage

### Test Files and Coverage

| File | Project | Coverage |
|---|---|---|
| `auth.spec.ts` | public (no auth) | Login form, wrong password, invalid email, successful login, logout, back-button after logout, expired session (malformed cookie), multi-tab (login + logout propagation), session persistence on reload, Google OAuth redirect |
| `protected-routes.spec.ts` | authenticated | 5 protected routes (dashboard, api-key, usage, checkout/*), 3 public routes, `/api/v1/disclosures` 401 without key, `/api/health` 200, cron endpoint 401 |
| `api.spec.ts` | authenticated | Health endpoint, disclosures 401/200/content-type, response shape (id/headline/event_type/rcept_dt), limit param, page=2 offset, `q` filter, `event_type` filter, `/api/v1/events` existence, cron auth (wrong secret), 401 error body shape |
| `disclosures-search.spec.ts` | authenticated | List load, search input visibility, search dropdown appears, dropdown selection filters list, clear restores full list, pagination page 2, row click opens detail, detail shows Financial Impact, back button preserves URL |
| `payment.spec.ts` | authenticated | Checkout pages load (starter/pro), Paddle stub fires on CTA click, no auto-trigger, price text visible, terms link, dashboard no-crash |
| `navigation.spec.ts` | authenticated | Logo link, navbar link visibility, back from signal detail, back from disclosures preserves scroll, forward after back, `/signal/[id]` public access without auth |
| `mobile.spec.ts` | mobile-ios + android | Viewport/touch/back-swipe |

### Coverage Gaps (Critical Flows Untested)

| Missing Coverage | Risk |
|---|---|
| Paddle webhook end-to-end (subscription.created → users.plan update) | Payment activation could silently fail |
| Free plan user blocked from `/disclosures` data (plan gating) | Regression risk — Free users should get 403 from `/api/disclosures/latest` |
| `alpha_score` sort/filter in `/api/v1/disclosures` | Signal_tag filter bug (see Section 4) would be caught by integration test |
| `/api/bookmarks` full list (non ids_only) | Dashboard bookmark rendering untested |
| Rate limiting on `/api/v1/disclosures` | No test verifies 429 is returned after N requests |
| Signup flow (email confirmation, welcome email) | Auth.spec covers login only |

---

## Critical Actions Required

### 🔴 CRITICAL

1. **`getSession()` in `/api/disclosures/latest/route.ts` line 137**
   Replace with `getUser()`. The entire plan-gate (paid vs free) for the main disclosure API can be bypassed by presenting any cookie with a valid JWT structure.

2. **`signal_tag` filter in `/api/v1/disclosures/route.ts` line 30**
   `SIGNAL_TAG_VALUES` contains old enum strings (`HIGH_CONVICTION`, `NEGATIVE`, etc.). DB stores emoji strings (`🔥 High Conviction`, `📉 Earnings Miss`). The filter always returns empty results. Fix: update `SIGNAL_TAG_VALUES` to match actual DB values, or add a normalization map.

### ❌ FAIL

3. **52,155 pending disclosures**
   At current single-process Groq throughput, clearing the backlog takes ~36 days. Run multiple `auto_analyst.py --single-pass --limit 200` processes in parallel (they use optimistic locking — safe), or increase `--limit` per batch. Schedule a dedicated backfill GitHub Actions job.

4. **"Smart Money Selling" stale signal tag (18 rows)**
   These rows have a tag that no longer exists in `compute_signal_tag()`. The B2B API returns them; clients will receive an undocumented, unfiltered value. Reset to NULL or map to the nearest valid tag via SQL update.

### ⚠️ WARNING (fix before B2B launch)

5. **Stuck `processing` rows** (`dart_crawler.py` / `auto_analyst.py`)
   Add a reaper: `UPDATE disclosure_insights SET analysis_status='pending' WHERE analysis_status='processing' AND updated_at < NOW() - INTERVAL '2 hours'`. Run on each batch start or as a cron step.

6. **579 non-canonical `event_type` values** (ONE_TIME, NEUTRAL, STRUCTURAL, etc.)
   These produce no signal tags and degrade pipeline metrics. Add them to `_SKIP_EXACT` in `auto_analyst.py` or map to canonical values in a SQL migration. Update Groq prompt to strictly enforce the 11-value enum.

7. **EOD lag alert is non-blocking** (`trigger.yml` line 149)
   Remove `|| true` — let the CI job fail when P90 > 30 minutes so alerts surface in GitHub Actions status.

8. **`/api/search` N+1 pattern** (`frontend/app/api/search/route.ts` lines 51-69)
   Replace per-company disclosure fetch with a single `IN (stock_codes)` query, then join in application memory.

9. **`alpha_score` backfill** — 7,916 scored disclosures missing `alpha_score`
   Run `python scripts/compute_alpha_score.py` to fill the gap.

---

## Re-Validation Pass — 2026-05-15

### Previously CRITICAL Issues

| Issue | Status | Evidence |
|---|---|---|
| `getSession()` → `getUser()` in `/api/disclosures/latest/route.ts` | ✅ RESOLVED | Line 138: `const { data: { user } } = await authClient.auth.getUser();`. Comment confirms intent: "getUser() validates JWT against Supabase server — getSession() only reads cookie". All downstream references use `user.id` and `user.email` — no residual `session.*` references in this file. |
| `SIGNAL_TAG_VALUES` updated to emoji strings, `toUpperCase()` removed from `signalTag` | ✅ RESOLVED | Lines 31-39: Set contains `'🔥 High Conviction'`, `'📉 Earnings Miss'`, `'⚖️ Legal Alert'`, `'⛔ High Risk'`, `'⚠️ Dilution Risk'`, `'⚠️ Dilution Watch'`, `'🔄 Buyback Signal'` — all emoji-prefixed. Line 85: `signalTag = p.get('signal_tag') \|\| ''` with comment "emoji strings are case-sensitive, do NOT toUpperCase()". Sentiment param (line 83) still correctly applies `.toUpperCase()` separately. DB confirms all 7 values are present and `'⚠️ Smart Money Selling'` is gone (see DB checks below). |

### Previously WARNING Issues

| Issue | Status | Evidence |
|---|---|---|
| "Act before the market catches up" removed from `HowItWorks.tsx` | ✅ RESOLVED | Step 03 now reads: "Receive structured signal scores and AI-generated summaries for each filing. Data only — no investment advice." No investment-inducement language remains in HowItWorks. |
| `investment_implications` / "Investor Impact Analysis" removed from `/disclosures` UI rendering | ⚠️ PARTIAL | The field `investment_implications?: string` remains in the `Disclosure` interface (line 34, `page.tsx`) but is **never rendered** in the JSX. Sections now show "AI Summary" (line 709) and "Key Takeaways" (line 677). The field is a dead TypeScript property — no user-visible rendering. It also still appears in `lib/api/claude.ts` (internal server-side type) and legacy SQL files — none are active UI. Risk: low (unused property), but the interface entry is misleading noise. |
| `/api/search` N+1 replaced with single IN query | ✅ RESOLVED | Lines 53-61: single `.in('stock_code', stockCodes)` query fetching up to `stockCodes.length * 3` rows. Map lookup at lines 65-68 (`latestByStock`) correctly picks the first (latest) row per stock_code using insertion-order guarantee on `updated_at DESC` ordered results. Type safety: explicit `DisclosureRow` type cast at line 61. |
| `dart_crawler.py` bare `except: pass` replaced with `logger.warning` | ✅ RESOLVED | No bare `except:` with `pass` remains in the file. All exception handlers use `logger.warning(...)` or `logger.error(...)`. One residual `except Exception: pass` exists at lines 307-308 (XML parse status extraction — benign, result is just `None`) and the env_loader `except Exception: pass` at lines 27-28 (bootstrap-only, intentionally silent). Neither matches the originally flagged pattern. |
| `auto_analyst.py` processing reaper added | ✅ RESOLVED | Lines 486-502: tries `supabase.rpc("reap_stuck_processing")` first; on failure falls back to direct table update with `two_hours_ago = (datetime.now() - timedelta(hours=2)).isoformat()`. `timedelta` is imported at line 6 (`from datetime import datetime, timedelta`). Column names used (`analysis_status`, `updated_at`) are correct. |
| `trigger.yml` `\|\| true` removed from lag check | ✅ RESOLVED | No `\|\| true` found anywhere in the file. The lag check step (line 148-150) now uses `continue-on-error: true` — this is semantically different: `continue-on-error` lets the job continue but marks the step as failed in GitHub UI (yellow warning), while `\|\| true` silently swallowed the failure. This is the intended behavior. |

### DB Validation Results (live queries — 2026-05-15)

| Check | Result | Status |
|---|---|---|
| `signal_tag = '⚠️ Smart Money Selling'` remaining rows | **0** | ✅ RESOLVED — fully purged |
| `analysis_status = 'processing'` stuck rows (> 2 hours) | **0** | ✅ RESOLVED — no stuck rows |
| `headline IS NOT NULL AND alpha_score IS NULL` | **7,916** | ⚠️ CARRY-OVER — unchanged from prior audit (backfill not yet run) |
| Signal tag distribution | 🔥 High Conviction: 8,361 / 📉 Earnings Miss: 4,312 / ⚖️ Legal Alert: 1,253 / ⛔ High Risk: 161 / ⚠️ Dilution Risk: 100 / ⚠️ Dilution Watch: 3 / 🔄 Buyback Signal: 2 | ✅ All 7 values match SIGNAL_TAG_VALUES Set exactly. No legacy/malformed tags remain. |

### New Issues Found

| Issue | Severity | Evidence |
|---|---|---|
| `UseCases.tsx` — "Buy / Neutral / Sell signal" copy | ⚠️ WARNING | `frontend/components/landing/UseCases.tsx` line 21: "investor-focused analysis tells you what it means for the stock, with a clear Buy / Neutral / Sell signal." This is investment-inducement language — implies the product gives trading recommendations. Should be reworded to "Positive / Neutral / Negative sentiment signal" or similar data-descriptor language. Previously unscanned file. |
| `DataProducts.tsx` — "decision-ready insights" copy | ⚠️ WARNING | Line 49: "Not just summaries — but decision-ready insights." Minor, but "decision-ready" implies actionability. Low priority vs. UseCases issue. |
| `/api/search/route.ts` — still no auth check | ⚠️ WARNING (carry-over) | The route uses `service_role` key and returns company names + disclosure IDs. Previously flagged. Not fixed in this pass — still open. Any unauthenticated caller can enumerate the company database and get disclosure IDs. |
| `investment_implications` dead property in `Disclosure` interface | 🆕 LOW | `page.tsx` line 34: `investment_implications?: string` declared but never read or rendered. Remove to avoid confusion about whether this field is still in use. |

### Remaining Open Items

| Item | Priority | Notes |
|---|---|---|
| `alpha_score` backfill (7,916 rows) | HIGH | Unchanged since last audit. Run `compute_alpha_score.py`. |
| `UseCases.tsx` "Buy / Neutral / Sell signal" wording | MEDIUM | New find — reword before B2B launch |
| `/api/search` missing auth check | MEDIUM | Any caller can search the company DB. Add `getUser()` check or restrict to authenticated sessions. |
| `investment_implications` dead interface property | LOW | Dead code — remove from `Disclosure` interface in `page.tsx` |
| `DataProducts.tsx` "decision-ready insights" | LOW | Minor copy compliance issue |
