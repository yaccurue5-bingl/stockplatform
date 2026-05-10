/**
 * protected-routes.spec.ts
 * Authenticated project. Verifies the middleware correctly gates routes.
 */

import { test, expect } from '../fixtures/test-fixtures';

// ── Protected routes (require login) ────────────────────────────────────────

const PROTECTED_ROUTES = [
  '/dashboard',
  '/api-key',
  '/usage',
  '/checkout/starter',
  '/checkout/pro',
] as const;

// ── Public routes (accessible without login) ─────────────────────────────────

const PUBLIC_ROUTES = [
  '/',
  '/api-docs',
  '/terms',
] as const;

test.describe('Protected routes — authenticated access', () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route} loads without redirect`, async ({ page }) => {
      const response = await page.goto(route);

      // Must NOT redirect to /login
      expect(page.url()).not.toMatch(/\/login/);

      // Should have a valid HTTP status (200 or 3xx handled by Next.js)
      expect(response?.status() ?? 200).toBeLessThan(500);
    });
  }
});

test.describe('Public routes — accessible when authenticated', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} renders correctly`, async ({ page }) => {
      await page.goto(route);
      // Should not redirect to login
      expect(page.url()).not.toMatch(/\/login/);
      // Page should have content
      await expect(page.locator('body')).not.toBeEmpty();
    });
  }
});

test.describe('API routes — middleware enforcement', () => {
  test('/api/v1/disclosures returns 401 without API key', async ({ apiContext }) => {
    const res = await apiContext.get('/api/v1/disclosures');
    // Must be 401 (no API key passed)
    expect([401, 403]).toContain(res.status());
  });

  test('/api/health returns 200', async ({ apiContext }) => {
    const res = await apiContext.get('/api/health');
    expect(res.status()).toBe(200);
  });

  test('cron endpoint requires secret token', async ({ apiContext }) => {
    // Without auth header → should be rejected
    const res = await apiContext.get('/api/cron/daily-batch');
    expect([401, 403, 404]).toContain(res.status());
  });
});
