# API Route Validation

> All routes live under `frontend/app/api/`.
> Auth: Supabase session cookie for user-facing routes; `X-Cron-Secret` header for cron routes; API key header for `/api/v1/*`.

---

## Quick Health Check

```bash
# Basic health check — must return 200 with db:ok
curl -s https://k-marketinsight.com/api/health | jq .
# Expected: {"status":"ok","db":"ok","timestamp":"..."}

# Unauthenticated protected route — must return 401 or redirect
curl -I https://k-marketinsight.com/api/bookmarks
# Expected: HTTP 401 (not 200)
```

---

## 1. `/api/health`

| Check | Priority | Expected |
|---|---|---|
| Returns 200 on GET | `[CRITICAL]` | `{"status":"ok","db":"ok"}` |
| Runs on edge runtime (not Node) | `[HIGH]` | `x-vercel-execution-region` header in response |
| DB connectivity failure → `{"status":"ok","db":"error"}` not a 500 | `[HIGH]` | Graceful degradation |
| Response time < 500ms | `[HIGH]` | Check in network tab |

```bash
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" https://k-marketinsight.com/api/health
# Expected: 200 0.3s (ish)
```

---

## 2. `/api/disclosures/latest`

| Check | Priority | Expected |
|---|---|---|
| GET without auth → check response (should require auth cookie) | `[CRITICAL]` | 401 or empty array |
| GET with valid session cookie → 200 + array | `[CRITICAL]` | 10 items by default |
| `?page=2` → returns page 2 (items 11–20) | `[HIGH]` | No duplicates with page 1 |
| `?event_type=EARNINGS` → only EARNINGS rows | `[HIGH]` | Filtered correctly |
| `?q=삼성` → filtered by company name/code | `[HIGH]` | Relevant results |
| `?sort=alpha_score&order=desc` → sorted descending | `[HIGH]` | First item has highest score |
| Response shape includes: `id`, `rcept_no`, `corp_name`, `headline`, `alpha_score`, `signal_tag`, `rcept_dt` | `[HIGH]` | All fields present |
| `cache-control: stale-while-revalidate` header present | `[MEDIUM]` | CDN caching active |

```bash
# With session cookie (grab from browser DevTools → Application → Cookies)
curl -s "https://k-marketinsight.com/api/disclosures/latest?page=1" \
  -H "Cookie: sb-ojzxvaojuglgqmvxhlzh-auth-token=<TOKEN>" | jq 'length'
# Expected: 10
```

---

## 3. `/api/search`

| Check | Priority | Expected |
|---|---|---|
| `?q=삼성` → returns company name+code pairs | `[HIGH]` | Array of `{corp_name, stock_code}` |
| `?q=` (empty) → returns [] or 400 | `[HIGH]` | No crash, no full table scan |
| `?q=<script>alert(1)</script>` → sanitized, no XSS | `[HIGH]` | Safe empty result |
| `?q=0059` (partial code) → matching stocks returned | `[MEDIUM]` | Prefix match works |
| Response time < 300ms | `[HIGH]` | Debounce + indexed query |

```bash
curl -s "https://k-marketinsight.com/api/search?q=samsung" | jq .
```

---

## 4. `/api/bookmarks`

| Check | Priority | Expected |
|---|---|---|
| GET (authenticated) → list of bookmarked disclosure IDs | `[HIGH]` | Array of UUIDs |
| GET `?ids_only=true` → returns only IDs (no JOIN) | `[HIGH]` | Smaller payload, faster TTFB |
| POST `{disclosure_id: "..."}` → bookmark created | `[HIGH]` | 201 or 200 |
| DELETE `?disclosure_id=...` → bookmark removed | `[HIGH]` | 200, row gone from DB |
| Unauthenticated GET → 401 | `[CRITICAL]` | No data leak |

---

## 5. `/api/market-radar-widget`

| Check | Priority | Expected |
|---|---|---|
| GET → 200 with market radar data | `[HIGH]` | Includes sector signals, index history |
| TTFB < 1000ms (4 parallel queries) | `[CRITICAL]` | Was 3,267ms before fix; target ~600ms |
| Response includes: `sectorSignals`, `indexHistory`, `hotStocks` | `[HIGH]` | All keys present |
| Stale sector_signals (no data today) → graceful fallback | `[MEDIUM]` | Returns last available date |

```bash
time curl -s "https://k-marketinsight.com/api/market-radar-widget" | jq 'keys'
# Expected: ["hotStocks","indexHistory","sectorSignals"] + < 1s
```

---

## 6. `/api/v1/*` (External API)

Routes: `/api/v1/disclosures`, `/api/v1/events`, `/api/v1/market-radar`, `/api/v1/sector-signals`, `/api/v1/performance/*`, `/api/v1/signal-performance`

| Check | Priority | Expected |
|---|---|---|
| GET without API key → 401 `{"error":"Unauthorized"}` | `[CRITICAL]` | No data returned |
| GET with invalid API key → 401 | `[CRITICAL]` | Same |
| GET with valid API key → 200 + data | `[CRITICAL]` | Full response |
| Rate limiting: > X requests/min → 429 | `[HIGH]` | `Retry-After` header present |
| Response is valid JSON with consistent schema | `[HIGH]` | |
| `/api/v1/disclosures?event_type=EARNINGS` → filtered | `[MEDIUM]` | |

