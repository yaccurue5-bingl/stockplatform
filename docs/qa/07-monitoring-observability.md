# Monitoring & Observability

> Tools: Sentry (errors), Vercel Analytics (pageviews), Microsoft Clarity (sessions), GitHub Actions (cron health), Supabase (DB health)

---

## 1. Sentry

### Configuration Check

| # | Check | Priority | How to Verify |
|---|---|---|---|
| 1.1 | `NEXT_PUBLIC_SENTRY_DSN` set in Vercel env vars | `[CRITICAL]` | Vercel → Settings → Environment Variables |
| 1.2 | `SENTRY_AUTH_TOKEN` set (for source maps upload) | `[HIGH]` | Same location |
| 1.3 | `sentry.server.config.js` present at repo root | `[HIGH]` | `ls C:/Users/user/stockplatform/sentry.server.config.js` |
| 1.4 | `sentry.edge.config.js` present at repo root | `[HIGH]` | `ls C:/Users/user/stockplatform/sentry.edge.config.js` |
| 1.5 | `instrumentation.js` and `instrumentation-client.js` present | `[HIGH]` | App Router Sentry init |

### Validation

```bash
# Trigger a test Sentry error
curl https://k-marketinsight.com/sentry-example-api
# Then check Sentry dashboard for new error event
```

| # | Check | Priority | Expected |
|---|---|---|---|
| 1.6 | Test error appears in Sentry within 30s | `[CRITICAL]` | Issue visible in Sentry project |
| 1.7 | Error has correct environment tag (`production`) | `[HIGH]` | Not "development" |
| 1.8 | API route errors (500) auto-captured | `[HIGH]` | No manual `Sentry.captureException` needed for unhandled |
| 1.9 | `global-error.tsx` sends error to Sentry | `[HIGH]` | Client error boundaries wired |
| 1.10 | Source maps uploaded (stack traces show TS line numbers, not minified JS) | `[MEDIUM]` | Sentry error → readable stack |

---

## 2. Vercel Analytics

| # | Check | Priority | How to Verify |
|---|---|---|---|
| 2.1 | `<Analytics />` component in `frontend/app/layout.tsx` | `[HIGH]` | `grep Analytics frontend/app/layout.tsx` |
| 2.2 | Pageview events appear in Vercel Analytics dashboard | `[HIGH]` | Visit any page → check Vercel dashboard same day |
| 2.3 | Analytics enabled on production (not just preview) | `[MEDIUM]` | Vercel → Analytics → confirm project |

---

## 3. Microsoft Clarity

| # | Check | Priority | How to Verify |
|---|---|---|---|
| 3.1 | Clarity script with project ID `wqsx12yrv2` in `layout.tsx` | `[HIGH]` | `grep wqsx12yrv2 frontend/app/layout.tsx` |
| 3.2 | Script uses `strategy="afterInteractive"` (not blocking) | `[HIGH]` | Check script attributes |
| 3.3 | Sessions appearing in Clarity dashboard | `[MEDIUM]` | Visit site → check Clarity recordings next hour |
| 3.4 | No PII in Clarity (mask password fields) | `[HIGH]` | Clarity → Settings → Masking |

---

## 4. GitHub Actions Cron Health

Workflow file: `.github/workflows/trigger.yml`

| Job | Schedule | Priority | Failure Indicator |
|---|---|---|---|
| Intraday crawl | Every 15 min, Mon–Fri 07:30–15:45 KST | `[CRITICAL]` | Red X in Actions tab |
| EOD batch | 16:35 KST weekdays | `[CRITICAL]` | Same |
| Monthly batch | 15th of month | `[HIGH]` | Same |

**Check procedure:**
```
1. GitHub → Actions → trigger.yml
2. Last run timestamp should be < 30 min ago (during trading hours)
3. All steps green (not yellow/red)
4. Look for: "Groq rate limit" or "timeout" in logs
```

| # | Check | Priority | Expected |
|---|---|---|---|
| 4.1 | Intraday job ran successfully within last 30 min (trading hours) | `[CRITICAL]` | Green ✓ |
| 4.2 | EOD job ran successfully today after 16:35 KST | `[CRITICAL]` | Green ✓ |
| 4.3 | No job exceeds 10-minute runtime (Railway timeout risk) | `[HIGH]` | Check duration |
| 4.4 | Groq `--limit 30` enforced — no 429 rate limit errors in logs | `[CRITICAL]` | Clean logs |
| 4.5 | `CRON_SECRET` and `GROQ_API_KEY` present in Actions secrets | `[CRITICAL]` | GitHub → Settings → Secrets |

---

## 5. `/api/health` Uptime Monitoring

| # | Check | Priority | Recommendation |
|---|---|---|---|
| 5.1 | External ping every 5 min | `[HIGH]` | UptimeRobot / BetterStack / Checkly |
| 5.2 | Alert if `/api/health` returns non-200 | `[CRITICAL]` | PagerDuty/Slack alert |
| 5.3 | Alert if `db` field is not `"ok"` | `[CRITICAL]` | Supabase connection issue |
| 5.4 | Response time alert if > 2s | `[MEDIUM]` | Potential overload |

