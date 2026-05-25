'use client';

import { useEffect, useState } from 'react';

interface EventStats {
  event: string;
  score: number | null;
  grade: string | null;
  data_coverage: number | null;
  historical_avg_return_5d: number | null;
  sample_size: number | null;
  risk_adj_factor: number | null;
  std_5d: number | null;
}

interface Props {
  eventType: string; // e.g. 'BUYBACK'
}

const GRADE_COLOR: Record<string, string> = {
  A: 'text-green-400',
  B: 'text-blue-400',
  C: 'text-yellow-400',
  D: 'text-orange-400',
  F: 'text-red-400',
};

export default function WinRateCard({ eventType }: Props) {
  const [stats, setStats] = useState<EventStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventType) { setLoading(false); return; }
    fetch(`/api/event-score/${eventType}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setStats(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventType]);

  if (loading) return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse">
      <div className="h-4 bg-gray-800 rounded w-1/2 mb-3" />
      <div className="h-12 bg-gray-800 rounded" />
    </div>
  );

  if (!stats) return null;

  const avg5d = stats.historical_avg_return_5d ?? 0;
  const grade = stats.grade ?? 'C';
  const score = stats.score ?? 0;
  // score를 0~100으로 정규화 (score는 이미 0~100)
  const barWidth = Math.min(100, Math.max(0, score));

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold">{eventType} Signal Stats</h3>
        <span className={`text-xl font-black ${GRADE_COLOR[grade] ?? 'text-gray-400'}`}>
          {grade}
        </span>
      </div>

      {/* Signal Score 바 */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Signal Score</span>
          <span className="font-bold text-white">{score}</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              score >= 70 ? 'bg-green-500' : score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>

      {/* 수익률 지표 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-gray-800/60 rounded-lg px-3 py-2.5">
          <p className="text-xs text-gray-500 mb-0.5">Avg 5d Return</p>
          <p className={`text-sm font-bold ${avg5d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {avg5d >= 0 ? '+' : ''}{avg5d.toFixed(2)}%
          </p>
        </div>
        <div className="bg-gray-800/60 rounded-lg px-3 py-2.5">
          <p className="text-xs text-gray-500 mb-0.5">Sample Size</p>
          <p className="text-sm font-bold text-white">{stats.sample_size ?? '-'}</p>
        </div>
      </div>

      <p className="text-xs text-gray-700 mt-3">
        Historical backtest · Not investment advice
      </p>
    </div>
  );
}
