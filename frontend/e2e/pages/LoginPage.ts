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
    this.errorMessage  = page.locator('[role="alert"], .error, [data-testid="error"]');
    this.googleButton  = page.getByRole('button', { name: /google/i });
  }

  async goto() {
    await this.page.goto('/login');
    await this.emailInput.waitFor({ state: 'visible' });
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
    await expect(this.errorMessage).toBeVisible({ timeout: 5_000 });
  }

  async assertRedirectedAway() {
    await this.page.waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: 15_000,
    });
  }
}
