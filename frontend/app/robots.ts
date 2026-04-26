import { MetadataRoute } from 'next';

const SITE_URL = 'https://k-marketinsight.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',             // API routes — data endpoints, not for indexing
          '/auth/',            // Auth callbacks
          '/dashboard',        // Protected — requires login
          '/stock/',           // Pro plan pages — protected
          '/login',
          '/signup',
          '/forgot-password',
          '/sentry-example-page',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
