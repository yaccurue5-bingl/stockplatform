'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Disclosure {
  id: string;
  corp_name: string;
  stock_code: string;
  market: string;
  report_name: string;
  summary: string;
  sentiment: string;
  sentiment_score: number;
  importance: string;
  analyzed_at: string;
}

export default function LatestDisclosures() {
  const router = useRouter();
  const [disclosures, setDisclosures] = useState<Disclosure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDisclosures();
  }, []);

  const fetchDisclosures = async () => {
    try {
      const response = await fetch('/api/disclosures/latest');
      if (response.ok) {
        const data = await response.json();
        setDisclosures(data.slice(0, 4));
      }
    } catch (error) {
      console.error('Failed to fetch disclosures:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCompanyInitials = (name: string) => {
    if (!name) return '??';
    return name.substring(0, 2).toUpperCase();
  };

  const getImpactColor = (importance: string) => {
    switch (importance) {
      case 'HIGH': return 'bg-red-900/30 text-red-400';
      case 'MEDIUM': return 'bg-orange-900/30 text-orange-400';
      default: return 'bg-blue-900/30 text-blue-400';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment?.toUpperCase()) {
      case 'POSITIVE': return 'bg-emerald-900/30 text-emerald-400';
      case 'NEGATIVE': return 'bg-rose-900/30 text-rose-400';
      default: return 'bg-slate-800 text-slate-400';
    }
  };

  const getTimeAgo = (date: string) => {
    if (!date) return 'Recently';
    return 'Recently'; 
  };

  // ✅ 클릭 시 이동 경로 수정: 대시보드가 아닌 종목 상세 페이지로 이동
  const handleCardClick = (stockCode: string) => {
    if (stockCode && stockCode !== 'null' && stockCode !== '') {
      router.push(`/stock/${stockCode}`); 
    }
  };

  if (loading) return <div className="p-4 text-white">Loading...</div>;

  return (
    <div className="flex flex-col space-y-4">
      <div className="grid grid-cols-1 gap-4">
        {disclosures.map((disclosure) => {
          // ✅ 루닛 30% 변동 등 중요 공시 강조 조건
          const isCritical = disclosure.report_name?.includes('30%') || disclosure.importance === 'HIGH';
          
          return (
            <div
              key={disclosure.id}
              onClick={() => handleCardClick(disclosure.stock_code)}
              className={`group bg-slate-900 border rounded-2xl p-6 transition-all cursor-pointer
                ${isCritical ? 'border-orange-500/50 shadow-lg' : 'border-slate-800 hover:border-blue-500'}`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${isCritical ? 'bg-orange-600' : 'bg-blue-700'} text-white`}>
                    {getCompanyInitials(disclosure.corp_name)}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg group-hover:text-blue-400 transition-colors">
                      {disclosure.corp_name}
                    </h4>
                    <p className="text-xs text-slate-500">{disclosure.stock_code} • {disclosure.market}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase ${getImpactColor(disclosure.importance || 'MEDIUM')}`}>
                  {disclosure.importance || 'MEDIUM'} IMPACT
                </span>
              </div>

              <h5 className={`font-bold text-slate-100 mb-2 ${isCritical ? 'text-lg' : 'text-base'}`}>
                {disclosure.report_name}
              </h5>
              
              <p className="text-sm text-slate-400 line-clamp-2 mb-4">
                {disclosure.summary}
              </p>

              <div className="flex justify-between items-center pt-4 border-t border-slate-800/50">
                <div className="flex gap-2">
                  <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold ${getSentimentColor(disclosure.sentiment)}`}>
                    {disclosure.sentiment || 'NEUTRAL'}
                  </span>
                  <span className="text-[10px] px-2.5 py-1 rounded-md font-bold bg-slate-800 text-slate-400">
                    {/* Score가 0일 때의 어색함 해결 */}
                    {disclosure.sentiment_score === 0 ? 'NEUTRAL' : `SCORE: ${disclosure.sentiment_score.toFixed(2)}`}
                  </span>
                </div>
                <span className="text-blue-500 text-xs font-bold uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                  Read Full Analysis →
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ✅ View All 버튼: 중복을 제거하고 명확한 경로 설정 */}
      <div className="pt-2 text-center">
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-2 px-8 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-bold transition-all border border-slate-700"
        >
          View All Disclosures
          <span className="text-lg">→</span>
        </Link>
      </div>
    </div>
  );
}