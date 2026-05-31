import type { Metadata } from 'next';

// api-docs 페이지는 'use client' 컴포넌트이므로 metadata를 여기서 내보냄.
// ?endpoint=N 쿼리 변형 URL들이 모두 동일한 canonical을 가리키도록 설정.
export const metadata: Metadata = {
  title: 'API Reference | K-MarketInsight',
  description:
    'Full REST API reference for K-MarketInsight — Korean corporate event signals, sector momentum, and market radar endpoints. Includes code examples in Python, TypeScript, and curl.',
  alternates: {
    canonical: 'https://k-marketinsight.com/api-docs',
  },
  openGraph: {
    title: 'API Reference | K-MarketInsight',
    description:
      'REST API for Korean DART-based corporate event signals. Events, sector signals, market radar, and company profiles.',
    url: 'https://k-marketinsight.com/api-docs',
    siteName: 'K-MarketInsight',
    locale: 'en_US',
    type: 'website',
  },
};

export default function ApiDocsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
