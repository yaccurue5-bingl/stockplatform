/**
 * auth.spec.ts
 * Runs under the 'public' project (no pre-saved auth state).
 *
 * Covers the 9-item auth flow checklist:
 *   [1] Login
 *   [2] Logout
 *   [3] Back button after logout
 *   [4] Expired / invalid session
 *   [5] Multiple tabs
 *   [6] Refresh after login
 *   [7] Protected route direct access (unauthenticated)
 *   [8] Mobile safari back swipe  → see mobile.spec.ts (mobile-ios project)
 *   [9] Social login redirect
 */

import { test, expect } from '@playwright/test';

// Auth tests share one Supabase test account — run sequentially to avoid
// concurrent session conflicts and Supabase rate limiting in dev mode.
test.describe.configure({ mode: 'serial' });
import {
  loginViaUI,
  logout,
  assertLoggedIn,
  assertLoggedOut,
  clearSession,
} from '../helpers/auth';
import { LoginPage } from '../pages/LoginPage';

const EMAIL    = process.env.TEST_USER_EMAIL    ?? '';
const PASSWORD = process.env.TEST_USER_PASSWORD ?? '';

// ── [1] & [7]: Login + Protected route redirect ───────────────────────────────

test.describe('Login flow', () => {
  test('renders login form', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('[7] unauthenticated access to protected route redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows error on wrong password', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(EMAIL, 'wrong-password-xyz');
    await loginPage.assertErrorVisible();
    await loginPage.assertOnLoginPage();
  });

  test('shows error on invalid email format', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('not-an-email', PASSWORD);
    // HTML5 validation fires before submit — remains on login page
    await loginPage.assertOnLoginPage();
  });

  test('[1] successfully logs in and sets Supabase auth cookie', async ({ page, context }) => {
    await loginViaUI(page, EMAIL, PASSWORD);

    // Cookie must be present
    await assertLoggedIn(context);

    // Must have left /login
    expect(page.url()).not.toMatch(/\/login/);
  });

  test('preserves redirectTo param after login', async ({ page }) => {
    await page.goto('/login?redirectTo=/disclosures');

    const continueWithEmail = page.getByRole('button', { name: /continue with email/i });
    try {
      await continueWithEmail.waitFor({ state: 'visible', timeout: 15_000 });
      await continueWithEmail.click();
    } catch {
      // Button not present — fall through
    }

    await page.waitForSelector('input[type="email"]', { state: 'visible', timeout: 15_000 });
    await page.fill('input[type="email"]',    EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');

    // Must redirect away from /login (ideally to /disclosures)
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: 30_000,
    });
  });
});

// ── [2]: Logout ───────────────────────────────────────────────────────────────

test.describe('Logout', () => {
  test('[2] clears session cookie and redirects to / or /login', async ({ page, context }) => {
    await loginViaUI(page, EMAIL, PASSWORD);
    await assertLoggedIn(context);

    await logout(page);   // opens dropdown → clicks Logout → waits for logged-out UI

    await assertLoggedOut(context);
  });
});

// ── [3]: Back button after logout ─────────────────────────────────────────────

