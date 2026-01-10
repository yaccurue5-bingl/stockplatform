'use client';

interface Props {
  sentiment?: string;
  sentiment_score?: number;
  ai_summary?: string;
}

export default function StockSentiment({ sentiment, sentiment_score, ai_summary }: Props) {
  // 1. ai_summary가 문자열이 아닐 경우 빈 리스트로 처리하여 에러 방지
  const summaryLines = typeof ai_summary === 'string' 
    ? ai_summary.split('\n').filter(l => l.trim()) 
    : [];

  // 2. 점수 계산 로직 (Number 타입 체크 강화)
  const score = typeof sentiment_score === 'number' ? (sentiment_score * 100).toFixed(0) : null;

  return (
    <div className="space-y-8 w-full animate-in fade-in duration-1000">
      {/* 감성 점수 배지 */}
      <div className="flex items-center gap-4">
        <div className={`px-6 py-3 rounded-2xl font-black text-xs text-white shadow-xl ${
          sentiment?.toUpperCase() === 'POSITIVE' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/20' : 
          sentiment?.toUpperCase() === 'NEGATIVE' ? 'bg-gradient-to-r from-rose-500 to-orange-500 shadow-rose-500/20' : 'bg-slate-500'
        }`}>
          AI SENTIMENT: {sentiment || 'ANALYZING...'}
        </div>
        {score !== null && (
          <div className="flex flex-col">
            <span className="text-[8px] text-slate-500 font-black uppercase">Impact Intensity</span>
            <span className="text-sm font-black text-blue-400">{score}% Confidence</span>
          </div>
        )}
      </div>

      {/* AI 요약 (Groq 결과물) */}
      <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 shadow-inner relative overflow-hidden">
        {/* 장식용 배경 광원 */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-blue-600/10 blur-[50px] rounded-full"></div>
        
        <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
          <span className="w-1 h-1 bg-blue-400 rounded-full animate-ping"></span>
          AI Insight Summary
        </p>
        
        <ul className="space-y-4 relative z-10">
          {summaryLines.length > 0 ? (
            summaryLines.map((line, i) => (
              <li key={i} className="text-sm md:text-base text-slate-200 leading-relaxed flex gap-4 group">
                <span className="text-blue-500 font-bold group-hover:scale-125 transition-transform mt-1">✦</span>
                <span className="flex-1">{line.replace(/^[*-]\s*/, '')}</span>
              </li>
            ))
          ) : (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-500 italic animate-pulse">
                가공된 AI 분석 데이터를 생성 중입니다. 잠시만 기다려 주세요...
              </p>
            </div>
          )}
        </ul>
      </div>
    </div>
  );
}