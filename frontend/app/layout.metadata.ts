// app/layout.metadata.ts
import type { Metadata } from "next";

const SITE_URL = "https://k-marketinsight.com";

export const baseMetadata: Metadata = {
  title: {
    default: "Korean Event-Driven Market Data API | K-MarketInsight",
    template: "%s | K-MarketInsight"
  },
  description: "Real-time Korean corporate event signals derived from DART filings. Detect earnings surprises, dilution events, and major contracts before the market reacts.",
  keywords: [
    "korean event driven investing",
    "dart filings analysis api",
    "korean stock signals",
    "dilution signal api",
    "earnings surprise korea",
    "KOSPI data API",
    "KOSDAQ API",
    "Korean financial data API",
    "Korean corporate events API",
    "quant data Korea",
  ],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: "Korean Event-Driven Market Data API | K-MarketInsight",
    description: "Real-time Korean corporate event signals derived from DART filings. Detect earnings surprises, dilution events, and major contracts before the market reacts.",
    url: SITE_URL,
    siteName: "K-MarketInsight",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Korean Event-Driven Market Data API | K-MarketInsight",
    description: "Real-time Korean corporate event signals derived from DART filings.",
  },
  // ⚠️ canonical은 루트에서 설정하지 않음 — 각 페이지가 자체 canonical을 정의해야 함
  // 루트에 설정하면 모든 하위 페이지가 SITE_URL을 canonical로 상속받는 버그 발생
};