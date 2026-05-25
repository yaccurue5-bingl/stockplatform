'use client';

import { useMemo } from 'react';
import { getMarketStatus } from '@/lib/koreanMarket';

export default function MarketStatusBadge() {
  const status = useMemo(() => getMarketStatus(new Date()), []);

  if (!status.closed) return null;

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg
                    bg-amber-500/10 border border-amber-500/25 text-amber-400
                    text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
      <span>
        Market Closed
        <span className="text-amber-500/80 font-normal"> · {status.reason}</span>
        <span className="text-amber-500/60 font-normal"> · Next session: {status.next}</span>
      </span>
    </div>
  );
}
