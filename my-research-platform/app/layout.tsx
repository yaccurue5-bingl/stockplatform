// app/layout.tsx
import { baseMetadata } from "./layout.metadata";
import ClientLayout from "./client-layout";
import "./globals.css";

// 서버 컴포넌트에서 메타데이터를 내보내어 SEO 최적화
export const metadata = baseMetadata;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">
        {/* 클라이언트 로직(세션 타이머 등)은 별도 컴포넌트로 분리 */}
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}