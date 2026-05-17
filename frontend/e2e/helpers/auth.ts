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

  // The login page shows a spinner while it checks auth state (checkingAuth=true).
  // Once auth.getUser() resolves (unauthenticated), the "Continue with email" button appears.
  // waitFor() properly retries until visible — isVisible() does NOT wait/retry.
  const continueWithEmail = page.getByRole('button', { name: /continue with email/i });
  try {
    await continueWithEmail.waitFor({ state: 'visible', timeout: 15_000 });
    await continueWithEmail.click();
  } catch {
    // Button not present (env without 2-step flow) — fall through
  }

  await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 15_000 });

  await page.fill('input[type="email"]',    email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 30_000,   // dev-mode: first page compile can take 20s+
  });
}

/** Click the logout button (wherever it lives in the navbar).
 *
 * The landing Navbar hides the logout option inside a user dropdown (the plan
 * badge button).  We must open that dropdown first, then click "Logout".
 * After clicking, the landing page stays at "/" (no redirect), while the app
 * shell does window.location.href='/' — handle both cases.
 */
export async function logout(page: Page) {
  // 1. The plan-badge dropdown trigger may not be rendered yet — use waitFor (retries),
  //    not isVisible() (returns current state immediately, may be false during Navbar loading).
  const planBadgeBtn = page.locator('button').filter({ hasText: /MEMBER|DEV|PRO|FREE/i }).first();
  try {
    await planBadgeBtn.waitFor({ state: 'visible', timeout: 8_000 });
    await planBadgeBtn.click();
  } catch {
    // Plan badge not found — logout may be directly accessible (e.g. UserButton context)
  }

  // 2. Wait for and click the logout / sign-out option.
  //    Use getByRole (checks accessible name including title="Log out") so this works for:
  //    - Landing Navbar: button text "Logout" (visible inside open dropdown)
  //    - AppShell sidebar: icon-only button with title="Log out" (always in DOM on desktop)
  const logoutBtn = page.getByRole('button', { name: /log.?out|sign.?out/i }).first();
  await logoutBtn.waitFor({ state: 'visible', timeout: 5_000 });
  await logoutBtn.click();

  // 3. Wait for logged-out state — two possible outcomes:
  //    - AppShell: router.push('/login') fires → URL changes to /login
  //    - Landing Navbar: stays at /, "Login" nav link re-appears
  // Two possible post-logout states:
  //   AppShell  → router.push('/login'), so URL changes to /login
  //   Landing   → no navigation, stays at /, "Login" link re-appears in Navbar
  // IMPORTANT: do NOT include '/' in waitForURL — it matches the current page
  // before logout completes, which would make the race resolve prematurely.
  await Promise.race([
    page.waitForURL(
      (url) => url.pathname.startsWith('/login'),
      { timeout: 10_000 },
    ).catch(() => {}),
    page.getByRole('link', { name: /log.?in|sign.?in/i })
      .waitFor({ state: 'visible', timeout: 10_000 })
      .catch(() => {}),
  ]);
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
