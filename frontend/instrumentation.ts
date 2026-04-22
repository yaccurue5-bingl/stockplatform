/**
 * Next.js Instrumentation Hook
 *
 * Next.js 15+ 에서 stable — next.config.ts에 별도 설정 불필요.
 * Node.js 런타임에서만 New Relic을 로드 (Edge runtime 제외).
 *
 * 실행 시점: 서버 부팅 시 1회 (콜드 스타트)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // NEW_RELIC_LICENSE_KEY 미설정 시 에이전트 로드 스킵
    if (!process.env.NEW_RELIC_LICENSE_KEY) {
      console.warn('[newrelic] NEW_RELIC_LICENSE_KEY not set — skipping agent init');
      return;
    }
    await import('newrelic');
  }
}
