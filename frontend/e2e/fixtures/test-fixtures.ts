/**
 * fixtures/test-fixtures.ts
 * Extends Playwright's base `test` with project-specific fixtures.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/test-fixtures'
 */

import { test as base, expect, APIRequestContext, Page } from '@playwright/test';
import { LoginPage }       from '../pages/LoginPage';
import { DisclosuresPage } from '../pages/DisclosuresPage';

type Fixtures = {
  loginPage:       LoginPage;
  disclosuresPage: DisclosuresPage;
  /** Authenticated API request context (passes Supabase anon key header) */
  apiContext:      APIRequestContext;
};

export const test = base.extend<Fixtures>({

  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  disclosuresPage: async ({ page }, use) => {
    await use(new DisclosuresPage(page));
  },

  /** API context pre-configured with the Supabase anon key */
  apiContext: async ({ playwright }, use) => {
    const ctx = await playwright.request.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
      extraHTTPHeaders: {
        'Content-Type': 'application/json',
      },
    });
    await use(ctx);
    await ctx.dispose();
  },
});

export { expect };
