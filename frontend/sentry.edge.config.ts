/**
 * Sentry Edge Runtime Configuration
 * - proxy.ts (미들웨어) 에러 캡처
 * - PII 스크러빙
 * - Production only
 */
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // ── 활성화 조건 ─────────────────────────────────────────────────────────────
  enabled: process.env.NODE_ENV === 'production',

  // ── 성능 트레이싱 ────────────────────────────────────────────────────────────
  tracesSampleRate: 0.1,

  // ── PII 보호 ─────────────────────────────────────────────────────────────────
  sendDefaultPii: false,

  beforeSend(event) {
    if (event.request?.headers) {
      const h = { ...event.request.headers };
      for (const k of ['authorization', 'cookie', 'set-cookie', 'x-api-key']) {
        delete h[k];
        delete h[k.toUpperCase()];
      }
      event.request.headers = h;
    }
    if (event.request?.url) {
      event.request.url = event.request.url.replace(
        /([?&](token|key|password|secret|auth|api_key|access_token|refresh_token)=)[^&#]*/gi,
        '$1[REDACTED]',
      );
    }
    return event;
  },

  debug: false,
});
