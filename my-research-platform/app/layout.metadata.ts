// app/layout.metadata.ts
import type { Metadata } from "next";

export const baseMetadata: Metadata = {
  title: {
    default: "K-MarketInsight | AI-powered Korean Stock Market Intelligence",
    template: "%s | K-MarketInsight"
  },
  description: "Gain a competitive edge in the Korean stock market with AI-driven analysis, real-time sector insights, and comprehensive financial data for global investors.",
  keywords: ["Korean stock market", "KOSPI", "KOSDAQ", "AI stock analysis", "Korean sector insight", "Global investors"],
  openGraph: {
    title: "K-MarketInsight",
    description: "Professional Korean stock market intelligence for global investors.",
    url: "https://your-domain.com",
    siteName: "K-MarketInsight",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "K-MarketInsight",
    description: "AI-powered Korean stock market analysis",
  },
};