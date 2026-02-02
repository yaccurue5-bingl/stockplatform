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

interface GroupedStock {
  stock_code: string;
  corp_name: string;
  market: string;
  disclosures: Disclosure[];
  latestImportance: string;
  hasHighImpact: boolean;
}

export default function DisclosuresPage() {
  const router = useRouter();
  const [groupedStocks, setGroupedStocks] = useState<GroupedStock[]>([]);
  const [selectedStock, setSelectedStock] = useState<GroupedStock | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDisclosures();
  }, []);

  const fetchDisclosures = async () => {
    try {
      const response = await fetch('/api/disclosures/latest?limit=100');
      if (response.ok) {
        const data: Disclosure[] = await response.json();

        // 종목별로 그룹화
        const stockMap = new Map<string, GroupedStock>();

        data.forEach((disclosure) => {
          const key = disclosure.stock_code || disclosure.corp_name;

          if (stockMap.has(key)) {
            const existing = stockMap.get(key)!;
            existing.disclosures.push(disclosure);
            if (disclosure.importance === 'HIGH') {
              existing.hasHighImpact = true;
            }
          } else {
            stockMap.set(key, {
              stock_code: disclosure.stock_code,
              corp_name: disclosure.corp_name,
              market: disclosure.market,
              disclosures: [disclosure],
              latestImportance: disclosure.importance,
              hasHighImpact: disclosure.importance === 'HIGH',
            });
          }
        });

        setGroupedStocks(Array.from(stockMap.values()));
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

  const getImpactColor = (importance: string, hasHigh: boolean) => {
    if (hasHigh) return 'bg-red-900/30 text-red-400';
    switch (importance) {
      case 'HIGH': return 'bg-red-900/30 text-red-400';
      case 'MEDIUM': return 'bg-orange-900/30 text-orange-400';
      default: return 'bg-blue-900/30 text-blue-400';
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
    } catch {
      return 'Recently';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment?.toUpperCase()) {
      case 'POSITIVE': return 'bg-green-900/30 text-green-400';
      case 'NEGATIVE': return 'bg-red-900/30 text-red-400';
      default: return 'bg-gray-800 text-gray-400';
    }
  };

  // 개별 공시 상세 모달
  if (selectedStock) {
    return (
      <div className="bg-gray-950 text-white font-sans min-h-screen">
        {/* Header */}
        <header className="bg-black border-b border-gray-800 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSelectedStock(null)}
                className="text-gray-400 hover:text-white transition"
              >
                ← Back
              </button>
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${selectedStock.hasHighImpact ? 'bg-orange-600' : 'bg-blue-600'}`}>
                  {getCompanyInitials(selectedStock.corp_name)}
                </div>
                <div>
                  <span className="text-xl font-bold">{selectedStock.corp_name}</span>
                  <span className="text-gray-400 ml-2">{selectedStock.stock_code}</span>
                </div>
              </div>
            </div>
            <Link href={`/stock/${selectedStock.stock_code}`} className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition">
              View Stock Details →
            </Link>
          </div>
        </header>

        {/* Disclosures List */}
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2">{selectedStock.corp_name} Disclosures</h1>
            <p className="text-gray-400">{selectedStock.disclosures.length} disclosure{selectedStock.disclosures.length > 1 ? 's' : ''} found</p>
          </div>

          <div className="space-y-4">
            {selectedStock.disclosures.map((disclosure) => (
              <div
                key={disclosure.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-600 transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-xs px-2 py-1 rounded ${getImpactColor(disclosure.importance, false)}`}>
                        {disclosure.importance || 'MEDIUM'}
                      </span>
                      <span className="text-xs text-gray-500">{getTimeAgo(disclosure.analyzed_at)}</span>
                    </div>
                    <h5 className="font-semibold text-lg mb-2">{disclosure.report_name}</h5>
                  </div>
                </div>

                <p className="text-sm text-gray-400 mb-4">
                  {disclosure.summary || 'No summary available'}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                  <div className="flex gap-2">
                    <span className={`text-xs px-3 py-1 rounded-full ${getSentimentColor(disclosure.sentiment)}`}>
                      {disclosure.sentiment || 'NEUTRAL'}
                    </span>
                    <span className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">
                      Score: {(disclosure.sentiment_score || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-gray-950 text-white font-sans min-h-screen">
      {/* Header */}
      <header className="bg-black border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg">
              K
            </div>
            <span className="text-xl font-bold">K-Market Insight</span>
          </Link>
          <Link href="/signup" className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition">
            Sign Up
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">All Disclosures</h1>
          <p className="text-gray-400">
            {groupedStocks.length} companies with recent announcements
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse">
                <div className="h-24 bg-gray-800 rounded"></div>
              </div>
            ))}
          </div>
        ) : groupedStocks.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">No disclosures found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedStocks.map((stock) => {
              const latestDisclosure = stock.disclosures[0];
              const disclosureCount = stock.disclosures.length;

              return (
                <div
                  key={stock.stock_code || stock.corp_name}
                  onClick={() => setSelectedStock(stock)}
                  className={`bg-gray-900 border rounded-xl p-5 cursor-pointer transition-all
                    ${stock.hasHighImpact ? 'border-orange-500/50 shadow-lg shadow-orange-500/10' : 'border-gray-800 hover:border-blue-500'}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white ${stock.hasHighImpact ? 'bg-orange-600' : 'bg-blue-600'}`}>
                        {getCompanyInitials(stock.corp_name)}
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">{stock.corp_name}</h4>
                        <p className="text-sm text-gray-500">{stock.stock_code} • {stock.market}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 mb-1">{getTimeAgo(latestDisclosure.analyzed_at)}</div>
                      <span className={`inline-block text-xs px-3 py-1 rounded-full font-medium ${getImpactColor(stock.latestImportance, stock.hasHighImpact)}`}>
                        {disclosureCount} disclosure{disclosureCount > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <h5 className="font-medium mb-2">{latestDisclosure.report_name}</h5>

                  <p className="text-sm text-gray-400 line-clamp-2 mb-4">
                    {latestDisclosure.summary}
                  </p>

                  {disclosureCount > 1 && (
                    <div className="text-xs text-gray-500 mb-3">
                      +{disclosureCount - 1} more disclosure{disclosureCount > 2 ? 's' : ''}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-gray-800/50">
                    <div className="flex gap-2">
                      <span className={`text-xs px-3 py-1 rounded-full ${getSentimentColor(latestDisclosure.sentiment)}`}>
                        {latestDisclosure.sentiment || 'NEUTRAL'}
                      </span>
                    </div>
                    <span className="text-blue-500 text-sm font-medium">
                      View {disclosureCount > 1 ? 'All' : ''} →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
