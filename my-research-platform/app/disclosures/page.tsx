'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

interface Disclosure {
  id: string;
  corp_name: string;
  corp_name_en?: string;
  stock_code: string;
  market: string;
  report_name: string;
  summary: string;
  sentiment: string;
  sentiment_score: number;
  importance: string;
  analyzed_at: string;
  detailed_analysis?: string;
  investment_implications?: string;
  risk_factors?: string[];
  key_metrics?: string[];
}

interface GroupedStock {
  stock_code: string;
  corp_name: string;
  corp_name_en?: string;
  market: string;
  disclosures: Disclosure[];
  latestImportance: string;
  hasHighImpact: boolean;
}

function DisclosuresContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [groupedStocks, setGroupedStocks] = useState<GroupedStock[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<GroupedStock[]>([]);
  const [selectedStock, setSelectedStock] = useState<GroupedStock | null>(null);
  const [selectedDisclosure, setSelectedDisclosure] = useState<Disclosure | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedScrollPosition, setSavedScrollPosition] = useState(0);

  // URL에서 stock과 disclosure 파라미터 읽기
  const stockCodeParam = searchParams.get('stock');
  const disclosureIdParam = searchParams.get('disclosure');

  // 검색 필터링
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredStocks(groupedStocks);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = groupedStocks.filter(stock =>
      stock.corp_name.toLowerCase().includes(query) ||
      stock.stock_code.includes(query) ||
      (stock.corp_name_en && stock.corp_name_en.toLowerCase().includes(query))
    );
    setFilteredStocks(filtered);
  }, [searchQuery, groupedStocks]);

  // 데이터 로드 후 URL 파라미터에 따라 선택 상태 복원
  useEffect(() => {
    if (groupedStocks.length > 0 && stockCodeParam) {
      const stock = groupedStocks.find(s => s.stock_code === stockCodeParam);
      if (stock) {
        setSelectedStock(stock);
        if (disclosureIdParam) {
          const disclosure = stock.disclosures.find(d => d.id === disclosureIdParam);
          if (disclosure) {
            setSelectedDisclosure(disclosure);
          }
        }
      }
    }
  }, [groupedStocks, stockCodeParam, disclosureIdParam]);

  useEffect(() => {
    fetchDisclosures();
  }, []);

  // URL 기반 네비게이션 함수들
  const navigateToStock = useCallback((stock: GroupedStock) => {
    // 현재 스크롤 위치 저장
    setSavedScrollPosition(window.scrollY);
    setSelectedStock(stock);
    setSelectedDisclosure(null);
    router.push(`/disclosures?stock=${stock.stock_code}`, { scroll: false });
  }, [router]);

  const navigateToDisclosure = useCallback((stock: GroupedStock, disclosure: Disclosure) => {
    setSelectedDisclosure(disclosure);
    router.push(`/disclosures?stock=${stock.stock_code}&disclosure=${disclosure.id}`, { scroll: false });
  }, [router]);

  const navigateBack = useCallback(() => {
    if (selectedDisclosure) {
      // 공시 상세 → 종목별 공시 목록
      setSelectedDisclosure(null);
      router.push(`/disclosures?stock=${selectedStock?.stock_code}`, { scroll: false });
    } else if (selectedStock) {
      // 종목별 공시 목록 → 메인 목록
      setSelectedStock(null);
      router.push('/disclosures', { scroll: false });
      // 스크롤 위치 복원
      setTimeout(() => {
        window.scrollTo(0, savedScrollPosition);
      }, 50);
    }
  }, [selectedDisclosure, selectedStock, savedScrollPosition, router]);

  // 브라우저 뒤로가기 처리
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const stockCode = params.get('stock');
      const disclosureId = params.get('disclosure');

      if (!stockCode) {
        // 메인 목록으로 돌아옴
        setSelectedStock(null);
        setSelectedDisclosure(null);
        // 스크롤 위치 복원
        setTimeout(() => {
          window.scrollTo(0, savedScrollPosition);
        }, 50);
      } else if (!disclosureId && selectedStock) {
        // 종목별 공시 목록으로 돌아옴
        setSelectedDisclosure(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedStock, savedScrollPosition]);

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
              corp_name_en: disclosure.corp_name_en,
              market: disclosure.market,
              disclosures: [disclosure],
              latestImportance: disclosure.importance,
              hasHighImpact: disclosure.importance === 'HIGH',
            });
          }
        });

        const grouped = Array.from(stockMap.values());
        setGroupedStocks(grouped);
        setFilteredStocks(grouped);
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

  const getImpactColor = (importance: string, hasHigh: boolean = false) => {
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

  // 개별 공시 상세 보기
  if (selectedDisclosure && selectedStock) {
    return (
      <div className="bg-gray-950 text-white font-sans min-h-screen">
        <header className="bg-black border-b border-gray-800 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center">
            <button
              onClick={navigateBack}
              className="text-gray-400 hover:text-white transition mr-4"
            >
              ← Back
            </button>
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold ${selectedStock.hasHighImpact ? 'bg-orange-600' : 'bg-blue-600'}`}>
                {getCompanyInitials(selectedStock.corp_name)}
              </div>
              <div>
                <span className="text-lg font-bold">{selectedStock.corp_name}</span>
                <span className="text-gray-400 ml-2 text-sm">{selectedStock.stock_code}</span>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            {/* Header */}
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs px-2 py-1 rounded ${getImpactColor(selectedDisclosure.importance, false)}`}>
                {selectedDisclosure.importance || 'MEDIUM'} IMPACT
              </span>
              <span className={`text-xs px-2 py-1 rounded ${getSentimentColor(selectedDisclosure.sentiment)}`}>
                {selectedDisclosure.sentiment || 'NEUTRAL'}
              </span>
              <span className="text-xs text-gray-500">{getTimeAgo(selectedDisclosure.analyzed_at)}</span>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold mb-6">{selectedDisclosure.report_name}</h1>

            {/* Summary */}
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Summary</h3>
              <p className="text-gray-300 leading-relaxed">{selectedDisclosure.summary}</p>
            </div>

            {/* Detailed Analysis */}
            {selectedDisclosure.detailed_analysis && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Detailed Analysis</h3>
                <p className="text-gray-300 leading-relaxed">{selectedDisclosure.detailed_analysis}</p>
              </div>
            )}

            {/* Investment Implications */}
            {selectedDisclosure.investment_implications && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-400 uppercase mb-2">Investment Implications</h3>
                <p className="text-gray-300 leading-relaxed">{selectedDisclosure.investment_implications}</p>
              </div>
            )}

            {/* Sentiment Score */}
            <div className="pt-4 border-t border-gray-800">
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-400">Sentiment Score:</span>
                <span className="text-lg font-bold">{(selectedDisclosure.sentiment_score || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // 종목별 공시 목록
  if (selectedStock) {
    return (
      <div className="bg-gray-950 text-white font-sans min-h-screen">
        <header className="bg-black border-b border-gray-800 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center">
            <button
              onClick={navigateBack}
              className="text-gray-400 hover:text-white transition mr-4"
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
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2">{selectedStock.corp_name} Disclosures</h1>
            <p className="text-gray-400">{selectedStock.disclosures.length} disclosure{selectedStock.disclosures.length > 1 ? 's' : ''} found</p>
          </div>

          <div className="space-y-4">
            {selectedStock.disclosures.map((disclosure) => (
              <div
                key={disclosure.id}
                onClick={() => navigateToDisclosure(selectedStock, disclosure)}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-blue-600 transition cursor-pointer"
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

                <p className="text-sm text-gray-400 mb-4 line-clamp-2">
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
                  <span className="text-blue-500 text-sm">View Details →</span>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    );
  }

  // 메인 목록
  return (
    <div className="bg-gray-950 text-white font-sans min-h-screen">
      <header className="bg-black border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-lg">
              K
            </div>
            <span className="text-xl font-bold">K-Market Insight</span>
          </Link>
          <div className="flex items-center gap-4">
            {/* 검색바 */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search company..."
                className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2 pl-10 w-48 md:w-80 text-sm focus:outline-none focus:border-blue-600"
              />
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 512 512">
                <path d="M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z"/>
              </svg>
            </div>
            <Link href="/signup" className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition">
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">All Disclosures</h1>
          <p className="text-gray-400">
            {filteredStocks.length} companies with recent announcements
            {searchQuery && ` (searching: "${searchQuery}")`}
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
        ) : filteredStocks.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">
              {searchQuery ? `No results for "${searchQuery}"` : 'No disclosures found'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredStocks.map((stock) => {
              const latestDisclosure = stock.disclosures[0];
              const disclosureCount = stock.disclosures.length;

              return (
                <div
                  key={stock.stock_code || stock.corp_name}
                  onClick={() => navigateToStock(stock)}
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
                        {stock.corp_name_en && (
                          <p className="text-sm text-gray-400">{stock.corp_name_en}</p>
                        )}
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

// Suspense 경계로 useSearchParams를 감싸서 클라이언트 사이드 렌더링 보장
export default function DisclosuresPage() {
  return (
    <Suspense fallback={
      <div className="bg-gray-950 text-white font-sans min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    }>
      <DisclosuresContent />
    </Suspense>
  );
}
