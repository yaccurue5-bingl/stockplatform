# /disclosures Page QA Procedures

> Route: `frontend/app/(protected)/disclosures/`
> Auth guard: `proxy.ts` — unauthenticated or free-plan → redirect to `/`

---

## 1. List Load

| # | Test | Priority | Expected |
|---|---|---|---|
| 1.1 | Visit `/disclosures` as Pro user | `[CRITICAL]` | 10 disclosure cards render |
| 1.2 | Cards contain: company name, headline, signal_tag badge, alpha_score | `[HIGH]` | All fields visible |
| 1.3 | `corp_name_en` shows English name (not Korean fallback) for major stocks | `[MEDIUM]` | "Samsung Electronics", not "삼성전자" |
| 1.4 | Loading skeleton shows during API fetch | `[MEDIUM]` | Skeleton cards visible, not blank |
| 1.5 | TTFB on cold start (no CDN cache) < 10s | `[HIGH]` | Check network tab |
| 1.6 | TTFB on warm CDN cache < 600ms | `[HIGH]` | `cache-control: stale-while-revalidate` header present |

**CDN cache header check:**
```bash
curl -I "https://k-marketinsight.com/api/disclosures/latest" | grep -i cache-control
```

---

## 2. Search (Company Name / Code)

| # | Test | Priority | Expected |
|---|---|---|---|
| 2.1 | Type "삼성" in search box → dropdown appears with matching companies | `[CRITICAL]` | Results appear within 300ms |
| 2.2 | Type a stock code (e.g., "005930") → correct company in dropdown | `[HIGH]` | Samsung Electronics shown |
| 2.3 | Click dropdown result → list filters to that company | `[CRITICAL]` | Only matching rows displayed |
| 2.4 | Clear search input → full list restores | `[HIGH]` | All 10 items return |
| 2.5 | Type special chars (`<script>`, `%`) → no crash, empty state shown | `[HIGH]` | Graceful empty state |
| 2.6 | Type single character → no excessive API calls (debounce active) | `[MEDIUM]` | Network tab: 1 request, not 1/keystroke |

**API call verification (browser DevTools):**
Filter Network tab by `/api/search` — verify debounce (~300ms) prevents per-keystroke calls.

---

## 3. Filters

| # | Test | Priority | Expected |
|---|---|---|---|
| 3.1 | Filter by `event_type = EARNINGS` → only earnings disclosures shown | `[HIGH]` | Signal tag "EARNINGS" on all cards |
| 3.2 | Filter by date range (last 7 days) → older items excluded | `[HIGH]` | `rcept_dt` within range |
| 3.3 | Combine search + event_type filter → both constraints applied | `[HIGH]` | Intersection of both filters |
| 3.4 | Reset filters → full unfiltered list restores | `[MEDIUM]` | 10 items back |

---

## 4. Sort

| # | Test | Priority | Expected |
|---|---|---|---|
| 4.1 | Sort by `alpha_score DESC` → highest scored item first | `[HIGH]` | Numeric order confirmed |
| 4.2 | Sort by date (newest first) → most recent `rcept_dt` at top | `[HIGH]` | Date order correct |
| 4.3 | Sort persists when navigating to detail and back | `[MEDIUM]` | Same sort order on return |

---

## 5. Pagination

| # | Test | Priority | Expected |
|---|---|---|---|
| 5.1 | Click "Next page" → different 10 items appear (no duplicates) | `[CRITICAL]` | Page 2 shows items 11–20 |
| 5.2 | Click "Previous page" from page 2 → original 10 items restore | `[HIGH]` | Same as page 1 initial load |
| 5.3 | Last page shows remaining items (may be < 10) | `[MEDIUM]` | No empty page shown |
| 5.4 | Page number indicator updates correctly | `[LOW]` | "Page 2 of N" updates |

---

## 6. Card Rendering

| # | Test | Priority | Expected |
|---|---|---|---|
| 6.1 | `headline` present on every card | `[HIGH]` | No blank headline |
| 6.2 | `signal_tag` badge renders with color coding | `[MEDIUM]` | Color matches tag type |
| 6.3 | `key_numbers` chip list shows ≤ 3 items on card | `[MEDIUM]` | Truncated, not overflowing |
| 6.4 | `alpha_score` shows numeric value (not `null` or `0` for completed items) | `[HIGH]` | Score > 0 |
| 6.5 | Score = 0 edge case: card does not look broken | `[MEDIUM]` | "0" shown explicitly, not blank |
| 6.6 | `corp_name_en` fallback: if missing, Korean name shown (not empty) | `[HIGH]` | No blank company name |

