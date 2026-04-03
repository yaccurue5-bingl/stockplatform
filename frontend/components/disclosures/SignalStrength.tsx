'use client';

interface SignalStrengthProps {
  sentimentScore: number;
  importance: string;
}

export default function SignalStrength({ sentimentScore, importance }: SignalStrengthProps) {
  // 방향: +0.3 이상 BULLISH, -0.3 이하 BEARISH, 그 사이 NEUTRAL
  const direction =
    sentimentScore >= 0.3 ? 'BULLISH' :
    sentimentScore <= -0.3 ? 'BEARISH' : 'NEUTRAL';

  // 강도: abs(score) × 중요도 가중치, 0~100 스케일
  const importanceMult =
    importance === 'HIGH' ? 1.2 :
    importance === 'LOW'  ? 0.7 : 1.0;
  const strengthPct = Math.min(
    Math.round(Math.abs(sentimentScore) * importanceMult * 100),
    100,
  );

  // 레이블
  const label =
    strengthPct >= 70
      ? direction === 'BULLISH' ? 'Strong Buy'
      : direction === 'BEARISH' ? 'Strong Sell'
      : 'Neutral'
    : strengthPct >= 40
      ? direction === 'BULLISH' ? 'Buy'
      : direction === 'BEARISH' ? 'Sell'
      : 'Neutral'
    : 'Neutral';

  const textColor =
    direction === 'BULLISH' ? 'text-emerald-400' :
    direction === 'BEARISH' ? 'text-red-400' : 'text-gray-400';

  const badgeStyle =
    direction === 'BULLISH'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
      : direction === 'BEARISH'
      ? 'border-red-500/30 bg-red-500/10 text-red-400'
      : 'border-gray-500/30 bg-gray-500/10 text-gray-400';

  const barColor =
    direction === 'BULLISH' ? 'bg-emerald-500' :
    direction === 'BEARISH' ? 'bg-red-500' : 'bg-gray-500';

  const importanceColor =
    importance === 'HIGH'   ? 'text-orange-400' :
    importance === 'LOW'    ? 'text-gray-500'   : 'text-blue-400';

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
      <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest">
        Signal Strength
      </p>

      {/* 점수 + 레이블 */}
      <div className="flex items-center justify-between">
        <span className={`text-3xl font-bold tabular-nums ${textColor}`}>
          {strengthPct}
        </span>
        <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${badgeStyle}`}>
          {label}
        </span>
      </div>

      {/* 강도 바 */}
      <div className="space-y-1.5">
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${strengthPct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-600">
          <span>Weak</span>
          <span>Strong</span>
        </div>
      </div>

      {/* 메타 정보 */}
      <div className="flex items-center gap-3 text-xs pt-1 border-t border-gray-800">
        <span className="text-gray-500">
          AI Score:{' '}
          <span className={`font-semibold ${textColor}`}>
            {sentimentScore >= 0 ? '+' : ''}{sentimentScore.toFixed(2)}
          </span>
        </span>
        <span className="text-gray-700">·</span>
        <span className="text-gray-500">
          Impact:{' '}
          <span className={`font-semibold ${importanceColor}`}>{importance}</span>
        </span>
      </div>
    </div>
  );
}
