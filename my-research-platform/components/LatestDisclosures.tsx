'use client';

import { useEffect, useState } from 'react';
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
      case 'POSITIVE': return 'bg-green-900/30 text-green-400';
      case 'NEGATIVE': return 'bg-red-900/30 text-red-400';
      default: return 'bg-gray-800 text-gray-400';
    }
  };

  const getTimeAgo = (date: string) => {
    if (!date) return 'Recently';
    return 'Recently';
  };

  const handleCardClick = (stockCode: string) => {
    if (stockCode && stockCode !== 'null' && stockCode !== '') {
      router.push(`/stock/${stockCode}`); // 종목 상세로 정확히 이동
    }
  };

  if (loading) return <div className="p-4 text-white">Loading...</div>;

  return (
    <div className="flex flex-col space-y-4">
      {disclosures.map((disclosure) => {
        // 30% 변동 등 중요 공시만 감지하여 스타일 변경
        const isCritical = disclosure.report_name?.includes('30%') || disclosure.importance === 'HIGH';
        
        return (
          <div
            key={disclosure.id}
            onClick={() => handleCardClick(disclosure.stock_code)}
            className={`bg-slate-900 border rounded-2xl p-6 transition-all cursor-pointer
              ${isCritical ? 'border-orange-500/50 shadow-lg' : 'border-slate-800 hover:border-blue-500'}`}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold ${isCritical ? 'bg-orange-600' : 'bg-blue-700'} text-white`}>
                  {getCompanyInitials(disclosure.corp_name)}
                </div>
                <div>
                  <h4 className="font-bold text-white text-lg group-hover:text-blue-400">
                    {disclosure.corp_name}
                  </h4>
                  <p className="text-xs text-slate-500">{disclosure.stock_code} • {disclosure.market}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-500 mb-1">{getTimeAgo(disclosure.analyzed_at)}</div>
                <span className={`inline-block text-[10px] px-2.5 py-1 rounded-md font-black uppercase ${getImpactColor(disclosure.importance || 'MEDIUM')}`}>
                  {disclosure.importance || 'MEDIUM'} IMPACT
                </span>
              </div>
            </div>

            <h5 className={`font-bold text-slate-100 mb-2 ${isCritical ? 'text-lg' : 'text-base'}`}>
              {disclosure.report_name}
            </h5>
            
            <p className="text-sm text-slate-400 line-clamp-2 mb-4">
              {disclosure.summary}
            </p>

            <div className="flex justify-between items-center pt-4 border-t border-slate-800/50">
              <div className="flex gap-2">
                <span className={`text-xs px-3 py-1 rounded-full ${getSentimentColor(disclosure.sentiment)}`}>
                  {disclosure.sentiment || 'NEUTRAL'}
                </span>
                <span className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">
                  {disclosure.sentiment_score === 0 ? 'NEUTRAL' : `Score: ${disclosure.sentiment_score.toFixed(2)}`}
                </span>
              </div>
              <span className="text-blue-500 text-sm font-medium">
                View Analysis →
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}