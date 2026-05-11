/**
 * helpers/api.ts
 * Utilities for validating Next.js API routes and the REST v1 backend.
 */

import { APIRequestContext, expect } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

/** Make an authenticated request to the internal Next.js API. */
export async function callNextApi(
  ctx:    APIRequestContext,
  path:   string,
  apiKey?: string,
) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) headers['X-API-Key'] = apiKey;

  const res = await ctx.get(`${BASE}${path}`, { headers });
  return res;
}

/** Assert standard JSON API response shape. */
export async function assertJsonOk(
  response: Awaited<ReturnType<APIRequestContext['get']>>,
) {
  expect(response.status(), `Expected 200, got ${response.status()} for ${response.url()}`).toBe(200);
  const ct = response.headers()['content-type'] ?? '';
  expect(ct).toContain('application/json');
  return response.json();
}

/** Assert 401 / 403 unauthorized response (pass the already-fetched response). */
export async function assertUnauthorized(
  response: Awaited<ReturnType<APIRequestContext['get']>>,
) {
  expect(
    [401, 403],
    `Expected 401/403 unauthorized, got ${response.status()} for ${response.url()}`,
  ).toContain(response.status());
}

/** Assert 403 forbidden response (pass the already-fetched response). */
export async function assertForbidden(
  response: Awaited<ReturnType<APIRequestContext['get']>>,
) {
  expect(
    response.status(),
    `Expected 403 forbidden, got ${response.status()} for ${response.url()}`,
  ).toBe(403);
}

/** Basic schema validator — checks required top-level keys exist. */
export function assertHasKeys<T extends Record<string, unknown>>(
  body: T,
  keys: (keyof T)[],
) {
  for (const key of keys) {
    expect(body, `Missing key: ${String(key)}`).toHaveProperty(String(key));
  }
}
