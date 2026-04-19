import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // trailingSlash 제거: canonical URL(슬래시 없음)과 실제 URL이 일치해야 Google 색인 가능
  reactCompiler: true,
  experimental: {
    turbopackUseSystemTlsCerts: true,
  },

  async headers() {
    const ContentSecurityPolicy = [
      "default-src 'self'",
      // Next.js App Router needs unsafe-eval + unsafe-inline for hydration scripts
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.paddle.com https://sandbox-cdn.paddle.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.paddle.com https://sandbox-api.paddle.com",
      "frame-src 'self' https://cdn.paddle.com https://sandbox-cdn.paddle.com https://buy.paddle.com https://checkout.paddle.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Content-Security-Policy",
            value: ContentSecurityPolicy,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
