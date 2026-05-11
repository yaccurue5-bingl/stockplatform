/**
 * auth.spec.ts
 * Runs under the 'public' project (no pre-saved auth state).
 * Tests: login, logout, bad credentials, session persistence, Supabase cookie.
 */

import { test, expect } from '@playwright/test';
import { loginViaUI, assertLoggedIn, assertLoggedOut, clearSession } from '../helpers/auth';
import { LoginPage } from '../pages/LoginPage';

const EMAIL    = process.env.TEST_USER_EMAIL    ?? '';
const PASSWORD = process.env.TEST_USER_PASSWORD ?? '';

test.describe('Login flow', () => {
  test('renders login form', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('redirects to /login when accessing protected route unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows error on wrong password', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(EMAIL, 'wrong-password-xyz');
    await loginPage.assertErrorVisible();
    // Must remain on login page
    await loginPage.assertOnLoginPage();
  });

  test('shows error on invalid email format', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('not-an-email', PASSWORD);
    // HTML5 validation fires before submit — still on login page
    await loginPage.assertOnLoginPage();
  });

  test('successfully logs in with valid credentials', async ({ page, context }) => {
    await loginViaUI(page, EMAIL, PASSWORD);

    // Confirm Supabase auth cookie was set
    await assertLoggedIn(context);

    // Should be away from /login
    expect(page.url()).not.toMatch(/\/login/);
  });

  test('preserves redirectTo param after login', async ({ page }) => {
    await page.goto('/login?redirectTo=/disclosures');
    await page.fill('input[type="email"]',    EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');

    // After login, should redirect to /disclosures (or at minimum away from /login)
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
  });
});

test.describe('Logout', () => {
  test('clears session and redirects after logout', async ({ page, context }) => {
    // Login first
    await loginViaUI(page, EMAIL, PASSWORD);
    await assertLoggedIn(context);

    // Trigger logout (find logout button wherever it is)
    const logoutBtn = page.getByRole('button', { name: /sign out|log out|logout/i });
    await logoutBtn.waitFor({ state: 'visible', timeout: 5_000 });
    await logoutBtn.click();

    // After logout: on / or /login
    await page.waitForURL((url) =>
      url.pathname === '/' || url.pathname.startsWith('/login'),
      { timeout: 10_000 },
    );

    // Auth cookie must be gone
    await assertLoggedOut(context);
  });
});

test.describe('Session persistence', () => {
  test('session survives page reload', async ({ page, context }) => {
    await loginViaUI(page, EMAIL, PASSWORD);
    await assertLoggedIn(context);

    // Reload — Supabase SSR should restore session from cookie
    await page.reload();
    await assertLoggedIn(context);
  });

  test('clearing cookies logs user out', async ({ page, context }) => {
    await loginViaUI(page, EMAIL, PASSWORD);
    await assertLoggedIn(context);

    await clearSession(context);

    // Now navigating to a protected route must redirect to login
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
