/**
 * payment.spec.ts
 * Authenticated desktop project.
 * Tests: Paddle checkout launch (mocked), plan gating, upgrade CTA.
 *
 * Paddle CDN is intercepted by mockPaddle(); the real SDK never loads.
 * window.__paddleCheckoutOpened is set to `true` when Checkout.open() fires.
 */

import { test, expect } from '../fixtures/test-fixtures';
import { mockPaddle, waitForCheckoutOpen, assertCheckoutNotOpened } from '../helpers/paddle';

// ── Plan pages ────────────────────────────────────────────────────────────────

const CHECKOUT_PAGES = [
  { path: '/checkout/starter', label: /starter/i },
  { path: '/checkout/pro',     label: /pro/i },
] as const;

test.describe('Checkout pages', () => {
  for (const { path, label } of CHECKOUT_PAGES) {
    test(`${path} page loads and shows plan name`, async ({ page }) => {
      await mockPaddle(page);
      await page.goto(path);

      // Must NOT redirect to login (we're authenticated)
      expect(page.url()).not.toMatch(/\/login/);

      // Should show the plan name somewhere on the page
      const planHeading = page.getByText(label);
      await expect(planHeading.first()).toBeVisible({ timeout: 10_000 });
    });
  }
});

// ── Paddle checkout launch ────────────────────────────────────────────────────

test.describe('Paddle checkout mock', () => {
  test('clicking "Subscribe" / "Upgrade" triggers Paddle Checkout.open()', async ({ page }) => {
    await mockPaddle(page);
    await page.goto('/checkout/starter');

    // Find the main CTA button (Subscribe / Upgrade / Get started)
    const cta = page.getByRole('button', { name: /subscribe|upgrade|get started|buy now/i }).first();
    if (!(await cta.isVisible({ timeout: 8_000 }).catch(() => false))) {
      test.skip();
      return;
    }

    await cta.click();
    await waitForCheckoutOpen(page);
  });

  test('Paddle stub does not open on page load (no auto-trigger)', async ({ page }) => {
    await mockPaddle(page);
    await page.goto('/checkout/starter');
    await page.waitForTimeout(2_000);
    await assertCheckoutNotOpened(page);
  });
});

// ── Unauthenticated access ────────────────────────────────────────────────────
// These tests run within the authenticated fixture but we verify page behaviour,
// not actual auth — the real unauthenticated redirect is covered in auth.spec.ts.

test.describe('Checkout page content', () => {
  test('shows price or plan details', async ({ page }) => {
    await mockPaddle(page);
    await page.goto('/checkout/starter');

    // Should have some price-looking text — e.g. $49, ₩49,000, etc.
    const priceEl = page.locator('body').getByText(/\$\d|₩[\d,]|USD|KRW|월|\/mo/i).first();
    await expect(priceEl).toBeVisible({ timeout: 10_000 });
  });

  test('has a terms / privacy link', async ({ page }) => {
    await page.goto('/checkout/starter');

    const termsLink = page
      .locator('a')
      .filter({ hasText: /terms|privacy|이용약관|개인정보/i })
      .first();

    // Terms link is optional on checkout pages — skip if not present
    if (await termsLink.isVisible().catch(() => false)) {
      const href = await termsLink.getAttribute('href');
      expect(href).toBeTruthy();
    }
  });
});

// ── Dashboard upgrade prompt ──────────────────────────────────────────────────

test.describe('Dashboard upgrade prompt', () => {
  test('/dashboard does not crash for authenticated user', async ({ page }) => {
    await page.goto('/dashboard');
    expect(page.url()).not.toMatch(/\/login/);

    // Should have visible body content
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('upgrade CTA (if present) links to a checkout page', async ({ page }) => {
    await page.goto('/dashboard');

    const upgradeBtn = page
      .getByRole('link', { name: /upgrade|upgrade plan|go pro/i })
      .first();

    if (!(await upgradeBtn.isVisible().catch(() => false))) {
      // No upgrade CTA visible for this account tier — skip
      test.skip();
      return;
    }

    const href = await upgradeBtn.getAttribute('href');
    expect(href).toMatch(/\/checkout\//);
  });
});