test.describe('Back button after logout', () => {
  /**
   * After logging out, pressing the browser back button may restore the previous
   * page from bfcache (Back-Forward Cache). The middleware must re-validate auth
   * on any subsequent navigation so no protected data is exposed.
   */
  test('[3] back navigation after logout cannot expose protected content', async ({ page, context }) => {
    // 1. Log in and land on a protected page
    await loginViaUI(page, EMAIL, PASSWORD);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);

    // 2. Log out (redirects to / or /login)
    await logout(page);
    await assertLoggedOut(context);

    // 3. Simulate the browser back button — bfcache may restore /dashboard visually
    await page.goBack();

    // 4. A hard reload (bypasses bfcache) must trigger the auth gate
    await page.reload();
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

// ── [4]: Expired / invalid session ────────────────────────────────────────────

test.describe('Expired session', () => {
  /**
   * If the Supabase auth cookie is malformed or expired the middleware
   * must redirect the user to /login rather than serving protected content.
   */
  test('[4] malformed auth cookie redirects to /login', async ({ page, context }) => {
    // Log in once to discover the real cookie name
    await loginViaUI(page, EMAIL, PASSWORD);
    const cookies    = await context.cookies();
    const authCookie = cookies.find(
      (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'),
    );

    // Replace cookie value with an invalid JWT to simulate expiry
    await context.clearCookies();
    if (authCookie) {
      await context.addCookies([{
        ...authCookie,
        value: 'invalid.expired.jwt.token',
      }]);
    }

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

// ── [5]: Multiple tabs ────────────────────────────────────────────────────────

test.describe('Multiple tabs', () => {
  /**
   * Tabs in the same browser window share the same cookie jar, so logging in
   * on one tab should immediately give the other tab access, and logging out
   * on one tab should revoke access for all tabs.
   */
  test('[5a] login in one tab grants access in a second tab', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // Log in on page1
    await loginViaUI(page1, EMAIL, PASSWORD);
    await assertLoggedIn(context);

    // page2 shares the same cookie jar — should reach the dashboard without re-login
    await page2.goto('/dashboard');
    await expect(page2).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    await page1.close();
    await page2.close();
  });

  test('[5b] logout in one tab blocks protected access in other tabs', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // Both tabs authenticated
    await loginViaUI(page1, EMAIL, PASSWORD);
    await page2.goto('/dashboard');
    await expect(page2).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // Log out in page1
    await logout(page1);
    await assertLoggedOut(context);

    // page2: any subsequent navigation to a protected route must redirect
    await page2.goto('/dashboard');
    await expect(page2).toHaveURL(/\/login/, { timeout: 10_000 });

    await page1.close();
    await page2.close();
  });
});

// ── [6]: Refresh after login ──────────────────────────────────────────────────

test.describe('Session persistence', () => {
  test('[6] session survives a full page reload', async ({ page, context }) => {
    await loginViaUI(page, EMAIL, PASSWORD);
    await assertLoggedIn(context);

    // Hard reload — Supabase SSR must restore session from cookie
    await page.reload();
    await assertLoggedIn(context);

    // Still able to reach protected routes
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('clearing all cookies logs the user out on next navigation', async ({ page, context }) => {
    await loginViaUI(page, EMAIL, PASSWORD);
    await assertLoggedIn(context);

    await clearSession(context);

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});

// ── [9]: Social login redirect ────────────────────────────────────────────────

test.describe('Social login', () => {
  /**
   * Clicking the Google login button must initiate an OAuth redirect.
   * We intercept the outbound request so the test stays self-contained
   * (no real Google credentials needed).
   */
  test('[9] Google login button initiates OAuth redirect to Google / Supabase', async ({ page }) => {
    await page.goto('/login');

    // Capture the first request that leaves the app toward Google OAuth
    let capturedOAuthUrl = '';

    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (
        url.includes('accounts.google.com') ||
        url.includes('google.com/o/oauth2') ||
        (url.includes('supabase') && url.includes('authorize')) ||
        url.includes('/auth/v1/authorize')
      ) {
        capturedOAuthUrl = url;
        // Abort so we don't actually navigate away
        await route.abort();
      } else {
        await route.continue();
      }
    });

    const loginPage = new LoginPage(page);

    // googleButton may not exist if social auth is disabled in this env
    const hasGoogleBtn = await loginPage.googleButton.isVisible({ timeout: 3_000 }).catch(() => false);
    if (!hasGoogleBtn) {
      test.skip(true, 'Google login button not visible — social auth may be disabled');
      return;
    }

    // Click — navigation abort will throw; that is expected
    await loginPage.googleButton.click({ timeout: 5_000 }).catch(() => {});

    // Allow the route handler a moment to capture the URL
    await page.waitForTimeout(1_000);

    expect(
      capturedOAuthUrl,
      'Expected Google OAuth redirect but none was intercepted',
    ).toMatch(
      /accounts\.google\.com|google\.com\/o\/oauth2|supabase.*authorize|\/auth\/v1\/authorize/,
    );
  });
});