```bash
# Without key — expect 401
curl -s https://k-marketinsight.com/api/v1/disclosures | jq .

# With valid key (from /api-key page)
curl -s https://k-marketinsight.com/api/v1/disclosures \
  -H "X-API-Key: <your-key>" | jq 'length'
```

---

## 7. `/api/paddle/webhook`

| Check | Priority | Expected |
|---|---|---|
| POST with valid `Paddle-Signature` → 200 | `[CRITICAL]` | Processed, plan updated |
| POST without signature header → 401 | `[CRITICAL]` | Rejected |
| POST with tampered body → 401 | `[CRITICAL]` | Signature mismatch caught |
| `subscription.activated` event → `users.plan` = 'pro' in Supabase | `[CRITICAL]` | DB updated |
| `subscription.canceled` event → `users.plan` downgraded | `[HIGH]` | DB updated |

**Simulate webhook (Paddle sandbox):**
```bash
# Use Paddle CLI or sandbox dashboard to send test events
# Verify in Supabase: SELECT plan FROM users WHERE email = 'test@example.com';
```

---

## 8. `/api/cron/*`

Routes: `/api/cron/analyze-disclosures`, `/api/cron/analyze-hot-stocks`, `/api/cron/cleanup-hashes`

| Check | Priority | Expected |
|---|---|---|
| GET without `X-Cron-Secret` header → 401 | `[CRITICAL]` | Blocked |
| GET with wrong secret → 401 | `[CRITICAL]` | Blocked |
| GET with correct `CRON_SECRET` → 200 | `[CRITICAL]` | Triggered successfully |
| `analyze-disclosures` — does not call Groq > 30 times/run | `[CRITICAL]` | `--limit 30` enforced |

```bash
# Test secret validation (replace with actual CRON_SECRET from .env.local)
curl -s "https://k-marketinsight.com/api/cron/analyze-disclosures" \
  -H "X-Cron-Secret: wrong-secret"
# Expected: {"error":"Unauthorized"} 401

curl -s "https://k-marketinsight.com/api/cron/analyze-disclosures" \
  -H "X-Cron-Secret: $CRON_SECRET"
# Expected: {"triggered":true,...} 200
```

---

## 9. `/api/digest/unsubscribe`

| Check | Priority | Expected |
|---|---|---|
| GET `?token=<valid>` → user unsubscribed, 200 | `[HIGH]` | `users.digest_unsubscribed = true` |
| GET `?token=<invalid>` → 400 or 404 | `[HIGH]` | Error message shown |
| Unsubscribe idempotent (call twice → still 200) | `[MEDIUM]` | No error on repeat |

---

## 10. `/api/request-access`

| Check | Priority | Expected |
|---|---|---|
| POST `{email, use_case}` → 200, row in `leads` table | `[HIGH]` | Confirmed via Supabase |
| POST duplicate email → 200 (no uniqueness constraint) | `[MEDIUM]` | Multiple rows allowed |
| POST with 3000-char `use_case` → saved in full | `[MEDIUM]` | TEXT column, no truncation |
| POST triggers Resend emails (admin + auto-reply) | `[HIGH]` | Check Resend dashboard |

```bash
curl -s -X POST https://k-marketinsight.com/api/request-access \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","use_case":"testing QA","plan":"pro"}' | jq .
# Expected: {"success":true}
```

---

## 11. `/api/hot-stocks`

| Check | Priority | Expected |
|---|---|---|
| GET → 200 + array of hot stocks with scores | `[MEDIUM]` | Non-empty on trading days |
| Response includes `stock_code`, `corp_name`, `score` | `[MEDIUM]` | Schema consistent |

---

## 12. `/api/event-score/[event_type]`

| Check | Priority | Expected |
|---|---|---|
| GET `/api/event-score/EARNINGS` → score statistics | `[MEDIUM]` | `{avg, median, count}` shape |
| GET `/api/event-score/INVALID_TYPE` → 400 or empty | `[MEDIUM]` | No 500 |

---

## 13. `/api/financials/[stock_code]`

| Check | Priority | Expected |
|---|---|---|
| GET `/api/financials/005930` → Samsung financial data | `[MEDIUM]` | Revenue, EPS, etc. |
| GET `/api/financials/INVALID` → 404 | `[MEDIUM]` | Not a 500 |

---

## 14. `/api/webhook`

> Note: This is distinct from `/api/paddle/webhook`. Verify what events this handles.

| Check | Priority | Expected |
|---|---|---|
| Unauthorized POST → 401 | `[HIGH]` | Protected |
| Valid webhook event → processed correctly | `[MEDIUM]` | Check handler logic |

---

## Summary: Response Time Targets

| Route | Target TTFB | Priority |
|---|---|---|
| `/api/health` | < 500ms | `[CRITICAL]` |
| `/api/disclosures/latest` (cached) | < 600ms | `[CRITICAL]` |
| `/api/disclosures/latest` (cold) | < 10s | `[HIGH]` |
| `/api/search` | < 300ms | `[HIGH]` |
| `/api/market-radar-widget` | < 1000ms | `[CRITICAL]` |
| `/api/v1/disclosures` | < 500ms | `[HIGH]` |
