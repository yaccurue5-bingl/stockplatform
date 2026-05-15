# UI/UX Review Checklist

> Focus on real user experience issues discovered during development.
> "Looks broken", "feels slow", and "confusing for new users" scenarios included.

---

## 1. Loading States

| # | Component | Priority | Expected |
|---|---|---|---|
| 1.1 | `/disclosures` initial load | `[CRITICAL]` | Skeleton cards visible, not blank white page |
| 1.2 | Auth-gated pages while session loads | `[HIGH]` | Spinner or skeleton — not flash of "access denied" |
| 1.3 | Search dropdown during fetch | `[HIGH]` | Loading indicator in dropdown, not empty flash |
| 1.4 | Dashboard MarketRadar widget | `[HIGH]` | Skeleton while fetching; not blank section |
| 1.5 | Detail view open (disclosure click) | `[MEDIUM]` | Transition feels fast (< 300ms) |
| 1.6 | Bookmark toggle button | `[MEDIUM]` | Immediate visual feedback (optimistic update) |

**Known issue:** Cold-start `/disclosures` can take ~9s (Supabase free tier + cache miss). Skeleton must show during this time or user thinks the page is broken.

---

## 2. Navbar Plan Badge

| # | Scenario | Priority | Expected |
|---|---|---|---|
| 2.1 | Pro user navigates between pages | `[HIGH]` | "PRO" badge stable — no "FREE" flash |
| 2.2 | Page load (first visit after login) | `[HIGH]` | Badge reads from `localStorage.kmi_userPlan` immediately |
| 2.3 | Logged-out user | `[HIGH]` | No badge — "Login" button shown |
| 2.4 | Badge after logout | `[HIGH]` | Clears on logout — no stale "PRO" shown |

**Fix implemented:** `localStorage` caching prevents badge flash. If flashing recurs, check `client-layout.tsx` and `kmi_userPlan` read timing.

---

## 3. Empty States

| # | Page / Component | Priority | Expected Message |
|---|---|---|---|
| 3.1 | `/disclosures` — search returns 0 results | `[HIGH]` | "No disclosures found for [query]" |
| 3.2 | `/bookmarks` — no saved items | `[HIGH]` | "You haven't bookmarked anything yet" |
| 3.3 | Dashboard Hot Stocks widget — no data | `[MEDIUM]` | "No hot stocks data available" |
| 3.4 | MarketRadar — sector data unavailable | `[MEDIUM]` | Placeholder, not empty whitespace |
| 3.5 | `/signal/[id]` — invalid ID | `[HIGH]` | `not-found.tsx` renders |
| 3.6 | Filter yields 0 results | `[HIGH]` | Empty state, not infinite spinner |

---

## 4. Error Messages

| # | Scenario | Priority | Expected |
|---|---|---|---|
| 4.1 | Login with wrong password | `[CRITICAL]` | "Invalid email or password" — not a generic 500 |
| 4.2 | Request Access form — duplicate email | `[MEDIUM]` | "Thank you, we'll be in touch" (no error; duplicates allowed) |
| 4.3 | Contact form — Resend API down | `[HIGH]` | "Message failed to send. Try again." |
| 4.4 | API error on `/disclosures` load | `[HIGH]` | Error boundary shows message, not white screen |
| 4.5 | Paddle checkout failure | `[HIGH]` | Clear failure message, not silent failure |
| 4.6 | `/api/v1/*` — invalid API key | `[HIGH]` | `{"error":"Unauthorized"}` with documentation link |

---

## 5. Mobile Usability

| # | Test | Priority | Expected |
|---|---|---|---|
| 5.1 | All tap targets ≥ 44×44px | `[HIGH]` | BookmarkButton, pagination, nav items |
| 5.2 | `/disclosures` list scrolls smoothly on iPhone 14 | `[HIGH]` | No jank or layout shift |
| 5.3 | Search input on mobile: keyboard doesn't obscure dropdown | `[HIGH]` | Dropdown scrolls above keyboard |
| 5.4 | iOS Safari back-swipe (native gesture) navigates correctly | `[HIGH]` | Returns to `/disclosures` list |
| 5.5 | No horizontal scroll on any page (body overflow) | `[HIGH]` | Check on 375px viewport |
| 5.6 | Modals (Request Access) close on backdrop tap | `[MEDIUM]` | Mobile users rely on backdrop tap |
| 5.7 | Auth forms readable without zooming (input font-size ≥ 16px) | `[MEDIUM]` | iOS Safari auto-zooms if < 16px |

---

## 6. Pricing Page Clarity