---

## 7. Detail View

| # | Test | Priority | Expected |
|---|---|---|---|
| 7.1 | Click card row → detail view opens | `[CRITICAL]` | Smooth transition |
| 7.2 | AI summary block renders with full text | `[HIGH]` | Not truncated |
| 7.3 | Key Numbers section shows structured data | `[HIGH]` | Labels + values present |
| 7.4 | Signal Strength bar renders correctly | `[MEDIUM]` | Bar proportional to `alpha_score` |
| 7.5 | DART link (external) opens in new tab | `[MEDIUM]` | `target="_blank"` confirmed |
| 7.6 | Disclosure with `low_quality` status shows appropriate message | `[MEDIUM]` | Not broken/blank |

---

## 8. Back-Button (List + Scroll Position Restore)

| # | Test | Priority | Expected |
|---|---|---|---|
| 8.1 | Click card → view detail → click Back → list restores at same scroll position | `[HIGH]` | No scroll-to-top |
| 8.2 | Same list items present after returning (no re-fetch flash) | `[HIGH]` | Data preserved in state |
| 8.3 | Same search/filter state preserved after back | `[MEDIUM]` | Filter not reset |
| 8.4 | iOS Safari back-swipe (native) returns to list correctly | `[HIGH]` | See `mobile.spec.ts [8]` |

---

## 9. Bookmark Toggle

| # | Test | Priority | Expected |
|---|---|---|---|
| 9.1 | Click BookmarkButton on card → icon fills (bookmarked state) | `[HIGH]` | No page navigation (stopPropagation) |
| 9.2 | Bookmark persists after page reload | `[HIGH]` | Still bookmarked on refresh |
| 9.3 | Un-bookmark → icon returns to outline | `[HIGH]` | State toggles |
| 9.4 | Bookmark button click does NOT open detail view | `[CRITICAL]` | `stopPropagation` works |
| 9.5 | `/bookmarks` page lists saved disclosures | `[HIGH]` | Bookmarked items appear |

---

## 10. Access Control (Free User Redirect)

| # | Test | Priority | Expected |
|---|---|---|---|
| 10.1 | Log out → visit `/disclosures` → redirect to `/` | `[CRITICAL]` | No content flash before redirect |
| 10.2 | Free-plan account → visit `/disclosures` → redirect to `/` | `[CRITICAL]` | Checked in `proxy.ts` |
| 10.3 | `/api/disclosures/latest` called without auth cookie → 401 or empty | `[HIGH]` | No data leak |

---

## 11. CDN / Caching Behavior

| # | Test | Priority | Expected |
|---|---|---|---|
| 11.1 | Second request to `/api/disclosures/latest` returns `X-Cache: HIT` or `age > 0` | `[HIGH]` | CDN cache working |
| 11.2 | After new DART ingestion, cache invalidated within 15 min | `[MEDIUM]` | Matches intraday cron cadence |
| 11.3 | `stale-while-revalidate` header allows instant response on repeat visits | `[MEDIUM]` | Confirmed in response headers |

---

## 12. Mobile Layout

| # | Test | Priority | Expected |
|---|---|---|---|
| 12.1 | Cards stack vertically on 375px viewport | `[HIGH]` | No side-by-side overflow |
| 12.2 | Search input fully visible, no clipping | `[HIGH]` | Full width input |
| 12.3 | Bookmark button tap target ≥ 44px | `[MEDIUM]` | Easily tappable |
| 12.4 | Pagination controls visible and tappable | `[MEDIUM]` | No overflow |

---

## 13. Empty States

| # | Test | Priority | Expected |
|---|---|---|---|
| 13.1 | Search with no matches → "No disclosures found" message | `[HIGH]` | Not a blank page |
| 13.2 | Filter returns 0 results → empty state shown | `[HIGH]` | Friendly message |
| 13.3 | API error (500) → error boundary catches, error message shown | `[HIGH]` | Not a white screen |
| 13.4 | Loading skeleton shows while `isLoading = true` | `[MEDIUM]` | Skeleton, not blank |
