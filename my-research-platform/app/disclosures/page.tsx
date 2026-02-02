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

export default function DisclosuresPage() {
  const router = useRouter();
  const [disclosures, setDisclosures] = useState<Disclosure[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDisclosures();
  }, []);

  const fetchDisclosures = async () => {
    try {
      const response = await fetch('/api/disclosures/latest?limit=50');
      if (response.ok) {
        const data = await response.json();
        setDisclosures(data);
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
      case 'HIGH':
        return 'bg-red-900 bg-opacity-30 text-red-400';
      case 'MEDIUM':
        return 'bg-orange-900 bg-opacity-30 text-orange-400';
      default:
        return 'bg-blue-900 bg-opacity-30 text-blue-400';
    }
  };

  const getImpactLabel = (importance: string) => {
    switch (importance) {
      case 'HIGH':
        return 'High Impact';
      case 'MEDIUM':
        return 'Medium Impact';
      default:
        return 'Low Impact';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'POSITIVE':
        return 'bg-green-900 bg-opacity-30 text-green-400';
      case 'NEGATIVE':
        return 'bg-red-900 bg-opacity-30 text-red-400';
      default:
        return 'bg-blue-900 bg-opacity-30 text-blue-400';
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

  const handleCardClick = (stockCode: string, disclosureId: string) => {
    if (stockCode && stockCode !== 'null' && stockCode !== '') {
      router.push(`/stock/${stockCode}`);
    } else {
      router.push(`/dashboard?id=${disclosureId}`);
    }
  };

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
          <p className="text-gray-400">Latest public announcements from KOSPI & KOSDAQ companies</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse">
                <div className="h-24 bg-gray-800 rounded"></div>
              </div>
            ))}
          </div>
        ) : disclosures.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">No disclosures found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {disclosures.map((disclosure) => (
              <div
                key={disclosure.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-600 transition cursor-pointer"
                onClick={() => handleCardClick(disclosure.stock_code, disclosure.id)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center font-bold">
                      {getCompanyInitials(disclosure.corp_name)}
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg">{disclosure.corp_name || 'Unknown'}</h4>
                      <p className="text-sm text-gray-400">
                        {disclosure.stock_code || '000000'} • {disclosure.market || 'KOSPI'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-1">{getTimeAgo(disclosure.analyzed_at)}</div>
                    <span className={`inline-block text-xs px-3 py-1 rounded-full font-medium ${getImpactColor(disclosure.importance || 'MEDIUM')}`}>
                      {getImpactLabel(disclosure.importance || 'MEDIUM')}
                    </span>
                  </div>
                </div>
                <h5 className="font-medium mb-2">{disclosure.report_name || 'Disclosure Report'}</h5>
                <p className="text-sm text-gray-400 mb-3">
                  {(disclosure.summary || '').substring(0, 200)}
                  {(disclosure.summary || '').length > 200 ? '...' : ''}
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    <span className={`text-xs px-3 py-1 rounded-full ${getSentimentColor(disclosure.sentiment || 'NEUTRAL')}`}>
                      {disclosure.sentiment || 'NEUTRAL'}
                    </span>
                    <span className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">
                      Score: {(disclosure.sentiment_score || 0).toFixed(2)}
                    </span>
                  </div>
                  <span className="text-blue-500 text-sm">Read Full Analysis →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
