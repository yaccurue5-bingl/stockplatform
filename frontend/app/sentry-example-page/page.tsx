'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect, useState } from 'react';

class SentryExampleFrontendError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SentryExampleFrontendError';
  }
}

export default function Page() {
  const [hasSentError, setHasSentError] = useState(false);
  const [isConnected, setIsConnected]   = useState(true);

  useEffect(() => {
    async function checkConnectivity() {
      const result = await Sentry.diagnoseSdkConnectivity();
      setIsConnected(result !== 'sentry-unreachable');
    }
    checkConnectivity();
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center', gap: 16, padding: 16,
      fontFamily: 'system-ui, sans-serif', background: '#0D1117', color: '#fff' }}>

      <h1 style={{ fontFamily: 'monospace', fontSize: 20 }}>sentry-example-page</h1>

      <p style={{ fontSize: 16, color: '#aaa', textAlign: 'center', maxWidth: 480 }}>
        Click the button to send a test error to{' '}
        <a href="https://k-marketinsight.sentry.io/issues/" target="_blank" rel="noopener"
          style={{ color: '#B3A1FF' }}>
          Sentry Issues
        </a>.
      </p>

      <button
        type="button"
        disabled={!isConnected}
        style={{ padding: '12px 24px', borderRadius: 8, background: '#7553FF',
          color: '#fff', border: 'none', fontSize: 16, fontWeight: 'bold',
          cursor: isConnected ? 'pointer' : 'not-allowed', opacity: isConnected ? 1 : 0.6 }}
        onClick={async () => {
          await Sentry.startSpan({ name: 'Example Frontend/Backend Span', op: 'test' },
            async () => {
              const res = await fetch('/api/sentry-example-api');
              if (!res.ok) setHasSentError(true);
            }
          );
          throw new SentryExampleFrontendError(
            'This error is raised on the frontend of the example page.'
          );
        }}
      >
        Throw Sample Error
      </button>

      {hasSentError && (
        <p style={{ padding: '10px 16px', background: '#00F261', borderRadius: 8,
          color: '#181423', fontWeight: 'bold' }}>
          Error sent to Sentry ✓
        </p>
      )}
      {!isConnected && (
        <p style={{ padding: '10px 16px', background: '#E50045', borderRadius: 8,
          color: '#fff', maxWidth: 480, textAlign: 'center' }}>
          Sentry unreachable — ad-blocker를 비활성화하고 다시 시도하세요.
        </p>
      )}
    </div>
  );
}
