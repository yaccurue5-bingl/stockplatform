/**
 * Sentry Server-Side Configuration (Node.js runtime)
 * - API Route 에러 캡처 + 성능 트레이싱
 * - PII 스크러빙: Authorization, Cookie, x-api-key 제거
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
    // 요청 헤더에서 인증/세션 정보 제거
    if (event.request?.headers) {
      const h = { ...event.request.headers };
      for (const k of [
        'authorization', 'cookie', 'set-cookie',
        'x-api-key', 'x-service-role', 'x-supabase-auth',
      ]) {
        delete h[k];
        delete h[k.toUpperCase()];
      }
      event.request.headers = h;
    }
    // URL 쿼리스트링 민감 파라미터 마스킹
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