**Recommended BetterStack check:**
```
URL: https://k-marketinsight.com/api/health
Method: GET
Expected status: 200
Expected body: "db\":\"ok\""
Interval: 5 minutes
```

---

## 6. DB Health (Supabase)

```bash
# Run Supabase Advisor security check (via MCP or Supabase CLI)
# mcp__supabase__get_advisors(project_id: "ojzxvaojuglgqmvxhlzh", type: "security")
```

| # | Check | Priority | Expected |
|---|---|---|---|
| 6.1 | Supabase Advisor: 0 RLS errors | `[CRITICAL]` | `rls_disabled_in_public` = 0 |
| 6.2 | Supabase Advisor: 0 GRANT issues | `[HIGH]` | All public tables have GRANT |
| 6.3 | DB not paused (free tier auto-pauses after 1 week inactivity) | `[CRITICAL]` | Dashboard shows "Active" |
| 6.4 | Connection pool: pooler connections < 90% capacity | `[HIGH]` | Supabase → Reports → Database |
| 6.5 | `disclosure_insights` table: covering index healthy (Heap Fetches ≈ 0) | `[HIGH]` | Run EXPLAIN ANALYZE after VACUUM ANALYZE if slow |

```sql
-- Quick DB health sanity
SELECT
  (SELECT COUNT(*) FROM disclosure_insights WHERE analysis_status = 'pending') AS pending_count,
  (SELECT COUNT(*) FROM disclosure_insights WHERE analysis_status = 'processing'
    AND updated_at < NOW() - INTERVAL '2 hours') AS stuck_processing,
  (SELECT MAX(created_at) FROM disclosure_insights) AS last_ingestion;
```

---

## 7. Groq Rate Limit Monitoring

| # | Check | Priority | Threshold |
|---|---|---|---|
| 7.1 | Railway logs show no 429 responses from Groq | `[CRITICAL]` | 0 rate limit errors |
| 7.2 | Daily Groq API calls ≤ 1000 (free tier RPD) | `[CRITICAL]` | ~30 batch × N runs/day |
| 7.3 | Per-minute calls ≤ 30 (free tier RPM) | `[CRITICAL]` | `--limit 30` enforced in `auto_analyst.py` |
| 7.4 | If 429 occurs: `analysis_status` returns to `pending` (not stuck in `processing`) | `[HIGH]` | Retry logic in `auto_analyst.py` |

**Check Railway logs:**
```
Railway → stockplatform service → Logs → filter "429" or "rate_limit"
```

---

## 8. DART API Outage Detection

| # | Check | Priority | Indicator |
|---|---|---|---|
| 8.1 | No new rows in `disclosure_insights` for > 4 hours during trading hours | `[HIGH]` | DART down or crawler crash |
| 8.2 | `dart_crawler.py` Railway service not crashing on restart | `[HIGH]` | Railway → Deployments shows stable |
| 8.3 | DART API HTTP 200 from Railway (not 503) | `[HIGH]` | Check Railway logs |

```sql
-- Detect DART ingest stall (should return recent timestamp during trading hours)
SELECT MAX(created_at) AS last_ingestion FROM disclosure_insights;
-- If > 4 hours behind on a weekday → DART crawler issue
```

---

## 9. Alert Priority Tiers & Runbooks

### CRITICAL — Respond within 15 minutes

| Alert | Runbook |
|---|---|
| `/api/health` non-200 | 1. Check Vercel deployment status. 2. Check Supabase "Active" status. 3. Redeploy if needed. |
| Paddle webhook returning 401 | 1. Verify `PADDLE_WEBHOOK_SECRET` env var in Vercel. 2. Check Paddle dashboard for failed webhook deliveries. 3. Re-deliver manually. |
| `proxy.ts` not blocking protected routes | 1. Verify `proxy.ts` exists (not `middleware.ts`). 2. Check recent git changes to `proxy.ts`. 3. Redeploy. |
| Supabase DB paused | 1. Go to Supabase Dashboard → Restore. 2. Verify `disclosure_insights` accessible. 3. Manually trigger cron. |

### HIGH — Respond within 2 hours

| Alert | Runbook |
|---|---|
| Groq 429 rate limit | 1. Check `auto_analyst.py --limit` value. 2. Increase batch interval in `trigger.yml`. 3. Monitor next run. |
| GitHub Actions cron timeout | 1. Check job duration in Actions log. 2. Reduce `--limit` per batch. 3. Split into smaller batches. |
| DART ingestion stall > 4 hours | 1. Check Railway `dart_crawler.py` service status. 2. Check DART OpenAPI status page. 3. Restart Railway service. |
| Sentry error spike (> 50 new errors/hour) | 1. Check Sentry for common error pattern. 2. Roll back last deployment if correlated. |

### MEDIUM — Respond within 24 hours

| Alert | Runbook |
|---|---|
| Clarity showing 0 sessions | 1. Verify script tag in `layout.tsx`. 2. Check CSP headers for `clarity.ms` domain. |
| Search returning empty for known companies | 1. Run SQL: check `analyzed_at` vs `updated_at` column (past bug). 2. Check `api/search` query. |
| MarketRadar TTFB > 3s (regressed) | 1. Check `api/market-radar-widget/route.ts` — verify Promise.all still parallel. 2. Run VACUUM ANALYZE on `sector_signals`. |
