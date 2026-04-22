/**
 * Next.js Instrumentation Hook (Next.js 15+ stable)
 * - Sentry: 서버/엣지 에러 캡처
 * - New Relic: 연결 시도 (Vercel 서버리스에서는 제한적)
 */
import * as Sentry from '@sentry/nextjs';

export async function register() {
  // ── Sentry ──────────────────────────────────────────────
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }

  // ── New Relic (Node.js only, Vercel 서버리스 제한 있음) ──
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.NEW_RELIC_LICENSE_KEY) {
    process.env.NEW_RELIC_APP_NAME                            ??= 'k-marketinsight';
    process.env.NEW_RELIC_NO_CONFIG_FILE                      ??= 'true';
    process.env.NEW_RELIC_DISTRIBUTED_TRACING_ENABLED         ??= 'true';
    process.env.NEW_RELIC_LOG_LEVEL                           ??= 'info';
    process.env.NEW_RELIC_APPLICATION_LOGGING_FORWARDING_ENABLED ??= 'true';
    if (process.env.VERCEL) {
      process.env.NEW_RELIC_SERVERLESS_MODE_ENABLED ??= 'true';
    }
    await import('newrelic');
  }
}

export const onRequestError = Sentry.captureRequestError;
