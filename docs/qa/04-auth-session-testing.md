# Auth & Session Testing

> Middleware: `frontend/proxy.ts` (Next.js 16 — not middleware.ts)
> Auth provider: Supabase Auth (email + social login)
> Playwright refs: `e2e/tests/auth.spec.ts`, `e2e/tests/protected-routes.spec.ts`

---

## 1. Login

| # | Test | Priority | Expected |
|---|---|---|---|
| 1.1 | Email + password login → redirect to `/dashboard` | `[CRITICAL]` | Session cookie set |
| 1.2 | Social login (Google/GitHub) → OAuth redirect → session active | `[HIGH]` | User record in `users` table |
| 1.3 | Wrong password → error message shown, no redirect | `[CRITICAL]` | "Invalid credentials" displayed |
| 1.4 | Unconfirmed email → login blocked with appropriate message | `[HIGH]` | "Please confirm your email" |
| 1.5 | Login redirect: if accessed `/disclosures` before login → lands on `/disclosures` post-login | `[HIGH]` | `redirectTo` preserved in session |
| 1.6 | Navbar shows plan badge immediately after login (no FREE flash) | `[HIGH]` | `kmi_userPlan` from localStorage |

**Manual steps:**
```
1. Navigate to /auth/login
2. Enter valid credentials
3. Verify redirect to /dashboard
4. Check localStorage: kmi_userPlan should equal "pro" or "free"
5. Repeat page navigations — badge must not flash "FREE" between loads
```

---

## 2. Logout

| # | Test | Priority | Expected |
|---|---|---|---|
| 2.1 | Click logout → Supabase session invalidated | `[CRITICAL]` | Cookie cleared |
| 2.2 | `kmi_userPlan` removed from `localStorage` on logout | `[CRITICAL]` | `localStorage.getItem('kmi_userPlan')` returns null |
| 2.3 | Post-logout visit to `/disclosures` → redirect to `/` | `[CRITICAL]` | Cannot access protected routes |
| 2.4 | Navbar shows "Login" button after logout | `[HIGH]` | Plan badge gone |

**Verify localStorage cleared (browser console):**
```javascript
// After logout — should return null
localStorage.getItem('kmi_userPlan')
```

---

## 3. Expired Session

| # | Test | Priority | Expected |
|---|---|---|---|
| 3.1 | Manually delete Supabase session cookie → visit `/disclosures` → redirect, no crash | `[CRITICAL]` | `proxy.ts` handles gracefully |
| 3.2 | Expired access token (> 1 hour) → Supabase auto-refreshes via refresh token | `[HIGH]` | Seamless, no re-login required |
| 3.3 | Both access + refresh token expired → redirect to login | `[HIGH]` | Login page, not 500 |
| 3.4 | Back-button after session expiry → redirect to login, not cached protected content | `[HIGH]` | Implemented in `proxy.ts` |

**Simulate expired session:**
```javascript
// Browser console — delete Supabase cookie and reload
document.cookie.split(';').filter(c => c.includes('sb-')).forEach(c => {
  document.cookie = c.split('=')[0] + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
})
location.reload()
```

---

## 4. Protected Route Gating (`proxy.ts`)

Routes that must block unauthenticated AND free-plan users:

| Route | Auth Required | Pro Plan Required | Priority |
|---|---|---|---|
| `/disclosures` | Yes | Yes | `[CRITICAL]` |
| `/dashboard` | Yes | Yes | `[CRITICAL]` |
| `/bookmarks` | Yes | Yes | `[HIGH]` |
| `/api-key` | Yes | Yes | `[HIGH]` |
| `/usage` | Yes | Yes | `[HIGH]` |

Routes that must remain public (present in `proxy.ts` public paths):

