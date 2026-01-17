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
        setDisclosures(data.slice(0, 4)); // 최대 4개만 표시
      }
    } catch (error) {
      console.error('Failed to fetch disclosures:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCompanyInitials = (name: string) => {
    const words = name.split(' ');
    if (words.length >= 2) {
      return words[0][0] + words[1][0];
    }
    return name.substring(0, 2).toUpperCase();
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

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const analyzed = new Date(date);
    const diffMs = now.getTime() - analyzed.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const handleCardClick = (stockCode: string) => {
    if (stockCode) {
      router.push(`/stock/${stockCode}`);
    } else {
      router.push('/signup');
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-5 animate-pulse">
            <div className="h-20 bg-gray-800 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  if (disclosures.length === 0) {
    return (
      <div className="space-y-3">
        {/* Fallback to demo data */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-600 transition cursor-pointer" onClick={() => router.push('/signup')}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center font-bold">SS</div>
              <div>
                <h4 className="font-semibold text-lg">Samsung Electronics</h4>
                <p className="text-sm text-gray-400">005930 • KOSPI</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">2 minutes ago</div>
              <span className="inline-block bg-red-900 bg-opacity-30 text-red-400 text-xs px-3 py-1 rounded-full font-medium">High Impact</span>
            </div>
          </div>
          <h5 className="font-medium mb-2">Q4 2024 Earnings Report - Revenue Exceeds Expectations</h5>
          <p className="text-sm text-gray-400 mb-3">Samsung Electronics reported Q4 revenue of 67.4 trillion KRW, up 11.2% YoY, driven by strong semiconductor and mobile divisions...</p>
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              <span className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">Financial Results</span>
            </div>
            <div className="flex items-center space-x-4 text-sm">
              <span className="text-blue-500">Read Full Analysis →</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {disclosures.map((disclosure) => (
        <div
          key={disclosure.id}
          className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-600 transition cursor-pointer"
          onClick={() => handleCardClick(disclosure.stock_code)}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center font-bold">
                {getCompanyInitials(disclosure.corp_name)}
              </div>
              <div>
                <h4 className="font-semibold text-lg">{disclosure.corp_name}</h4>
                <p className="text-sm text-gray-400">
                  {disclosure.stock_code} • {disclosure.market || 'KOSPI'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 mb-1">{getTimeAgo(disclosure.analyzed_at)}</div>
              <span className={`inline-block text-xs px-3 py-1 rounded-full font-medium ${getImpactColor(disclosure.importance)}`}>
                {getImpactLabel(disclosure.importance)}
              </span>
            </div>
          </div>
          <h5 className="font-medium mb-2">{disclosure.report_name}</h5>
          <p className="text-sm text-gray-400 mb-3">
            {disclosure.summary.substring(0, 150)}
            {disclosure.summary.length > 150 ? '...' : ''}
          </p>
          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              <span className={`text-xs px-3 py-1 rounded-full ${getSentimentColor(disclosure.sentiment)}`}>
                {disclosure.sentiment}
              </span>
              <span className="bg-gray-800 text-gray-300 text-xs px-3 py-1 rounded-full">
                Score: {disclosure.sentiment_score.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center space-x-4 text-sm">
              <span className="text-blue-500 hover:text-blue-400 transition">
                Read Full Analysis →
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
