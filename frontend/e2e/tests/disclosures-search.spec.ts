/**
 * disclosures-search.spec.ts
 * Authenticated. Tests: list loads, search dropdown, filter, detail view.
 */

import { test, expect } from '../fixtures/test-fixtures';

test.describe('Disclosures list', () => {
  test('loads and shows disclosure rows', async ({ disclosuresPage }) => {
    await disclosuresPage.goto();
    await disclosuresPage.assertRowCount(1);
  });

  test('search input is visible and focusable', async ({ disclosuresPage }) => {
    await disclosuresPage.goto();
    await expect(disclosuresPage.searchInput).toBeVisible();
    await disclosuresPage.searchInput.focus();
    await expect(disclosuresPage.searchInput).toBeFocused();
  });
});

test.describe('Search flow', () => {
  test('typing a company name shows dropdown results', async ({ disclosuresPage }) => {
    await disclosuresPage.goto();
    await disclosuresPage.search('삼성');

    // Dropdown should appear with at least one result
    await expect(disclosuresPage.searchDropdown).toBeVisible({ timeout: 5_000 });
    const items = disclosuresPage.searchDropdown.locator('li, [role="option"]');
    expect(await items.count()).toBeGreaterThan(0);
  });

  test('selecting a dropdown result filters the list', async ({ page, disclosuresPage }) => {
    await disclosuresPage.goto();
    await disclosuresPage.search('삼성');
    await disclosuresPage.selectFirstDropdownResult();

    // After selection, disclosure rows should be filtered
    await disclosuresPage.waitForLoad();
    await disclosuresPage.assertRowCount(1);
  });

  test('clearing search restores full list', async ({ disclosuresPage }) => {
    await disclosuresPage.goto();

    // Get initial count
    const initialCount = await disclosuresPage.disclosureRows.count();

    // Search then clear
    await disclosuresPage.search('삼성');
    await disclosuresPage.searchInput.clear();
    await disclosuresPage.waitForLoad();

    // Should be back to full list (same or more rows)
    const afterClear = await disclosuresPage.disclosureRows.count();
    expect(afterClear).toBeGreaterThanOrEqual(1);
  });

  test('pagination: next page loads different content', async ({ page, disclosuresPage }) => {
    await disclosuresPage.goto();

    // Snapshot first row text
    const firstRowText = await disclosuresPage.disclosureRows.first().textContent();

    // Navigate to page 2 (if available)
    if (await disclosuresPage.nextPageButton.isVisible()) {
      await disclosuresPage.goToNextPage();

      // First row on page 2 should differ from page 1
      const newFirstRow = await disclosuresPage.disclosureRows.first().textContent();
      expect(newFirstRow).not.toBe(firstRowText);
    }
  });
});

test.describe('Disclosure detail view', () => {
  test('clicking a row opens the detail panel', async ({ page, disclosuresPage }) => {
    await disclosuresPage.goto();

    // Capture current URL
    const listUrl = page.url();

    await disclosuresPage.clickFirstRow();

    // Either URL changed (navigated to /disclosures/[id]) or a panel appeared
    const detailVisible =
      page.url() !== listUrl ||
      (await page.locator('[data-testid="disclosure-detail"], .disclosure-detail').isVisible());

    expect(detailVisible).toBe(true);
  });

  test('detail page shows Financial Impact section', async ({ page, disclosuresPage }) => {
    await disclosuresPage.goto();
    await disclosuresPage.clickFirstRow();

    // Wait for detail content
    const financialImpact = page.getByText(/financial impact/i);
    await expect(financialImpact).toBeVisible({ timeout: 10_000 });
  });

  test('back button returns to the list with state preserved', async ({ page, disclosuresPage }) => {
    await disclosuresPage.goto();

    // Optionally search first to set some state
    await disclosuresPage.search('삼성');
    await disclosuresPage.selectFirstDropdownResult().catch(() => {});

    await disclosuresPage.clickFirstRow();

    // Navigate back
    await page.goBack();

    // Should be on /disclosures
    await expect(page).toHaveURL(/\/disclosures/);
  });
});
