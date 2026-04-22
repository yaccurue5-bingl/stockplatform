/**
 * Next.js Instrumentation Hook (Next.js 15+ stable)
 *
 * config 파일 경로에 의존하지 않고 환경변수로만 설정.
 * Vercel 서버리스 환경에서 가장 안정적인 방식.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (!process.env.NEW_RELIC_LICENSE_KEY) {
      console.warn('[newrelic] NEW_RELIC_LICENSE_KEY not set — skipping');
      return;
    }

    // config 파일 없이 env var만으로 에이전트 구성
    process.env.NEW_RELIC_APP_NAME                   ??= 'k-marketinsight';
    process.env.NEW_RELIC_NO_CONFIG_FILE             ??= 'true';
    process.env.NEW_RELIC_DISTRIBUTED_TRACING_ENABLED ??= 'true';
    process.env.NEW_RELIC_LOG_LEVEL                  ??= 'info';
    process.env.NEW_RELIC_ALLOW_ALL_HEADERS          ??= 'true';
    process.env.NEW_RELIC_APPLICATION_LOGGING_FORWARDING_ENABLED ??= 'true';

    // Vercel 서버리스 모드 자동 감지
    if (process.env.VERCEL) {
      process.env.NEW_RELIC_SERVERLESS_MODE_ENABLED ??= 'true';
    }

    await import('newrelic');
    console.log('[newrelic] agent started — app: k-marketinsight');
  }
}
