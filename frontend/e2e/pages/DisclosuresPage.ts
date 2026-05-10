/**
 * pages/DisclosuresPage.ts — Page Object Model for /disclosures
 */

import { Page, Locator, expect } from '@playwright/test';

export class DisclosuresPage {
  readonly page:            Page;
  readonly searchInput:     Locator;
  readonly searchDropdown:  Locator;
  readonly disclosureRows:  Locator;
  readonly loadingSpinner:  Locator;
  readonly nextPageButton:  Locator;
  readonly prevPageButton:  Locator;

  constructor(page: Page) {
    this.page           = page;
    // Adjust selectors to match your actual SearchDropdown component
    this.searchInput    = page.getByPlaceholder(/search company|회사명/i);
    this.searchDropdown = page.locator('[data-testid="search-dropdown"], .search-results, [role="listbox"]');
    this.disclosureRows = page.locator('[data-testid="disclosure-row"], table tbody tr, .disclosure-item');
    this.loadingSpinner = page.locator('[data-testid="loading"], .loading, [aria-busy="true"]');
    this.nextPageButton = page.getByRole('button', { name: /next|다음/i });
    this.prevPageButton = page.getByRole('button', { name: /prev|previous|이전/i });
  }

  async goto() {
    await this.page.goto('/disclosures');
    await this.waitForLoad();
  }

  async waitForLoad() {
    // Wait until the spinner is gone (if present) and at least one row appears
    await this.loadingSpinner.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    await this.disclosureRows.first().waitFor({ state: 'visible', timeout: 15_000 });
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    // Give autocomplete a moment to appear
    await this.page.waitForTimeout(400);
  }

  async selectFirstDropdownResult() {
    const firstResult = this.searchDropdown.locator('li, [role="option"]').first();
    await firstResult.waitFor({ state: 'visible', timeout: 5_000 });
    await firstResult.click();
  }

  async clickFirstRow() {
    const firstRow = this.disclosureRows.first();
    await firstRow.waitFor({ state: 'visible' });
    await firstRow.click();
  }

  async goToNextPage() {
    await this.nextPageButton.click();
    await this.waitForLoad();
  }

  async assertRowCount(min: number) {
    const count = await this.disclosureRows.count();
    expect(count, `Expected at least ${min} rows`).toBeGreaterThanOrEqual(min);
  }

  async assertSearchInputHasValue(value: string) {
    await expect(this.searchInput).toHaveValue(value);
  }
}
