/**
 * playwright.config.ts
 * Production-grade Playwright config for K-MarketInsight
 *
 * Auth flow:  global.setup.ts logs in once → saves e2e/.auth/user.json
 * All desktop/mobile projects depend on that session.
 * Public tests run without auth (no storageState).
 *
 * Env vars (CI / .env.test.local):
 *   PLAYWRIGHT_BASE_URL   – default http://localhost:3000
 *   TEST_USER_EMAIL       – dedicated test account
 *   TEST_USER_PASSWORD
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// .env.local 자동 로드 (프로젝트 루트 — frontend 상위 디렉터리)
// CI에서는 시스템 환경변수가 우선되므로 override: false
dotenv.config({ path: path.join(__dirname, '..', '.env.local'), override: false });

export const AUTH_FILE = path.join(__dirname, 'e2e/.auth/user.json');

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

// When a remote staging URL is provided we skip the local webServer
const isRemote = BASE_URL.startsWith('https://');

export default defineConfig({
  testDir: './e2e',

  /* Parallelism */
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries:    process.env.CI ? 2 : 0,
  workers:    process.env.CI ? 2 : 2,  // limit local workers; dev-mode page compilation is serial

  /* Reporters */
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ...(process.env.CI ? [['github'] as ['github']] : []),
  ],

  /* Global use */
  use: {
    baseURL:      BASE_URL,
    trace:        'on-first-retry',
    screenshot:   'only-on-failure',
    video:        'retain-on-failure',
    locale:       'en-US',
    timezoneId:   'Asia/Seoul',
    actionTimeout:  10_000,
    navigationTimeout: 30_000,
  },

  /* ── Projects ──────────────────────────────────────────────────────── */
  projects: [
    // 1) One-time auth setup
    {
      name: 'setup',
      testMatch: '**/global.setup.ts',
    },

    // 2) Desktop Chrome — authenticated
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
        viewport: { width: 1280, height: 800 },
      },
      dependencies: ['setup'],
      testIgnore: ['**/mobile.spec.ts', '**/auth.spec.ts'],
    },

    // 3) Mobile Android — authenticated
    {
      name: 'mobile-android',
      use: {
        ...devices['Pixel 5'],
        storageState: AUTH_FILE,
      },
      dependencies: ['setup'],
      testMatch: ['**/mobile.spec.ts'],
    },

    // 4) Mobile iOS — authenticated
    {
      name: 'mobile-ios',
      use: {
        ...devices['iPhone 13'],
        storageState: AUTH_FILE,
      },
      dependencies: ['setup'],
      testMatch: ['**/mobile.spec.ts'],
    },

    // 5) Public / auth tests — NO saved session
    {
      name: 'public',
      use: {
        ...devices['Desktop Chrome'],
        storageState: undefined,
      },
      testMatch: ['**/auth.spec.ts', '**/public.spec.ts'],
    },
  ],

  /* ── Local dev server ──────────────────────────────────────────────── */
  ...(isRemote
    ? {}
    : {
        webServer: {
          command: process.env.CI
            ? 'npm run build && npm run start'
            : 'npm run dev',
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
          env: {
            NEXT_PUBLIC_SUPABASE_URL:      process.env.NEXT_PUBLIC_SUPABASE_URL      ?? '',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
            NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN ?? '',
            NEXT_PUBLIC_PADDLE_PRICE_ID_STARTER: process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_STARTER ?? '',
            NEXT_PUBLIC_PADDLE_PRICE_ID_PRO:     process.env.NEXT_PUBLIC_PADDLE_PRICE_ID_PRO     ?? '',
          },
        },
      }),
});
