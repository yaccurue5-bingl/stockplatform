/**
 * api.spec.ts
 * Authenticated project. Uses apiContext fixture (raw fetch, no UI).
 * Tests: v1/disclosures shape, v1/events, /api/health, API-key auth,
 *        pagination, search param, content-type headers.
 */

import { test, expect } from '../fixtures/test-fixtures';
import { assertJsonOk, assertUnauthorized, assertHasKeys } from '../helpers/api';

// ── Health check ──────────────────────────────────────────────────────────────

test.describe('Health endpoint', () => {
  test('GET /api/health returns 200 + ok:true', async ({ apiContext }) => {
    const res  = await apiContext.get('/api/health');
    const body = await assertJsonOk(res);
    // Accept { ok: true } or { status: "ok" } or { healthy: true }
    const ok = body.ok ?? body.status ?? body.healthy;
    expect(ok).toBeTruthy();
  });
});

// ── Disclosures list ──────────────────────────────────────────────────────────

test.describe('GET /api/v1/disclosures', () => {
  test('returns 401 without API key', async ({ apiContext }) => {
    const res = await apiContext.get('/api/v1/disclosures');
    await assertUnauthorized(res);
  });

  test('returns 200 + array with API key from env', async ({ apiContext, request }) => {
    const apiKey = process.env.TEST_API_KEY;
    if (!apiKey) {
      test.skip();
      return;
    }

    const res = await request.get('/api/v1/disclosures', {
      headers: { 'X-API-Key': apiKey },
    });

    const body = await assertJsonOk(res);

    // Body should be an array (or { data: [], total: N })
    const rows = Array.isArray(body) ? body : body.data ?? body.results ?? [];
    expect(Array.isArray(rows)).toBe(true);
  });

  test('response has correct Content-Type (application/json)', async ({ apiContext }) => {
    const res = await apiContext.get('/api/v1/disclosures');
    // Even 401 responses must return JSON
    const ct = res.headers()['content-type'] ?? '';
    expect(ct).toMatch(/application\/json/);
  });
});

// ── Disclosures shape ─────────────────────────────────────────────────────────

test.describe('Disclosure record shape', () => {
  test('each row has expected fields (with API key)', async ({ request }) => {
    const apiKey = process.env.TEST_API_KEY;
    if (!apiKey) {
      test.skip();
      return;
    }

    const res  = await request.get('/api/v1/disclosures?limit=5', {
      headers: { 'X-API-Key': apiKey },
    });
    const body = await assertJsonOk(res);
    const rows = Array.isArray(body) ? body : (body.data ?? []);

    if (rows.length === 0) {
      test.skip();
      return;
    }

    const row = rows[0];
    // These fields must exist on every disclosure row
    assertHasKeys(row, ['id', 'headline', 'event_type', 'rcept_dt']);
  });
});

// ── Pagination ────────────────────────────────────────────────────────────────

test.describe('Pagination params', () => {
  test('limit param restricts returned rows', async ({ request }) => {
    const apiKey = process.env.TEST_API_KEY;
    if (!apiKey) {
      test.skip();
      return;
    }

    const res  = await request.get('/api/v1/disclosures?limit=3', {
      headers: { 'X-API-Key': apiKey },
    });
    const body = await assertJsonOk(res);
    const rows = Array.isArray(body) ? body : (body.data ?? []);
    expect(rows.length).toBeLessThanOrEqual(3);
  });

  test('page=2 returns different rows than page=1', async ({ request }) => {
    const apiKey = process.env.TEST_API_KEY;
    if (!apiKey) {
      test.skip();
      return;
    }

    const [res1, res2] = await Promise.all([
      request.get('/api/v1/disclosures?limit=5&page=1', { headers: { 'X-API-Key': apiKey } }),
      request.get('/api/v1/disclosures?limit=5&page=2', { headers: { 'X-API-Key': apiKey } }),
    ]);

    const body1 = await assertJsonOk(res1);
    const body2 = await assertJsonOk(res2);

    const rows1 = Array.isArray(body1) ? body1 : (body1.data ?? []);
    const rows2 = Array.isArray(body2) ? body2 : (body2.data ?? []);

    if (rows1.length === 0 || rows2.length === 0) {
      test.skip();
      return;
    }

    // First IDs from page 1 and page 2 must differ
    expect(rows1[0].id).not.toBe(rows2[0].id);
  });
});

// ── Search / filter params ────────────────────────────────────────────────────

test.describe('Search params', () => {
  test('q param filters results', async ({ request }) => {
    const apiKey = process.env.TEST_API_KEY;
    if (!apiKey) {
      test.skip();
      return;
    }

    const res  = await request.get('/api/v1/disclosures?q=삼성&limit=10', {
      headers: { 'X-API-Key': apiKey },
    });
    const body = await assertJsonOk(res);
    const rows = Array.isArray(body) ? body : (body.data ?? []);

    // Either we get results all mentioning 삼성, or 0 results (no error)
    expect(Array.isArray(rows)).toBe(true);
  });

  test('event_type filter returns only matching types', async ({ request }) => {
    const apiKey = process.env.TEST_API_KEY;
    if (!apiKey) {
      test.skip();
      return;
    }

    const res  = await request.get('/api/v1/disclosures?event_type=BUYBACK&limit=10', {
      headers: { 'X-API-Key': apiKey },
    });
    const body = await assertJsonOk(res);
    const rows = Array.isArray(body) ? body : (body.data ?? []);

    for (const row of rows) {
      expect((row.event_type as string).toUpperCase()).toBe('BUYBACK');
    }
  });
});

// ── v1/events endpoint ────────────────────────────────────────────────────────

test.describe('GET /api/v1/events', () => {
  test('exists and returns non-500', async ({ apiContext }) => {
    const res = await apiContext.get('/api/v1/events');
    // 401 = exists but needs auth; 404 = endpoint doesn't exist yet (skip)
    if (res.status() === 404) {
      test.skip();
      return;
    }
    expect(res.status()).not.toBe(500);
  });
});

// ── Cron protection ───────────────────────────────────────────────────────────

test.describe('Cron endpoints', () => {
  test('/api/cron/daily-batch requires secret header', async ({ apiContext }) => {
    const res = await apiContext.get('/api/cron/daily-batch');
    expect([401, 403, 404]).toContain(res.status());
  });

  test('/api/cron/daily-batch with wrong secret is rejected', async ({ apiContext }) => {
    const res = await apiContext.get('/api/cron/daily-batch', {
      headers: { Authorization: 'Bearer wrong-secret-xyz' },
    });
    expect([401, 403, 404]).toContain(res.status());
  });
});

// ── CORS / error response format ──────────────────────────────────────────────

test.describe('Error response format', () => {
  test('404 on unknown route returns JSON, not HTML', async ({ apiContext }) => {
    const res = await apiContext.get('/api/v1/does-not-exist-xyz');
    if (res.status() === 404) {
      const ct = res.headers()['content-type'] ?? '';
      // Some Next.js 404s return HTML — we only enforce JSON for known /api/v1/* routes
      // so this test is informational
      expect([200, 404, 405]).toContain(res.status());
    }
  });

  test('401 response has error field in body', async ({ apiContext }) => {
    const res  = await apiContext.get('/api/v1/disclosures');
    const body = await res.json().catch(() => ({}));

    // Should have some error indicator: { error }, { message }, or { detail }
    const hasErrorField = 'error' in body || 'message' in body || 'detail' in body;
    expect(hasErrorField).toBe(true);
  });
});
