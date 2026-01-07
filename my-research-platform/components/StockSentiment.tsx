'use client';

interface Props {
  sentiment?: string;
  sentiment_score?: number;
  ai_summary?: string;
}

export default function StockSentiment({ sentiment, sentiment_score, ai_summary }: Props) {
  // 데이터가 없을 때를 대비한 기본값 처리
  const summaryLines = ai_summary ? ai_summary.split('\n').filter(l => l.trim()) : [];
  const displayScore = typeof sentiment_score === 'number' ? (sentiment_score * 100).toFixed(0) : '0';

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold text-gray-600">AI 감성 분석:</span>
        <span className={`px-3 py-1 rounded-full text-xs font-black text-white ${
          sentiment?.toUpperCase() === 'POSITIVE' ? 'bg-green-500' : 
          sentiment?.toUpperCase() === 'NEGATIVE' ? 'bg-rose-500' : 'bg-gray-400'
        }`}>
          {sentiment || 'NEUTRAL'}
        </span>
        <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-2 py-1 rounded">
          Intensity: {displayScore}%
        </span>
      </div>
    </div>
  );
}