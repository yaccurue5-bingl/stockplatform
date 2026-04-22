import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 샘플링: 개발 100%, 프로덕션 10% (트래픽 증가 시 조정)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // 개발 환경에서는 콘솔 출력으로 확인
  debug: process.env.NODE_ENV === 'development',

  // 불필요한 네트워크 에러 필터링
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    /^Network Error$/,
    /^Failed to fetch$/,
    /^Load failed$/,
  ],
});
