# Playwright E2E Coverage Plan

> Config: `frontend/playwright.config.ts` (dotenv auto-loads `../.env.local`)
> Auth setup: `frontend/e2e/global.setup.ts` → `frontend/e2e/.auth/user.json`
> Run: `cd frontend && npx playwright test`

---

## Existing Test Files

| File | Project | Coverage |
|---|---|---|
| `e2e/tests/auth.spec.ts` | `public` | Login, logout, social login, expired session, invalid creds, multi-tab (9 tests) |
| `e2e/tests/disclosures-search.spec.ts` | `authenticated` | Search company, filter, pagination |
| `e2e/tests/mobile.spec.ts` | `mobile-ios`, `mobile-android` | Viewport, touch, iOS back-swipe |
| `e2e/tests/navigation.spec.ts` | `public` | Page routing, nav links |
| `e2e/tests/payment.spec.ts` | `authenticated` | Paddle checkout redirect |
| `e2e/tests/protected-routes.spec.ts` | `public` | Auth gating for /disclosures, /dashboard, /bookmarks |
| `e2e/tests/api.spec.ts` | `public` | API endpoint smoke tests |

---

## Gap Analysis — Missing Coverage

### Gap 1: `/signal/[id]` SEO Page Direct Access

**File:** `e2e/tests/seo-pages.spec.ts` (new)
**Project:** `public`
**Priority:** `[HIGH]`

```typescript
test('signal detail page loads for valid ID', async ({ page }) => {
  // Fetch a real ID from DB or use a known fixture ID
  const signalId = 'KNOWN_UUID_HERE'
  await page.goto(`/signal/${signalId}`)
  await expect(page).not.toHaveURL(/404/)
  // JSON-LD present
  const jsonLd = await page.locator('script[type="application/ld+json"]').textContent()
  expect(JSON.parse(jsonLd!)).toHaveProperty('headline')
  // og:image in head
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /.+/)
})

test('signal detail 404 for unknown ID', async ({ page }) => {
  await page.goto('/signal/nonexistent-id-00000000')
  // not-found.tsx should render
  await expect(page.locator('h1')).toContainText(/not found/i)
})
```

**Assert:** Status 200, JSON-LD present, `og:image` set, title < 60 chars.

---

### Gap 2: Bookmark Add/Remove Flow

**File:** `e2e/tests/bookmarks.spec.ts` (new)
**Project:** `authenticated`
**Priority:** `[HIGH]`

```typescript
test('bookmark a disclosure and verify it appears on /bookmarks', async ({ page }) => {
  await page.goto('/disclosures')
  // Click bookmark button on first card (not the card itself)
  const bookmarkBtn = page.locator('[data-testid="bookmark-btn"]').first()
  await bookmarkBtn.click()
  // Verify icon changed to filled
  await expect(bookmarkBtn).toHaveAttribute('data-bookmarked', 'true')
  // Navigate to /bookmarks
  await page.goto('/bookmarks')
  await expect(page.locator('[data-testid="bookmark-item"]')).toHaveCount({ min: 1 })
})

test('unbookmark removes from /bookmarks list', async ({ page }) => {
  await page.goto('/bookmarks')
  const count = await page.locator('[data-testid="bookmark-item"]').count()
  await page.locator('[data-testid="bookmark-btn"]').first().click()
  await expect(page.locator('[data-testid="bookmark-item"]')).toHaveCount(count - 1)
})
```

**Assert:** Bookmark state persists, stopPropagation prevents detail view opening.

---

### Gap 3: Navbar Plan Badge — No FREE Flash

**File:** `e2e/tests/auth.spec.ts` (add to existing)
**Project:** `authenticated`
**Priority:** `[HIGH]`

```typescript
test('navbar plan badge shows PRO without flashing FREE', async ({ page }) => {
  await page.goto('/dashboard')
  // Capture all badge text values during page load
  const badgeTexts: string[] = []
  page.on('domcontentloaded', async () => {
    const badge = await page.locator('[data-testid="plan-badge"]').textContent().catch(() => '')
    if (badge) badgeTexts.push(badge)
  })
  await page.goto('/disclosures')
  await page.goto('/dashboard')
  // Badge must never show "FREE" for a pro user
  expect(badgeTexts.filter(t => t.includes('FREE'))).toHaveLength(0)
  await expect(page.locator('[data-testid="plan-badge"]')).toContainText('PRO')
})
```

**Assert:** Badge text never equals "FREE" during navigation for Pro user.

---

### Gap 4: `/api/health` Response Validation

**File:** `e2e/tests/api.spec.ts` (add to existing)
**Project:** `public`
**Priority:** `[CRITICAL]`

```typescript
test('GET /api/health returns 200 with db:ok', async ({ request }) => {
  const response = await request.get('/api/health')
  expect(response.status()).toBe(200)
  const body = await response.json()
  expect(body).toMatchObject({ status: 'ok', db: 'ok' })
  expect(typeof body.timestamp).toBe('string')
})
```

**Assert:** Status 200, body `{status:"ok",db:"ok"}`.

---

### Gap 5: Paddle Checkout Redirect Flow

**File:** `e2e/tests/payment.spec.ts` (extend existing)
**Project:** `authenticated`
**Priority:** `[HIGH]`

```typescript
test('pricing plan button initiates Paddle checkout redirect', async ({ page }) => {
  await page.goto('/pricing')
  const checkoutBtn = page.locator('[data-testid="get-pro-btn"]')
  await expect(checkoutBtn).toBeVisible()
  // Click and verify redirect to Paddle or overlay appears
  const [popup] = await Promise.all([
    page.waitForEvent('popup').catch(() => null),
    checkoutBtn.click()
  ])
  // Either popup or redirect to pay.paddle.com
  if (popup) {
    await expect(popup).toHaveURL(/paddle\.com/)
  } else {
    await expect(page).toHaveURL(/paddle\.com|checkout/)
  }
})
```

