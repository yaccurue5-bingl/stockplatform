'use client';

interface Props {
  sentiment: string;
  sentiment_score: number;
  ai_summary: string;
}

export default function StockSentiment({ sentiment, sentiment_score, ai_summary }: Props) {
  // 줄바꿈 문자를 분리하여 배열로 만듭니다.
  const summaryLines = ai_summary ? ai_summary.split('\n').filter(line => line.trim() !== '') : [];

  return (
    <div className="space-y-6">
      {/* AI 요약 섹션 */}
      <div>
        <p className="text-slate-400 text-[10px] font-black uppercase mb-3 tracking-widest">AI Executive Summary</p>
        <div className="text-sm leading-relaxed text-slate-200 bg-white/5 p-5 rounded-2xl border border-white/10 italic">
          {summaryLines.length > 0 ? (
            <ul className="list-none space-y-2">
              {summaryLines.map((line, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-blue-500">•</span>
                  {line.replace(/^[*-]\s*/, '')} {/* 불필요한 불렛 기호 제거 */}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500">분석 데이터를 불러오는 중입니다...</p>
          )}
        </div>
      </div>

      {/* 감성 및 점수 섹션 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <p className="text-slate-500 text-[8px] font-black uppercase mb-1">Sentiment</p>
          <p className={`text-sm font-black ${
            sentiment?.toUpperCase() === 'POSITIVE' ? 'text-green-400' : 
            sentiment?.toUpperCase() === 'NEGATIVE' ? 'text-rose-400' : 'text-slate-400'
          }`}>
            {sentiment || 'NEUTRAL'}
          </p>
        </div>
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
          <p className="text-slate-500 text-[8px] font-black uppercase mb-1">Impact Score</p>
          <p className="text-sm font-black text-blue-400">
            {typeof sentiment_score === 'number' ? (sentiment_score * 100).toFixed(0) : '0'}% Intensity
          </p>
        </div>
      </div>
    </div>
  );
}