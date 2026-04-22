/**
 * Next.js Instrumentation Hook (Next.js 15+ stable)
 *
 * - Node.js 런타임에서만 실행 (Edge runtime 제외)
 * - "type": "module" ESM 프로젝트이므로:
 *     newrelic.cjs  → CJS config 파일 (newrelic.js는 ESM으로 인식되어 오류)
 *     NEW_RELIC_CONFIG_FILE 환경변수로 위치 명시
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (!process.env.NEW_RELIC_LICENSE_KEY) {
      console.warn('[newrelic] NEW_RELIC_LICENSE_KEY not set — skipping agent init');
      return;
    }

    // ESM 프로젝트: config 파일을 .cjs로 명시해야 CJS로 로드됨
    process.env.NEW_RELIC_CONFIG_FILE =
      process.env.NEW_RELIC_CONFIG_FILE ?? `${process.cwd()}/newrelic.cjs`;

    await import('newrelic');
    console.log('[newrelic] agent initialized — app: k-marketinsight');
  }
}
