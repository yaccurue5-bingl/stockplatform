/**
 * pages/LoginPage.ts — Page Object Model for /login
 */

import { Page, Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page:      Page;
  readonly emailInput:    Locator;
  readonly passwordInput: Locator;
  readonly submitButton:  Locator;
  readonly errorMessage:  Locator;
  readonly googleButton:  Locator;

  constructor(page: Page) {
    this.page          = page;
    this.emailInput    = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.submitButton  = page.locator('button[type="submit"]');
    // Matches <p class="text-sm text-red-600"> inside the red error box on the login page
    this.errorMessage  = page.locator('p.text-red-600, [role="alert"]');
    this.googleButton  = page.getByRole('button', { name: /google/i });
  }

  async goto() {
    await this.page.goto('/login');

    // The login page shows a spinner while it checks auth state (checkingAuth=true).
    // Once auth.getUser() resolves (unauthenticated), the "Continue with email" button appears.
    // waitFor() properly retries until visible — isVisible() does NOT wait/retry.
    const continueWithEmail = this.page.getByRole('button', { name: /continue with email/i });
    try {
      await continueWithEmail.waitFor({ state: 'visible', timeout: 15_000 });
      await continueWithEmail.click();
    } catch {
      // Button not present (env without 2-step flow) — fall through to check email input
    }

    await this.emailInput.waitFor({ state: 'visible', timeout: 15_000 });
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async assertOnLoginPage() {
    await expect(this.page).toHaveURL(/\/login/);
    await expect(this.emailInput).toBeVisible();
  }

  async assertErrorVisible() {
    await expect(this.errorMessage).toBeVisible({ timeout: 10_000 });
  }

  async assertRedirectedAway() {
    await this.page.waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: 15_000,
    });
  }
}
