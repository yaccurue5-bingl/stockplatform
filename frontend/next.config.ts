import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    turbopackUseSystemTlsCerts: true,
  },

  async headers() {
    const ContentSecurityPolicy = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.paddle.com https://sandbox-cdn.paddle.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      // Sentry: 에러 리포트 전송 허용
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
  org:     process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // 소스맵: 프로덕션에서 에러 원문 추적 (번들에는 포함 안 됨)
  silent:               !process.env.CI,
  widenClientFileUpload: true,
  disableLogger:         true,
  automaticVercelMonitors: true,
  sourcemaps: {
    disable: false,      // 소스맵 업로드 활성화 (번들에는 미포함)
    deleteSourcemapsAfterUpload: true,
  },
});
