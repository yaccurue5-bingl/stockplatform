'use client';

import { useEffect, useState } from 'react';

interface ShortData {
  loan_change_pct:  number | null;
  current_balance:  number | null;
  current_date?:    string;
  prev_date?:       string;
}

function getSignal(change: number | null) {
  if (change === null) return { label: 'No Data', color: 'gray' };
  if (change >= 20)    return { label: 'Strong Increase', color: 'red' };
  if (change >= 10)    return { label: 'Increasing',      color: 'orange' };
  if (change <= -20)   return { label: 'Strong Decrease', color: 'emerald' };
  if (change <= -10)   return { label: 'Decreasing',      color: 'emerald' };
  return                      { label: 'Stable',          color: 'gray' };
}

function formatBalance(n: number | null): string {
  if (n == null) return '—';
  if (n >= 1_000_000_000_000) return `₩${(n / 1_000_000_000_000).toFixed(1)}T`;
  if (n >= 1_000_000_000)     return `₩${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000)         return `₩${(n / 1_000_000).toFixed(0)}M`;
  return `₩${n.toLocaleString()}`;
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

  // 데이터 없으면 섹션 숨김
  if (loading || !data || data.loan_change_pct === null) return null;

  const signal = getSignal(data.loan_change_pct);
  const value  = data.loan_change_pct;

  const textColor =
    signal.color === 'red'     ? 'text-red-400'     :
    signal.color === 'orange'  ? 'text-orange-400'  :
    signal.color === 'emerald' ? 'text-emerald-400' : 'text-gray-400';

  const badgeStyle =
    signal.color === 'red'
      ? 'border-red-500/30 bg-red-500/10 text-red-400'
      : signal.color === 'orange'
      ? 'border-orange-500/30 bg-orange-500/10 text-orange-400'
      : signal.color === 'emerald'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
      : 'border-gray-500/30 bg-gray-500/10 text-gray-400';

  // 바 너비: ±30% 이상이면 100%
  const barWidth = Math.min(Math.abs(value) / 30 * 100, 100);
  const barColor =
    signal.color === 'red'     ? 'bg-red-500'     :
    signal.color === 'orange'  ? 'bg-orange-500'  :
    signal.color === 'emerald' ? 'bg-emerald-500' : 'bg-gray-500';

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest">
        Short Pressure
      </p>

      {/* 변화율 + 레이블 */}
      <div className="flex items-center justify-between">
        <span className={`text-3xl font-bold tabular-nums ${textColor}`}>
          {value > 0 ? '+' : ''}{value.toFixed(1)}%
        </span>
        <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${badgeStyle}`}>
          {signal.label}
        </span>
      </div>

      {/* 강도 바 */}
      <div className="space-y-1.5">
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-600">
          <span>Low Pressure</span>
          <span>High Pressure</span>
        </div>
      </div>

      {/* 메타 정보 */}
      <div className="flex items-center gap-3 text-xs pt-1 border-t border-gray-800">
        <span className="text-gray-500">
          Balance: <span className="font-medium text-gray-400">{formatBalance(data.current_balance)}</span>
        </span>
        <span className="text-gray-700">·</span>
        <span className="text-gray-500">3-day change</span>
      </div>
    </div>
  );
}
