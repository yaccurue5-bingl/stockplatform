'use client';

interface Props {
  sentiment?: string;
  sentiment_score?: number;
  ai_summary?: string;
}

export default function StockSentiment({ sentiment, sentiment_score, ai_summary }: Props) {
  const summaryLines = ai_summary ? ai_summary.split('\n').filter(l => l.trim()) : [];
  const score = typeof sentiment_score === 'number' ? (sentiment_score * 100).toFixed(0) : '0';

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-700">
      {/* 감성 점수 배지 */}
      <div className="flex items-center gap-3">
        <div className={`px-4 py-2 rounded-2xl font-black text-xs text-white shadow-lg ${
          sentiment?.toUpperCase() === 'POSITIVE' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 
          sentiment?.toUpperCase() === 'NEGATIVE' ? 'bg-gradient-to-r from-rose-500 to-orange-500' : 'bg-slate-500'
        }`}>
          AI SENTIMENT: {sentiment || 'ANALYZING'}
        </div>
        <span className="text-xs font-bold text-slate-400">Impact Intensity: {score}%</span>
      </div>

      {/* AI 요약 (Groq 결과물) */}
      <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-[2rem] p-6 shadow-inner">
        <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-4">AI Insight Summary</p>
        <ul className="space-y-3">
          {summaryLines.length > 0 ? (
            summaryLines.map((line, i) => (
              <li key={i} className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed flex gap-3">
                <span className="text-blue-500 mt-1">✦</span>
                {line.replace(/^[*-]\s*/, '')}
              </li>
            ))
          ) : (
            <p className="text-sm text-slate-400 italic">가공된 AI 분석 데이터를 불러오는 중입니다...</p>
          )}
        </ul>
      </div>
    </div>
  );
}