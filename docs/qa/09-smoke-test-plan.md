# Launch-Day Smoke Test Plan

> Executable in 30 minutes by 1 person.
> Run against production: `https://k-marketinsight.com`
> Test mode Paddle must be OFF for production smoke test (use sandbox only for payment step).

| Column | Meaning |
|---|---|
| Time | Minutes from start (T+0) |
| Manual Step | Exact action to take |
| Expected | What passing looks like |
| PASS/FAIL | Fill in during test |
| Notes | Observations |

---

## T+0: Site Availability

| # | Manual Step | Expected | PASS/FAIL | Notes |
|---|---|---|---|---|
| 0.1 | Open `https://k-marketinsight.com` in fresh incognito window | Page loads, no 500 error, no blank screen | | |
| 0.2 | Check browser console for JS errors | 0 uncaught errors | | |
| 0.3 | Verify `<title>` tag is correct (not "Create Next App") | Custom title visible | | |
| 0.4 | Verify page is served via HTTPS (padlock icon) | HTTPS confirmed | | |

```bash
# CLI alternative
curl -s -o /dev/null -w "%{http_code}" https://k-marketinsight.com
# Expected: 200
```

---

## T+2: /api/health — DB Connectivity

| # | Manual Step | Expected | PASS/FAIL | Notes |
|---|---|---|---|---|
| 2.1 | `curl -s https://k-marketinsight.com/api/health \| jq .` | `{"status":"ok","db":"ok","timestamp":"..."}` | | |
| 2.2 | Response time < 500ms | `time_total` in curl output | | |
| 2.3 | `db` field is `"ok"` (not `"error"`) | Supabase connected | | |

```bash
curl -s -w "\nHTTP %{http_code} in %{time_total}s\n" https://k-marketinsight.com/api/health | jq .
```

---

## T+5: Auth Flow

| # | Manual Step | Expected | PASS/FAIL | Notes |
|---|---|---|---|---|
| 5.1 | Click Login → navigate to `/auth/login` or login modal | Login UI appears | | |
| 5.2 | Enter wrong credentials → submit | "Invalid credentials" error shown, no redirect | | |
| 5.3 | Enter valid Pro account credentials → submit | Redirect to `/dashboard` | | |
| 5.4 | Check Navbar: plan badge shows "PRO" (not "FREE") | Correct plan displayed | | |
| 5.5 | Click Logout | Redirect to homepage, "Login" button shown |  | |
| 5.6 | Confirm `localStorage.kmi_userPlan` is null after logout | Open DevTools → Application → Local Storage | | |

---

## T+10: /disclosures — Core Functionality

| # | Manual Step | Expected | PASS/FAIL | Notes |
|---|---|---|---|---|
| 10.1 | Log in as Pro user → navigate to `/disclosures` | 10 disclosure cards load | | |
| 10.2 | Loading skeleton visible during initial fetch | Skeleton cards, not blank | | |
| 10.3 | Type "삼성" in search box | Dropdown appears within 1s | | |
| 10.4 | Click a search result | List filters to that company | | |
| 10.5 | Click "Next page" button | Different 10 cards appear | | |
| 10.6 | Click a disclosure card | Detail view opens | | |
| 10.7 | Click Back from detail view | List restored at same position | | |
| 10.8 | Click bookmark icon on a card | Icon toggles, no page navigation | | |
| 10.9 | Visit `/disclosures` in incognito (logged out) | Redirect to `/` | | |

---

## T+15: /signal/[id] SEO Page

| # | Manual Step | Expected | PASS/FAIL | Notes |
|---|---|---|---|---|
| 15.1 | From disclosures list, open a signal detail in incognito | Page loads without auth | | |
| 15.2 | View page source → find `<script type="application/ld+json">` | JSON-LD present | | |
| 15.3 | Verify `og:image` meta tag in `<head>` | `content` attribute non-empty | | |
| 15.4 | Check `<title>` length ≤ 60 characters | Count chars in title | | |
| 15.5 | Visit `/signal/nonexistent-uuid` | Custom 404 page (not-found.tsx) | | |

```bash
# JSON-LD check
curl -s https://k-marketinsight.com/signal/KNOWN_ID | grep -o 'application/ld+json' | wc -l
# Expected: 1
```

---

## T+18: Paddle Checkout (Test Mode)

> Use Paddle sandbox environment. Verify flow without completing a real charge.

| # | Manual Step | Expected | PASS/FAIL | Notes |
|---|---|---|---|---|
| 18.1 | Navigate to `/pricing` (incognito, logged out) | Page loads, 2 plan cards visible | | |
| 18.2 | Click Pro plan CTA button | Paddle checkout overlay or redirect opens | | |
| 18.3 | Verify URL contains `paddle.com` or Paddle overlay | Not same page, not error | | |
| 18.4 | Close checkout without paying | Returns to site cleanly | | |
| 18.5 | Log in as Pro user → visit `/api/subscription/portal` via Navbar | Portal URL opens in Paddle | | |

---

## T+20: Cron Status

