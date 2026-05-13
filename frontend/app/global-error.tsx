'use client';

/**
 * global-error.tsx — App Router 전역 에러 경계
 *
 * layout.tsx나 template.tsx에서 던진 에러를 포함,
 * error.tsx로 잡히지 않는 루트 레벨 React 렌더링 에러를 모두 캡처.
 * → Sentry로 자동 리포트 후 최소 UI로 재시도 옵션 제공.
 */
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          background: '#030712',
          color: '#f9fafb',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          margin: 0,
          padding: '2rem',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <p style={{ fontSize: '2rem', margin: '0 0 1rem' }}>⚠️</p>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
            An unexpected error occurred. The team has been automatically notified.
            {error.digest && (
              <span style={{ display: 'block', marginTop: '0.5rem', fontFamily: 'monospace', fontSize: '0.75rem', color: '#4b5563' }}>
                Ref: {error.digest}
              </span>
            )}
          </p>
          <button
            onClick={reset}
            style={{
              background: '#00D4A6',
              color: '#030712',
              border: 'none',
              padding: '0.625rem 1.5rem',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
