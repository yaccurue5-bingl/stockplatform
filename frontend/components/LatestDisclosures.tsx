'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { generateTicker } from '@/lib/generateTicker';

interface Disclosure {
  id: string;
  corp_name: string;
  corp_name_en?: string | null;
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
  const [disclosures, setDisclosures] = useState<Disclosure[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    fetch('/api/disclosures/latest')
      .then(r => r.ok ? r.json() : [])
      .then((data: Disclosure[]) => setDisclosures(data.slice(0, 4)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getTimeAgo = (date: string) => {
    if (!date) return '';
    const diff  = Date.now() - new Date(date).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="flex flex-col space-y-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-4">
      {disclosures.map((d) => {
        const isHigh   = d.importance === 'HIGH';
        const sentUp   = d.sentiment?.toUpperCase() === 'POSITIVE';
        const sentDown = d.sentiment?.toUpperCase() === 'NEGATIVE';

        const sentimentStyle = sentUp
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          : sentDown
          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
          : 'bg-gray-800 text-gray-400 border border-gray-700';

        const impactStyle = isHigh
          ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20';

        return (
          <Link
            key={d.id}
            href={`/disclosures/${d.id}`}
            className={`block bg-gray-900 border rounded-xl p-5 transition-all hover:bg-gray-800/60
              ${isHigh ? 'border-orange-500/40 shadow-lg shadow-orange-500/5' : 'border-gray-800 hover:border-gray-600'}`}
          >
            {/* 상단: 회사 정보 + 시간/임팩트 */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs tracking-tight text-white flex-shrink-0
                  ${isHigh ? 'bg-orange-600' : 'bg-blue-600'}`}>
                  {generateTicker(d.corp_name_en)}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-white text-sm truncate">
                    {d.corp_name_en || d.corp_name}
                  </p>
                  {d.corp_name_en && (
                    <p className="text-xs text-gray-500 truncate">{d.corp_name}</p>
                  )}
                  <p className="text-xs text-gray-600">{d.stock_code} · {d.market}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-gray-600 mb-1">{getTimeAgo(d.analyzed_at)}</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${impactStyle}`}>
                  {d.importance || 'MEDIUM'}
                </span>
              </div>
            </div>

            {/* 공시명 */}
            <p className="text-sm font-medium text-gray-200 mb-1.5 line-clamp-1">
              {d.report_name}
            </p>

            {/* 요약 */}
            <p className="text-xs text-gray-500 line-clamp-2 mb-3">
              {d.summary}
            </p>

            {/* 하단: 감성 + CTA */}
            <div className="flex items-center justify-between pt-3 border-t border-gray-800/60">
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase ${sentimentStyle}`}>
                {d.sentiment || 'NEUTRAL'}
              </span>
              <span className="text-[#00D4A6] text-xs font-medium">
                View Analysis →
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
