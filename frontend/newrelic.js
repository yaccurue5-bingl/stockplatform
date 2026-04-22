'use strict';

/**
 * New Relic agent configuration — k-marketinsight
 *
 * 키 값은 절대 하드코딩하지 않음.
 * NEW_RELIC_LICENSE_KEY 는 .env.local / Vercel Environment Variables 에서만 관리.
 */
exports.config = {
  app_name:    ['k-marketinsight'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY ?? '',

  logging: {
    level: 'info',
  },

  allow_all_headers: true,

  distributed_tracing: {
    enabled: true,
  },

  // Next.js App Router: 서버 컴포넌트 트랜잭션 추적
  application_logging: {
    forwarding: { enabled: true },
    local_decorating: { enabled: false },
    metrics: { enabled: true },
  },

  // Vercel 서버리스 환경 대응
  serverless_mode: {
    enabled: !!process.env.VERCEL,
  },

  attributes: {
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.x-api-key',
    ],
  },
};