**Assert:** Clicking plan button navigates to Paddle (not error page, not same page).

---

### Gap 6: Back-Button After Disclosure Detail

**File:** `e2e/tests/disclosures-search.spec.ts` (extend existing)
**Project:** `authenticated`
**Priority:** `[HIGH]`

```typescript
test('back button from detail view restores list and scroll position', async ({ page }) => {
  await page.goto('/disclosures')
  // Scroll down to trigger scroll position tracking
  await page.evaluate(() => window.scrollTo(0, 300))
  const firstCardTitle = await page.locator('[data-testid="disclosure-card"]').first()
    .locator('[data-testid="headline"]').textContent()
  // Click first card to open detail
  await page.locator('[data-testid="disclosure-card"]').first().click()
  await expect(page).not.toHaveURL('/disclosures')
  // Go back
  await page.goBack()
  // Verify list restored
  await expect(page).toHaveURL('/disclosures')
  // Same card is still present
  await expect(page.locator('[data-testid="headline"]').first()).toHaveText(firstCardTitle!)
})
```

**Assert:** URL returns to `/disclosures`, list items preserved, scroll not at top.

---

### Gap 7: Search Dropdown → Result Click → Detail → Back

**File:** `e2e/tests/disclosures-search.spec.ts` (extend existing)
**Project:** `authenticated`
**Priority:** `[HIGH]`

```typescript
test('full search → select → detail → back flow', async ({ page }) => {
  await page.goto('/disclosures')
  const searchInput = page.locator('[data-testid="search-input"]')
  await searchInput.fill('삼성')
  // Wait for dropdown
  await expect(page.locator('[data-testid="search-dropdown"]')).toBeVisible()
  // Click first result
  await page.locator('[data-testid="search-result-item"]').first().click()
  // List filters
  await expect(page.locator('[data-testid="disclosure-card"]')).toHaveCount({ min: 1 })
  // Open detail
  await page.locator('[data-testid="disclosure-card"]').first().click()
  // Go back
  await page.goBack()
  // Search term preserved
  await expect(searchInput).toHaveValue('삼성')
})
```

**Assert:** Search value persists after back, list still filtered.

---

### Gap 8: 429 Rate-Limit Simulation on `/api/v1/*`

**File:** `e2e/tests/api.spec.ts` (extend)
**Project:** `public` (uses API key)
**Priority:** `[HIGH]`

```typescript
test('API rate limit returns 429 after threshold', async ({ request }) => {
  const apiKey = process.env.TEST_API_KEY!
  const responses = await Promise.all(
    Array.from({ length: 50 }).map(() =>
      request.get('/api/v1/disclosures', {
        headers: { 'X-API-Key': apiKey }
      })
    )
  )
  const statuses = responses.map(r => r.status())
  // At least some requests should be rate-limited
  expect(statuses).toContain(429)
  // 429 response should have Retry-After header
  const rateLimited = responses.find(r => r.status() === 429)
  if (rateLimited) {
    const headers = rateLimited.headers()
    expect(headers['retry-after']).toBeDefined()
  }
})
```

**Assert:** 429 returned when limit exceeded; `Retry-After` header present.

---

### Gap 9: Mobile Back-Swipe (iOS Safari Viewport)

**File:** `e2e/tests/mobile.spec.ts` (extend existing [8])
**Project:** `mobile-ios`
**Priority:** `[HIGH]`

```typescript
// Already partially covered in mobile.spec.ts [8]
// Extend to cover /disclosures specifically

test('[mobile] iOS back-swipe from disclosure detail returns to list', async ({ page }) => {
  await page.goto('/disclosures')
  await page.locator('[data-testid="disclosure-card"]').first().click()
  // Simulate iOS back gesture (history.back equivalent)
  await page.goBack()
  await expect(page).toHaveURL('/disclosures')
  // List must be populated
  await expect(page.locator('[data-testid="disclosure-card"]')).toHaveCount({ min: 1 })
})
```

**Assert:** History back works; list preserved without re-fetch flash.

---

## Test Priority Summary

| Test | File | Priority | Project |
|---|---|---|---|
| `/api/health` validation | `api.spec.ts` | `[CRITICAL]` | `public` |
| Bookmark add/remove | `bookmarks.spec.ts` | `[HIGH]` | `authenticated` |
| Back-button list restore | `disclosures-search.spec.ts` | `[HIGH]` | `authenticated` |
| Search → detail → back | `disclosures-search.spec.ts` | `[HIGH]` | `authenticated` |
| `/signal/[id]` SEO | `seo-pages.spec.ts` | `[HIGH]` | `public` |
| Navbar no FREE flash | `auth.spec.ts` | `[HIGH]` | `authenticated` |
| Paddle checkout redirect | `payment.spec.ts` | `[HIGH]` | `authenticated` |
| Mobile back-swipe disclosures | `mobile.spec.ts` | `[HIGH]` | `mobile-ios` |
| Rate limit 429 | `api.spec.ts` | `[HIGH]` | `public` |

---

## Running Specific Tests

```bash
cd frontend

# All tests
npx playwright test

# Specific file
npx playwright test e2e/tests/auth.spec.ts --project=public

# Mobile only
npx playwright test e2e/tests/mobile.spec.ts --project=mobile-ios

# Authenticated user tests
npx playwright test e2e/tests/disclosures-search.spec.ts --project=authenticated

# View HTML report
npx playwright show-report
```

> `.env.local` is auto-loaded by `playwright.config.ts` via `dotenv.config({ path: '../.env.local' })`.
> No manual env export needed before running tests.
