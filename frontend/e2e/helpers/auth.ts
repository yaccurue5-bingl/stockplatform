/**
 * helpers/auth.ts
 * Reusable auth utilities for E2E tests.
 */

import { Page, BrowserContext, expect } from '@playwright/test';

export const TEST_EMAIL    = process.env.TEST_USER_EMAIL    ?? 'test@example.com';
export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD ?? 'password';

/** Full UI login flow. Returns after successful redirect away from /login. */
export async function loginViaUI(
  page: Page,
  email    = TEST_EMAIL,
  password = TEST_PASSWORD,
) {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]', { state: 'visible' });

  await page.fill('input[type="email"]',    email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 15_000,
  });
}

/** Click the logout button (wherever it lives in the navbar). */
export async function logout(page: Page) {
  // The navbar has a logout/sign-out trigger — adjust selector if needed
  const logoutBtn = page.getByRole('button', { name: /sign out|log out|logout/i });
  await logoutBtn.click();

  // After logout we should land on / or /login
  await page.waitForURL((url) =>
    url.pathname === '/' || url.pathname.startsWith('/login'),
  );
}

/** Assert no Supabase auth cookie present (unauthenticated). */
export async function assertLoggedOut(context: BrowserContext) {
  const cookies = await context.cookies();
  const authCookies = cookies.filter(
    (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'),
  );
  expect(authCookies).toHaveLength(0);
}

/** Assert Supabase auth cookie is present (authenticated). */
export async function assertLoggedIn(context: BrowserContext) {
  const cookies = await context.cookies();
  const hasAuth  = cookies.some(
    (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'),
  );
  expect(hasAuth, 'Expected Supabase auth cookie').toBe(true);
}

/** Clear all cookies and localStorage — simulates a fresh browser. */
export async function clearSession(context: BrowserContext) {
  await context.clearCookies();
  // localStorage is cleared per-origin
  const pages = context.pages();
  for (const p of pages) {
    await p.evaluate(() => localStorage.clear()).catch(() => {});
  }
}
