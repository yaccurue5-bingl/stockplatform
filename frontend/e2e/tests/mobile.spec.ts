/**
 * mobile.spec.ts
 * Runs under the mobile-android and mobile-ios projects (Pixel 5 / iPhone 13).
 * Tests: viewport, touch-friendly tap targets, hamburger menu, responsive tables.
 */

import { test, expect } from '../fixtures/test-fixtures';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function viewportSize(page: import('@playwright/test').Page) {
  return page.evaluate(() => ({
    width:  window.innerWidth,
    height: window.innerHeight,
  }));
}

// ── Viewport sanity ───────────────────────────────────────────────────────────

test.describe('Viewport', () => {
  test('is narrower than 768 px on mobile projects', async ({ page }) => {
    await page.goto('/');
    const { width } = await viewportSize(page);
    // Both Pixel 5 (393) and iPhone 13 (390) are under 768
    expect(width).toBeLessThan(768);
  });
});

// ── Homepage layout ───────────────────────────────────────────────────────────

test.describe('Homepage layout on mobile', () => {
  test('hero section is visible', async ({ page }) => {
    await page.goto('/');
    // Main heading should be visible without horizontal scroll
    const hero = page.locator('h1, [data-testid="hero-heading"]').first();
    await expect(hero).toBeVisible();
  });

  test('no horizontal overflow', async ({ page }) => {
    await page.goto('/');
    const hasHScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHScroll).toBe(false);
  });
});

// ── Navigation ────────────────────────────────────────────────────────────────

test.describe('Mobile navigation', () => {
  test('hamburger / mobile menu button exists or nav is collapsed', async ({ page }) => {
    await page.goto('/');

    // Either a hamburger icon is present, OR the desktop nav is hidden (not both visible)
    const hamburger = page.locator(
      '[data-testid="hamburger"], [aria-label*="menu" i], button.mobile-menu-btn',
    );
    const desktopNav = page.locator('nav');

    const hasHamburger = await hamburger.count() > 0;
    const navVisible   = await desktopNav.isVisible().catch(() => false);

    // At least one of: a hamburger is present, or nav is hidden on mobile
    expect(hasHamburger || !navVisible).toBe(true);
  });

  test('tapping hamburger opens mobile menu', async ({ page }) => {
    await page.goto('/');

    const hamburger = page.locator(
      '[data-testid="hamburger"], [aria-label*="menu" i], button.mobile-menu-btn',
    ).first();

    if (!(await hamburger.isVisible().catch(() => false))) {
      test.skip();
      return;
    }

    await hamburger.tap();

    // After tapping, a nav link or menu panel should appear
    const menuPanel = page.locator('[data-testid="mobile-menu"], nav a').first();
    await expect(menuPanel).toBeVisible({ timeout: 5_000 });
  });
});

// ── Disclosures page ──────────────────────────────────────────────────────────

test.describe('Disclosures on mobile', () => {
  test('search input is tappable', async ({ disclosuresPage }) => {
    await disclosuresPage.goto();
    await expect(disclosuresPage.searchInput).toBeVisible();
    await disclosuresPage.searchInput.tap();
    await expect(disclosuresPage.searchInput).toBeFocused();
  });

  test('disclosure rows are full-width (no overflow)', async ({ disclosuresPage, page }) => {
    await disclosuresPage.goto();
    await disclosuresPage.assertRowCount(1);

    const overflow = await page.evaluate(() => {
      const rows = document.querySelectorAll(
        '[data-testid="disclosure-row"], table tbody tr, .disclosure-item',
      );
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (rect.right > window.innerWidth + 4) return true; // 4 px tolerance
      }
      return false;
    });

    expect(overflow).toBe(false);
  });

  test('tapping a row navigates to detail', async ({ disclosuresPage, page }) => {
    await disclosuresPage.goto();
    const listUrl = page.url();

    const firstRow = disclosuresPage.disclosureRows.first();
    await firstRow.waitFor({ state: 'visible' });
    await firstRow.tap();

    // Either URL changed or a detail panel opened
    await page.waitForTimeout(1_000);
    const detailVisible =
      page.url() !== listUrl ||
      (await page.locator('[data-testid="disclosure-detail"], .disclosure-detail').isVisible());

    expect(detailVisible).toBe(true);
  });
});

// ── Tap target size ───────────────────────────────────────────────────────────

test.describe('Tap target sizes', () => {
  test('nav links / buttons meet 44 px minimum height', async ({ page }) => {
    await page.goto('/');

    const tooSmall = await page.evaluate(() => {
      const MIN = 44;
      const els = document.querySelectorAll('nav a, nav button, header button');
      const violations: string[] = [];
      for (const el of els) {
        const rect = el.getBoundingClientRect();
        // Only flag visible elements with very small tap area
        if (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.height < MIN &&
          rect.width < MIN
        ) {
          violations.push(`${el.tagName} "${el.textContent?.trim().slice(0, 30)}": ${rect.width}×${rect.height}`);
        }
      }
      return violations;
    });

    // Allow up to 2 minor violations (icon-only buttons, etc.)
    expect(tooSmall.length, `Tap-target violations:\n${tooSmall.join('\n')}`).toBeLessThanOrEqual(2);
  });
});

// ── Checkout / pricing page ───────────────────────────────────────────────────

test.describe('Pricing / checkout page on mobile', () => {
  test('checkout page loads without layout overflow', async ({ page }) => {
    await page.goto('/checkout/starter');

    // Should not redirect to /login (we're authenticated)
    expect(page.url()).not.toMatch(/\/login/);

    const hasHScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHScroll).toBe(false);
  });
});
