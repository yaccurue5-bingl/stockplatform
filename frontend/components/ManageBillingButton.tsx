'use client';

import { useState } from 'react';
import { ExternalLink } from 'lucide-react';

/**
 * Paddle Customer Portal 로 이동하는 버튼.
 * 클릭 → /api/subscription/portal 호출 → 1회용 URL → 새 탭
 */
export default function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClick = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/subscription/portal', { method: 'POST' });
      const json = await res.json();

      if (!res.ok || !json.url) {
        setError(json.error || 'Failed to open billing portal');
        return;
      }

      // 새 탭으로 Paddle Customer Portal 열기
      window.open(json.url, '_blank', 'noopener,noreferrer');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-700 hover:border-gray-500 text-sm text-gray-300 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Opening...
          </>
        ) : (
          <>
            Manage Billing
            <ExternalLink size={13} />
          </>
        )}
      </button>
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
