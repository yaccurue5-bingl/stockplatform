'use client';

import { useEffect, useState } from 'react';

interface ShortData {
  loan_change_pct:    number | null;
  loan_shares:        number | null;
  listed_shares:      number | null;
  short_interest_pct: number | null;
  current_date?:      string;
  prev_date?:         string;
}

// 3D 변화율 시그널
function get3DSignal(change: number | null) {
  if (change === null) return { label: 'No Data',        color: 'gray'    };
  if (change >= 20)    return { label: 'Strong Increase', color: 'red'     };
  if (change >= 10)    return { label: 'Increasing',      color: 'orange'  };
  if (change <= -20)   return { label: 'Strong Decrease', color: 'emerald' };
  if (change <= -10)   return { label: 'Decreasing',      color: 'emerald' };
  return                      { label: 'Stable',          color: 'gray'    };
}

// Short Interest % 레벨
function getSIPct(pct: number | null) {
  if (pct === null) return { level: 'N/A',   color: 'gray'    };
  if (pct >= 10)   return { level: 'High',   color: 'red'     };
  if (pct >= 5)    return { level: 'Medium', color: 'orange'  };
  if (pct >= 2)    return { level: 'Low',    color: 'gray'    };
  return                  { level: 'Minimal', color: 'emerald' };
}

function formatShares(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B shares`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)}M shares`;
  if (n >= 1_000)         return `${(n / 1_000).toFixed(1)}K shares`;
  return `${n.toLocaleString()} shares`;
}

export default function ShortPressure({ stockCode }: { stockCode: string }) {
  const [data, setData]       = useState<ShortData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!stockCode) { setLoading(false); return; }

    fetch(`/api/short/${stockCode}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [stockCode]);

  if (loading || !data || data.loan_change_pct === null) return null;

  const signal3D = get3DSignal(data.loan_change_pct);
  const siSignal = getSIPct(data.short_interest_pct);

  const color3D =
    signal3D.color === 'red'     ? 'text-red-400'     :
    signal3D.color === 'orange'  ? 'text-orange-400'  :
    signal3D.color === 'emerald' ? 'text-emerald-400' : 'text-gray-400';

  const badge3D =
    signal3D.color === 'red'     ? 'border-red-500/30 bg-red-500/10 text-red-400'          :
    signal3D.color === 'orange'  ? 'border-orange-500/30 bg-orange-500/10 text-orange-400'  :
    signal3D.color === 'emerald' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' :
                                   'border-gray-500/30 bg-gray-500/10 text-gray-400';

  const colorSI =
    siSignal.color === 'red'     ? 'text-red-400'     :
    siSignal.color === 'orange'  ? 'text-orange-400'  :
    siSignal.color === 'emerald' ? 'text-emerald-400' : 'text-gray-400';

  const barWidth3D = Math.min(Math.abs(data.loan_change_pct) / 30 * 100, 100);
  const barColor3D =
    signal3D.color === 'red'     ? 'bg-red-500'     :
    signal3D.color === 'orange'  ? 'bg-orange-500'  :
    signal3D.color === 'emerald' ? 'bg-emerald-500' : 'bg-gray-500';

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-5">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest">
        Short Pressure
      </p>

      {/* ── 1. Short Interest % of float ── */}
      <div className="space-y-2">
        <p className="text-xs text-gray-600 uppercase tracking-wider">Short Interest</p>
        {data.short_interest_pct != null ? (
          <div className="flex items-end justify-between">
            <span className={`text-3xl font-bold tabular-nums ${colorSI}`}>
              {data.short_interest_pct.toFixed(2)}%
            </span>
            <span className={`text-xs font-semibold pb-1 ${colorSI}`}>
              of float · {siSignal.level}
            </span>
          </div>
        ) : (
          <span className="text-sm text-gray-600">No float data</span>
        )}
      </div>

      <div className="border-t border-gray-800/60" />

      {/* ── 2. Short Pressure (3D change) ── */}
      <div className="space-y-3">
        <p className="text-xs text-gray-600 uppercase tracking-wider">Loan Balance Change (3D)</p>

        <div className="flex items-center justify-between">
          <span className={`text-2xl font-bold tabular-nums ${color3D}`}>
            {data.loan_change_pct > 0 ? '+' : ''}{data.loan_change_pct.toFixed(1)}%
          </span>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${badge3D}`}>
            {signal3D.label}
          </span>
        </div>

        <div className="space-y-1">
          <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barColor3D}`}
              style={{ width: `${barWidth3D}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-700">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      </div>

      {/* ── 3. 참고: 차입주식수 ── */}
      {data.loan_shares != null && (
        <div className="text-xs text-gray-600 pt-1 border-t border-gray-800/60">
          {formatShares(data.loan_shares)} on loan
        </div>
      )}
    </div>
  );
}