| # | Check | Priority | Expected |
|---|---|---|---|
| 6.1 | Pro plan vs API plan: differentiation is obvious | `[HIGH]` | Different feature lists, not just price |
| 6.2 | Price displayed prominently | `[HIGH]` | Not buried in body text |
| 6.3 | CTA button label clear: "Get Pro", "Request API Access" | `[HIGH]` | Not generic "Subscribe" |
| 6.4 | `/pricing` is public (no login required to see prices) | `[CRITICAL]` | `proxy.ts` public path confirmed |
| 6.5 | Plan features match what's actually delivered | `[HIGH]` | No features listed that don't exist |

---

## 7. CTA Visibility & Modals

| # | Check | Priority | Expected |
|---|---|---|---|
| 7.1 | `/api-access` — "Request Access" button visible above fold | `[HIGH]` | No scrolling required to find CTA |
| 7.2 | Request Access modal opens on button click | `[CRITICAL]` | Modal, not `mailto:` link |
| 7.3 | Modal: `email` + `use_case` fields, Submit button | `[HIGH]` | Form complete |
| 7.4 | Modal success state: checkmark + "1-2 business days" message | `[HIGH]` | After successful POST |
| 7.5 | Modal close: X button + backdrop click both work | `[HIGH]` | Confirmed in QA history |
| 7.6 | Modal does not break mobile layout | `[MEDIUM]` | Full-screen on small viewports |

**Do NOT change:** Modal → `mailto:` link is a prohibited UI pattern change per `CLAUDE.md`.

---

## 8. Dashboard Clarity

| # | Check | Priority | Expected |
|---|---|---|---|
| 8.1 | MarketRadar widget loads within 1s (warm cache) | `[CRITICAL]` | TTFB < 1s after optimization |
| 8.2 | Hot Stocks shows company names in English | `[MEDIUM]` | `corp_name_en` displayed |
| 8.3 | Sector signals show color-coded trend indicators | `[MEDIUM]` | Up/down arrows or color |
| 8.4 | Dashboard accessible only to Pro users | `[CRITICAL]` | Redirect to `/` for free/anon |

---

## 9. Signal Detail Page (`/signal/[id]`)

| # | Check | Priority | Expected |
|---|---|---|---|
| 9.1 | Title < 60 chars (truncated if needed) | `[HIGH]` | SEO requirement |
| 9.2 | AI summary readable, not truncated | `[HIGH]` | Full text visible |
| 9.3 | Key Numbers rendered as structured list | `[MEDIUM]` | Not raw JSON |
| 9.4 | Signal Strength bar proportional to score | `[MEDIUM]` | 80/100 = 80% width |
| 9.5 | DART source link present | `[HIGH]` | External link opens in new tab |
| 9.6 | JSON-LD visible in page source | `[HIGH]` | `<script type="application/ld+json">` |

---

## 10. "Looks Broken" Scenarios

| Scenario | Priority | Check |
|---|---|---|
| `alpha_score = 0` on card | `[HIGH]` | Shows "0", not blank or undefined |
| `corp_name_en = NULL` | `[HIGH]` | Falls back to `corp_name` (Korean), not empty |
| `headline = ""` or very short | `[HIGH]` | Placeholder or fallback text shown |
| `key_numbers = []` (empty) | `[MEDIUM]` | Section hidden or shows "No key numbers" |
| Score bar with `null` score | `[MEDIUM]` | Bar hidden, not rendered at 0% unexpectedly |

---

## 11. "Feels Slow" Scenarios

| Scenario | Priority | Root Cause | Mitigation |
|---|---|---|---|
| Cold-start `/disclosures` > 9s | `[HIGH]` | Supabase free tier cold start + no CDN cache | Skeleton loader + cache warm-up |
| MarketRadar > 3s | `[HIGH]` | Sequential DB queries | Fixed: 4-query Promise.all |
| Search dropdown delayed > 1s | `[MEDIUM]` | No index on `corp_name` | Check query plan |
| `/signal/[id]` SSG cold miss | `[LOW]` | Not statically generated | Add ISR if traffic justifies |

---

## 12. "Confusing for First-Time Users"

| Scenario | Priority | Fix |
|---|---|---|
| Land on `/disclosures`, redirected to `/` with no explanation | `[HIGH]` | Add toast: "Upgrade to Pro to access disclosures" |
| `/pricing` → click Pro → no clear checkout flow shown | `[HIGH]` | Paddle checkout redirect should be instant |
| No explanation of what a "signal" is on landing page | `[MEDIUM]` | Add 1-line explainer on `/` |
| `alpha_score` shown without context (scale of 0-100?) | `[MEDIUM]` | Tooltip explaining score range |
| Plan gating message on `/dashboard` too abrupt | `[MEDIUM]` | Soften with upgrade CTA, not plain redirect |
