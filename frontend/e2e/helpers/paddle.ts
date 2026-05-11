/**
 * helpers/paddle.ts
 * Mock Paddle Billing overlay for payment flow tests.
 *
 * Strategy:
 *  1. Intercept Paddle CDN script loads (return stub JS)
 *  2. Inject a window.Paddle mock before each test
 *  3. Capture checkout.open() calls to assert intent
 */

import { Page, Route } from '@playwright/test';

/** Stub JS that satisfies Paddle's `Paddle.Setup()` + `Paddle.Checkout.open()` API */
const PADDLE_STUB = `
  window.Paddle = {
    Environment: { set: () => {} },
    Initialize:  ({ token, eventCallback }) => {
      window.__paddleToken = token;
      window.__paddleEventCallback = eventCallback;
    },
    Checkout: {
      open: (opts) => {
        window.__paddleCheckoutOpened = true;
        window.__paddleCheckoutOpts  = opts;
        // Fire a synthetic checkout.loaded event so the app doesn't hang
        if (window.__paddleEventCallback) {
          window.__paddleEventCallback({ name: 'checkout.loaded', data: {} });
        }
      },
    },
  };
  window.__paddleCheckoutOpened = false;
`;

/** Block Paddle CDN and inject our stub instead. */
export async function mockPaddle(page: Page) {
  // Block real Paddle scripts
  await page.route('**cdn.paddle.com/**', (route: Route) => {
    if (route.request().url().endsWith('.js')) {
      route.fulfill({
        contentType: 'application/javascript',
        body: PADDLE_STUB,
      });
    } else {
      route.abort();
    }
  });

  await page.route('**sandbox-cdn.paddle.com/**', (route: Route) => {
    if (route.request().url().endsWith('.js')) {
      route.fulfill({
        contentType: 'application/javascript',
        body: PADDLE_STUB,
      });
    } else {
      route.abort();
    }
  });

  // Also inject stub before page scripts run (covers Next.js Script tags)
  await page.addInitScript(PADDLE_STUB);
}

/** Wait for the app to call Paddle.Checkout.open() and return the options passed. */
export async function waitForCheckoutOpen(page: Page, timeout = 8_000) {
  await page.waitForFunction(
    () => (window as unknown as Record<string, boolean>)['__paddleCheckoutOpened'] === true,
    { timeout },
  );
  return page.evaluate(
    () => (window as unknown as Record<string, unknown>)['__paddleCheckoutOpts'],
  );
}

/** Assert checkout was NOT triggered. */
export async function assertCheckoutNotOpened(page: Page) {
  const opened = await page.evaluate(
    () => (window as unknown as Record<string, boolean>)['__paddleCheckoutOpened'],
  );
  if (opened) throw new Error('Paddle Checkout.open() was called unexpectedly');
}
