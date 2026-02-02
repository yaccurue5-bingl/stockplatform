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
        // 최대 4개만 표시하여 메인 대시보드의 간결함 유지
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
    const words = name.split(' ');
    if (words.length >= 2) {
      return (words[0]?.[0] || '') + (words[1]?.[0] || '');
    }
    return (name || '').substring(0, 2).toUpperCase() || '??';
  };

  const getImpactColor = (importance: string) => {
    switch (importance) {
      case 'HIGH': return 'bg-red-900 bg-opacity-30 text-red-400';
      case 'MEDIUM': return 'bg-orange-900 bg-opacity-30 text-orange-400';
      default: return 'bg-blue-900 bg-opacity-30 text-blue-400';
    }
  };

  const getImpactLabel = (importance: string) => {
    switch (importance) {
      case 'HIGH': return 'High Impact';
      case 'MEDIUM': return 'Medium Impact';
      default: return 'Low Impact';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'POSITIVE': return 'bg-green-900 bg-opacity-30 text-green-400';
      case 'NEGATIVE': return 'bg-red-900 bg-opacity-30 text-red-400';
      default: return 'bg-blue-900 bg-opacity-30 text-blue-400';
    }
  };

  const getTimeAgo = (date: string | null | undefined) => {
    if (!date) return 'Recently';
    try {
      const now = new Date();
      const analyzed = new Date(date);
      if (isNaN(analyzed.getTime())) return 'Recently';
      const diffMs = now.getTime() - analyzed.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch (error) {
      return 'Recently';
    }
  };

  const handleCardClick = (stockCode: string, disclosureId: string) => {
    if (stockCode && stockCode !== 'null' && stockCode !== '') {
      router.push(`/stock/${stockCode}`);
    } else {
      router.push(`/dashboard?id=${disclosureId}`);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 animate-pulse h-40"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      <div className="grid grid-cols-1 gap-4">
        {disclosures.map((disclosure) => {
          // 중요 공시 키워드 감지 (예: 매출액 30% 변동 등)
          const isCritical = disclosure.report_name?.includes('30%') || disclosure.importance === 'HIGH';
          
          return (
            <div
              key={disclosure.id}
              onClick={() => handleCardClick(disclosure.stock_code, disclosure.id)}
              className={`group relative bg-slate-900 border transition-all duration-300 cursor-pointer rounded-2xl p-6 
                ${isCritical 
                  ? 'border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.1)] hover:border-orange-500' 
                  : 'border-slate-800 hover:border-blue-500 hover:bg-slate-800/50'
                }`}
            >
              {/* 상단: 회사 정보 및 시간 */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold shadow-inner transition-colors
                    ${isCritical ? 'bg-orange-600 text-white' : 'bg-blue-700 text-white group-hover:bg-blue-600'}`}>
                    {getCompanyInitials(disclosure.corp_name)}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-lg group-hover:text-blue-400 transition-colors flex items-center gap-2">
                      {disclosure.corp_name}
                      {isCritical && <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium tracking-wide">
                      {disclosure.stock_code} • {disclosure.market}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 font-bold mb-2 uppercase tracking-tighter">
                    {getTimeAgo(disclosure.analyzed_at)}
                  </div>
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm ${getImpactColor(disclosure.importance || 'MEDIUM')}`}>
                    {getImpactLabel(disclosure.importance || 'MEDIUM')}
                  </span>
                </div>
              </div>

              {/* 중단: 공시 제목 */}
              <h5 className={`font-bold mb-2 text-slate-100 transition-colors group-hover:text-white ${isCritical ? 'text-lg leading-tight' : 'text-base'}`}>
                {disclosure.report_name || 'Disclosure Report'}
              </h5>
              
              <p className="text-sm text-slate-400 leading-relaxed mb-5 line-clamp-2 group-hover:text-slate-300">
                {disclosure.summary || 'Summary not available.'}
              </p>

              {/* 하단: 감성 분석 및 스코어 */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold shadow-sm ${getSentimentColor(disclosure.sentiment || 'NEUTRAL')}`}>
                    {disclosure.sentiment || 'NEUTRAL'}
                  </span>
                  <span className="bg-slate-800 text-slate-400 text-[10px] px-2.5 py-1 rounded-md font-bold border border-slate-700">
                    {disclosure.sentiment_score === 0 ? 'NEUTRAL ANALYSIS' : `SCORE: ${(disclosure.sentiment_score || 0).toFixed(2)}`}
                  </span>
                </div>
                <div className="text-blue-500 text-xs font-black flex items-center group-hover:translate-x-1 transition-transform uppercase tracking-widest">
                  View Analysis <span className="ml-1.5 text-lg">→</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* View All Disclosures 버튼 복구 */}
      <div className="mt-6 text-center">
        <Link 
          href="/dashboard" 
          className="inline-flex items-center gap-2 px-8 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-bold transition-all border border-slate-700 hover:border-slate-500 group"
        >
          View All Disclosures
          <span className="group-hover:translate-x-1 transition-transform text-lg">→</span>
        </Link>
      </div>
    </div>
  );
}