| Route | Priority |
|---|---|
| `/` | `[CRITICAL]` |
| `/pricing` | `[CRITICAL]` |
| `/api-access` | `[HIGH]` |
| `/api-docs` | `[HIGH]` |
| `/datasets` | `[HIGH]` |
| `/terms`, `/privacy`, `/refund-policy` | `[HIGH]` |
| `/korea-*` SEO landing pages | `[HIGH]` |
| `/signal/[id]` | `[HIGH]` |

**Test matrix (run with curl or Playwright):**
```bash
# Unauthenticated request to protected route — expect 302 to /
curl -I https://k-marketinsight.com/disclosures
# Expected: Location: /

# Public route — expect 200
curl -I https://k-marketinsight.com/pricing
# Expected: HTTP/2 200
```

---

## 5. Navbar Plan Badge

| # | Test | Priority | Expected |
|---|---|---|---|
| 5.1 | Pro user logs in → badge shows "PRO", never flashes "FREE" | `[HIGH]` | localStorage caching prevents flash |
| 5.2 | Navigate between pages → badge stable (no re-fetch on each nav) | `[HIGH]` | localStorage hit, no API call |
| 5.3 | localStorage `kmi_userPlan = null` (logged out) → "Login" button shown | `[HIGH]` | No badge at all |
| 5.4 | Pro user: plan downgraded server-side → next fresh session shows correct downgraded plan | `[MEDIUM]` | Cache invalidated on login |

---

## 6. Multiple Tabs Sync

| # | Test | Priority | Expected |
|---|---|---|---|
| 6.1 | Logout in Tab A → Tab B still appears to be logged in until next navigation | `[MEDIUM]` | Expected — session is cookie-based |
| 6.2 | Hard refresh in Tab B after logout in Tab A → Tab B shows Login state | `[HIGH]` | Cookie cleared, proxy.ts redirects |
| 6.3 | Login in Tab A → Tab B automatically does NOT gain session without refresh | `[MEDIUM]` | Expected behavior |

---

## 7. Session Desync Scenarios

| Scenario | Priority | Expected Behavior |
|---|---|---|
| User pays for Pro → plan updated in DB → session cookie still shows Free | `[HIGH]` | Re-login to refresh plan; or force-refresh `kmi_userPlan` |
| User's Pro subscription expires → still has session | `[HIGH]` | `proxy.ts` checks plan on each request, redirects |
| Admin updates `users.plan` manually in Supabase → user sees change after next page load | `[MEDIUM]` | Session re-read from DB on each protected route |
| `users` table `plan` column = NULL → treated as Free plan | `[HIGH]` | Not treated as Pro; redirect on protected routes |

---

## 8. Mobile Browser Auth

| # | Test | Priority | Expected |
|---|---|---|---|
| 8.1 | iOS Safari: login form submits correctly | `[HIGH]` | No keyboard/scroll issues |
| 8.2 | iOS Safari: session persists across app-switch | `[HIGH]` | Cookie retained |
| 8.3 | Android Chrome: social OAuth redirect completes | `[HIGH]` | Returns to app after OAuth |
| 8.4 | Mobile: logout clears localStorage | `[HIGH]` | `kmi_userPlan` null |

---

## 9. Playwright Coverage

### Existing tests (`auth.spec.ts`)

| Test case | Project | Status |
|---|---|---|
| Email login → redirect | `public` | Covered |
| Logout → Login button visible | `public` | Covered |
| Invalid credentials → error shown | `public` | Covered |
| Expired session redirect | `public` | Covered |
| Social login button visible | `public` | Covered |
| Multi-tab logout behavior | `public` | Covered |

### Existing tests (`protected-routes.spec.ts`)

| Test case | Project | Status |
|---|---|---|
| `/disclosures` blocked for anon | `public` | Covered |
| `/dashboard` blocked for anon | `public` | Covered |
| Pro user can access `/disclosures` | `authenticated` | Covered |

### Gaps to address (see `08-playwright-e2e-plan.md`)

- Navbar plan badge no-flash after login
- Plan downgrade → protected route redirect
- iOS Safari back-swipe session preservation
