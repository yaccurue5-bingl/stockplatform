/**
 * global.setup.ts
 * Runs once before all test projects.
 * Authenticates via UI → saves browser storage state to e2e/.auth/user.json.
 * All subsequent tests reuse this session — no repeated logins.
 */

import { test as setup, expect } from '@playwright/test';
import path from 'path';

const AUTH_FILE = path.join(__dirname, '.auth/user.json');

setup('authenticate', async ({ page }) => {
  const email    = process.env.TEST_USER_EMAIL    ?? '';
  const password = process.env.TEST_USER_PASSWORD ?? '';

  if (!email || !password) {
    throw new Error(
      'TEST_USER_EMAIL and TEST_USER_PASSWORD must be set.\n' +
      'Add them to .env.test.local or as CI secrets.'
    );
  }

  await page.goto('/login');

  // Wait for form to be ready
  await page.waitForSelector('input[type="email"]', { state: 'visible' });

  // Fill credentials
  await page.fill('input[type="email"]',    email);
  await page.fill('input[type="password"]', password);

  // Submit
  await page.click('button[type="submit"]');

  // Wait for successful redirect (away from /login)
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
    timeout: 15_000,
  });

  // Sanity: confirm we have a session (Supabase cookie present)
  const cookies = await page.context().cookies();
  const hasAuth  = cookies.some(
    (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  );
  expect(hasAuth, 'Supabase auth cookie must be present after login').toBe(true);

  // Persist storage state for all test projects
  await page.context().storageState({ path: AUTH_FILE });
  console.log(`✅ Auth state saved → ${AUTH_FILE}`);
});
