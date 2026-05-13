import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    turbopackUseSystemTlsCerts: true,
  },

  async redirects() {
    return [
      // www → non-www 301 영구 리다이렉트
      // Google이 www.k-marketinsight.com을 크롤링하여 중복 URL 문제 발생
      // → 모든 www 요청을 non-www로 강제 통합
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.k-marketinsight.com' }],
        destination: 'https://k-marketinsight.com/:path*',
        permanent: true, // 301
      },
      // /pricing 페이지 삭제 → 영구 301 리다이렉트
      {
        source: '/pricing',
        destination: '/',
        permanent: true, // 301
      },
    ];
  },

  async headers() {
    const ContentSecurityPolicy = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.paddle.com https://sandbox-cdn.paddle.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      // Sentry tunnel route (/monitoring): 'self' 커버. 서버→Sentry 직접 연결용 도메인도 유지.
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.paddle.com https://sandbox-api.paddle.com https://*.sentry.io",
      "frame-src 'self' https://cdn.paddle.com https://sandbox-cdn.paddle.com https://buy.paddle.com https://checkout.paddle.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options",  value: "nosniff" },
          { key: "X-Frame-Options",         value: "DENY" },
          { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",      value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-DNS-Prefetch-Control",  value: "on" },
          { key: "Content-Security-Policy", value: ContentSecurityPolicy },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // ── 프로젝트 식별 ────────────────────────────────────────────────────────────
  org: 'k-marketinsight',
  project: 'javascript-nextjs',
  // authToken: Vercel 환경변수 SENTRY_AUTH_TOKEN 에서 자동 읽힘 (빌드 타임 소스맵 업로드)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // ── Tunnel Route ─────────────────────────────────────────────────────────────
  // 광고 차단기를 우회해 Sentry 이벤트를 정확하게 수집.
  // 클라이언트 → /monitoring → (서버) → sentry.io 로 중계.
  // proxy.ts의 prefixPublicPaths에도 '/monitoring' 추가 필요.
  tunnelRoute: '/monitoring',

  // ── 소스맵 ───────────────────────────────────────────────────────────────────
  // 번들에는 미포함, 빌드 후 Sentry 업로드 후 즉시 삭제 → 스택 트레이스 가독성
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  sourcemaps: {
    disable: false,
    deleteSourcemapsAfterUpload: true,
  },

  // ── Vercel 통합 ──────────────────────────────────────────────────────────────
  // Vercel Cron / Deployment 자동 모니터링 생성
  automaticVercelMonitors: true,
});
