import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "K-MarketInsight - Korean Stock Market Intelligence",
  description: "AI-powered Korean stock market analysis for global investors",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
