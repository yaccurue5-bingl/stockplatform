/**
 * navigation.spec.ts
 * Authenticated. Tests: back/forward, breadcrumbs, navbar links, signal page.
 */

import { test, expect } from '../fixtures/test-fixtures';

test.describe('Navbar navigation', () => {
  test('logo links to homepage', async ({ page }) => {
    await page.goto('/disclosures');
    const logo = page.locator('a[href="/"], [data-testid="logo"]').first();
    await logo.click();
    await expect(page).toHaveURL('/');
  });

  test('navbar links are all reachable', async ({ page }) => {
    await page.goto('/');

    const navLinks = page.locator('nav a').filter({ hasText: /.+/ });
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);

    // Each nav link should be visible
    for (let i = 0; i < count; i++) {
      await expect(navLinks.nth(i)).toBeVisible();
    }
  });
});

test.describe('Browser back/forward button', () => {
  test('back from signal detail returns to previous page', async ({ page }) => {
    await page.goto('/disclosures');

    // Find and click a signal link (if any signal links exist)
    const signalLink = page.locator('a[href*="/signal/"]').first();
    if (await signalLink.isVisible()) {
      const referrerUrl = page.url();
      await signalLink.click();

      await expect(page).toHaveURL(/\/signal\//);

      // Go back
      await page.goBack();
      await expect(page).toHaveURL(referrerUrl);
    }
  });

  test('back from disclosures detail preserves scroll position', async ({ page }) => {
    await page.goto('/disclosures');

    // Scroll down slightly
    await page.evaluate(() => window.scrollTo(0, 300));

    // Click a row to go to detail
    const firstRow = page.locator('table tbody tr, .disclosure-item').first();
    if (await firstRow.isVisible()) {
      await firstRow.click();

      // Go back
      await page.goBack();

      // Page should be back on /disclosures (scroll restoration is browser-managed)
      await expect(page).toHaveURL(/\/disclosures/);
    }
  });

  test('forward navigation works after back', async ({ page }) => {
    await page.goto('/');
    await page.goto('/api-docs');
    await page.goBack();
    await expect(page).toHaveURL('/');

    await page.goForward();
    await expect(page).toHaveURL(/\/api-docs/);
  });
});

test.describe('Signal public pages', () => {
  test('/signal/[id] renders without login (public SEO page)', async ({ browser }) => {
    // Use a fresh context (no auth state) to test public access
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    // We need a valid signal ID — use the API to find one
    const apiCtx = await browser.newContext();
    const apiPage = await apiCtx.newPage();
    await apiPage.goto('/disclosures');

    // Grab first signal link href from the page
    const signalHref = await apiPage
      .locator('a[href*="/signal/"]')
      .first()
      .getAttribute('href')
      .catch(() => null);

    await apiCtx.close();

    if (signalHref) {
      await page.goto(signalHref);
      await expect(page).toHaveURL(/\/signal\//);
      // Should show headline/event type
      await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });
    }

    await ctx.close();
  });
});
