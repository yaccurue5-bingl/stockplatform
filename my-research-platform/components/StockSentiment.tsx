'use client';

interface Props {
  sentiment?: string;
  sentiment_score?: number;
  ai_summary?: string;
}

export default function StockSentiment({ sentiment, sentiment_score, ai_summary }: Props) {
  const summaryLines = typeof ai_summary === 'string' 
    ? ai_summary.split('\n').filter(l => l.trim()) 
    : [];

  // 0% Confidence 대신 임팩트 강도(Impact Strength)로 용어 변경
  const score = typeof sentiment_score === 'number' ? Math.abs(sentiment_score * 100).toFixed(0) : null;

  return (
    <div className="space-y-8 w-full animate-in fade-in duration-1000">
      {/* Sentiment Badge & Impact Score */}
      <div className="flex items-center gap-6">
        <div className={`px-5 py-2.5 rounded-xl font-bold text-xs text-white tracking-tight ${
          sentiment?.toUpperCase() === 'POSITIVE' ? 'bg-emerald-600' : 
          sentiment?.toUpperCase() === 'NEGATIVE' ? 'bg-rose-600' : 'bg-slate-700'
        }`}>
          AI SENTIMENT: {sentiment || 'ANALYZING...'}
        </div>
        
        {score !== null && (
          <div className="flex flex-col border-l border-slate-200 pl-6">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Analysis Impact</span>
            {/* 0일 때는 Neutral, 값이 있을 때는 수치 표시 */}
            <span className="text-sm font-bold text-slate-900">
              {score === '0' ? 'Neutral Stability' : `${score}% Strength`}
            </span>
          </div>
        )}
      </div>

      {/* AI Insight Summary Card (뿌연 효과 제거 및 고대비 적용) */}
      <div className="bg-[#F8FAFC] border border-slate-200 rounded-3xl p-8 shadow-sm relative overflow-hidden">
        {/* 장식용 은은한 포인트만 남김 */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-3xl rounded-full"></div>
        
        <p className="text-[11px] font-bold text-blue-600 uppercase tracking-[0.15em] mb-6 flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>
          AI Research Insight
        </p>
        
        <ul className="space-y-5 relative z-10">
          {summaryLines.length > 0 ? (
            summaryLines.map((line, i) => (
              <li key={i} className="text-[15px] md:text-base text-slate-800 leading-relaxed flex gap-4">
                <span className="text-blue-600 font-bold mt-1">✦</span>
                <span className="flex-1 font-medium">{line.replace(/^[*-]\s*/, '')}</span>
              </li>
            ))
          ) : (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-400 italic">
                Generating professional AI insights...
              </p>
            </div>
          )}
        </ul>
      </div>
    </div>
  );
}