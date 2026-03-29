// app/layout.tsx
import { baseMetadata } from "./layout.metadata";
import ClientLayout from "./client-layout";
import "./globals.css";

// 서버 컴포넌트에서 메타데이터를 내보내어 SEO 최적화
export const metadata = baseMetadata;

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "K-MarketInsight API",
  "applicationCategory": "FinanceApplication",
  "description": "Event-driven Korean market data API based on DART filings. Detect earnings surprises, dilution events, and major contracts before the market reacts.",
  "operatingSystem": "Web",
  "url": "https://k-marketinsight.com",
  "offers": {
    "@type": "Offer",
    "price": "49",
    "priceCurrency": "USD",
  },
  "provider": {
    "@type": "Organization",
    "name": "K-MarketInsight",
    "url": "https://k-marketinsight.com",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-sans antialiased">
        {/* 클라이언트 로직(세션 타이머 등)은 별도 컴포넌트로 분리 */}
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}