| # | Manual Step | Expected | PASS/FAIL | Notes |
|---|---|---|---|---|
| 20.1 | Open GitHub Actions: `https://github.com/<org>/stockplatform/actions/workflows/trigger.yml` | Last run < 30 min ago (trading hours) | | |
| 20.2 | Last workflow run shows all steps green | No red X | | |
| 20.3 | Check runtime < 10 minutes | Duration visible in Actions | | |
| 20.4 | In Supabase: `SELECT MAX(created_at) FROM disclosure_insights` | Within last 30 min (trading hours) | | |

```sql
-- Quick Supabase check
SELECT MAX(created_at) AS last_ingestion,
       COUNT(*) FILTER (WHERE analysis_status = 'pending') AS pending,
       COUNT(*) FILTER (WHERE analysis_status = 'failed') AS failed
FROM disclosure_insights
WHERE created_at > NOW() - INTERVAL '4 hours';
```

---

## T+22: Email Delivery

| # | Manual Step | Expected | PASS/FAIL | Notes |
|---|---|---|---|---|
| 22.1 | Submit Request Access form on `/api-access` with test email | Form shows success state (checkmark icon) | | |
| 22.2 | Check admin inbox (set in `RESEND_ADMIN_EMAIL`) | Admin notification email received | | |
| 22.3 | Check test email inbox | Auto-reply email received within 2 min | | |
| 22.4 | Verify email not in spam | Deliverability OK | | |

```bash
# API call alternative (if browser form unavailable)
curl -s -X POST https://k-marketinsight.com/api/request-access \
  -H "Content-Type: application/json" \
  -d '{"email":"yourtest@example.com","use_case":"smoke test","plan":"pro"}' | jq .
# Expected: {"success":true}
```

---

## T+25: Mobile (iPhone Viewport)

| # | Manual Step | Expected | PASS/FAIL | Notes |
|---|---|---|---|---|
| 25.1 | Open site on real iPhone or DevTools iPhone 14 viewport (390px) | No horizontal scroll | | |
| 25.2 | Navigate to `/disclosures` (Pro user) | Cards stack vertically, readable | | |
| 25.3 | Tap search box → type "삼성" | Keyboard doesn't obscure dropdown | | |
| 25.4 | Tap a disclosure card → detail view | Touch target large enough | | |
| 25.5 | iOS native back-swipe gesture | Returns to list | | |
| 25.6 | Navigate to `/auth/login` → complete login on mobile | Form submits without zoom issue | | |

---

## T+27: Analytics (Vercel + Clarity)

| # | Manual Step | Expected | PASS/FAIL | Notes |
|---|---|---|---|---|
| 27.1 | Open Vercel → Analytics → today | Pageview count > 0 | | |
| 27.2 | Open Microsoft Clarity → Dashboard → today | Sessions recording > 0 | | |
| 27.3 | Check Vercel Analytics for `/disclosures` traffic | Appears in top pages list | | |
| 27.4 | Sentry: no new critical errors in last 30 min | 0 P0 issues | | |

---

## T+30: SEO Basics

| # | Manual Step | Expected | PASS/FAIL | Notes |
|---|---|---|---|---|
| 30.1 | `curl https://k-marketinsight.com/sitemap.xml \| head -5` | Valid XML, URLs present | | |
| 30.2 | `curl https://k-marketinsight.com/robots.txt` | Disallow `/api/`, allow `/` | | |
| 30.3 | Visit `/korea-earnings-signals` | Page loads, real data in table | | |
| 30.4 | Visit `/korea-dilution-filings` | Page loads, real data in table | | |
| 30.5 | Visit `/korea-contract-signals` | Page loads, real data in table | | |
| 30.6 | Check SEO landing page `<title>` unique per page | Different titles on each | | |

```bash
curl -s https://k-marketinsight.com/robots.txt
# Expected:
# User-agent: *
# Disallow: /api/
# Disallow: /auth/
# Allow: /

curl -s https://k-marketinsight.com/sitemap.xml | grep -c '<url>'
# Expected: > 10
```

---

## Smoke Test Summary Sheet

| Phase | Item Count | PASS | FAIL |
|---|---|---|---|
| T+0: Availability | 4 | | |
| T+2: Health | 3 | | |
| T+5: Auth | 6 | | |
| T+10: Disclosures | 9 | | |
| T+15: SEO Pages | 5 | | |
| T+18: Payments | 5 | | |
| T+20: Cron | 4 | | |
| T+22: Email | 4 | | |
| T+25: Mobile | 6 | | |
| T+27: Analytics | 4 | | |
| T+30: SEO Basics | 6 | | |
| **Total** | **56** | | |

**Go/No-Go threshold:** All `[CRITICAL]` items PASS. Any `[HIGH]` FAIL → document and assign before launch.

---

## Critical Blockers (Must be PASS before launch)

- T+2.3: `db:"ok"` in health response
- T+5.3: Login redirects to `/dashboard`
- T+10.1: `/disclosures` loads for Pro user
- T+10.9: `/disclosures` redirects anon to `/`
- T+18.2: Paddle checkout opens (not errors)
- T+20.2: GitHub Actions last run green
