'use client';

import { useEffect, useState } from 'react';

interface PeerDisclosure {
  id: string;
  corp_name: string;
  stock_code: string;
  report_nm: string | null;
  report_nm_en: string | null;
  sentiment_score: number | null;
  short_term_impact_score: number | null;
  final_score: number | null;
  updated_at: string;
  event_type: string | null;
}

interface SectorContextData {
  sector: string | null;
  peers: PeerDisclosure[];
}

interface Props {
  stockCode: string;
}

function getTimeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

const EVENT_LABEL: Record<string, string> = {
  CONTRACT: 'Contract', BUYBACK: 'Buyback', DIVIDEND: 'Dividend',
  MNA: 'M&A', DILUTION: 'Dilution', EARNINGS: 'Earnings',
  LEGAL: 'Legal', CAPEX: 'Capex',
};

export default function SectorContext({ stockCode }: Props) {
  const [data, setData] = useState<SectorContextData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!stockCode) return;
    fetch(`/api/sector-context?stock=${stockCode}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [stockCode]);

  if (loading) return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse">
      <div className="h-4 bg-gray-800 rounded w-1/2 mb-3" />
      <div className="space-y-2">
        {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-800 rounded" />)}
      </div>
    </div>
  );

  if (!data?.sector || !data.peers.length) return null;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-base font-bold">Sector Activity</h3>
        <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-400 rounded-full">{data.sector}</span>
      </div>

      <div className="space-y-2">
        {data.peers.map(p => {
          const sentiment = (p.sentiment_score ?? 0) >= 0.3 ? 'POSITIVE'
            : (p.sentiment_score ?? 0) <= -0.3 ? 'NEGATIVE' : 'NEUTRAL';
          const dotColor = sentiment === 'POSITIVE' ? 'bg-green-500'
            : sentiment === 'NEGATIVE' ? 'bg-red-500' : 'bg-gray-500';

          return (
            <div key={p.id} className="flex items-start gap-2 px-3 py-2.5 bg-gray-800/50 rounded-lg">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <p className="text-xs font-medium text-gray-300 truncate">{p.corp_name}</p>
                  <span className="text-[10px] text-gray-600 shrink-0">{getTimeAgo(p.updated_at)}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {p.event_type && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/15 text-blue-400 rounded">
                      {EVENT_LABEL[p.event_type] ?? p.event_type}
                    </span>
                  )}
                  <p className="text-[10px] text-gray-500 truncate">
                    {p.report_nm_en || p.report_nm}
                  </p>
                </div>
              </div>
              {p.final_score != null && (
                <span className={`text-xs font-bold shrink-0 ${
                  p.final_score >= 70 ? 'text-green-400'
                  : p.final_score >= 40 ? 'text-yellow-400' : 'text-gray-500'
                }`}>
                  {p.final_score}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-xs text-gray-600 mt-2">Same sector · Last 30 days · High signal only</p>
    </div>
  );
}
