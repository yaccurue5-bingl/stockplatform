'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import SearchDropdown from '@/components/SearchDropdown';

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
  sector?: string;
  sector_en?: string;
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
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // URL에서 파라미터 읽기
  const stockCodeParam = searchParams.get('stock');
  const searchQueryParam = searchParams.get('search');  // 검색어 파라미터

  // 서버 사이드 검색 함수
  const searchFromServer = useCallback(async (query: string) => {
    if (!query.trim()) {
      setFilteredStocks(groupedStocks);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      // 검색 API 호출
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=50`);
      if (response.ok) {
        const data = await response.json();
        const searchResults = data.results || [];

        // 검색 결과를 GroupedStock 형식으로 변환
        const searchedStocks: GroupedStock[] = searchResults.map((result: any) => {
          // 해당 종목의 공시가 있는지 groupedStocks에서 찾기
          const existingStock = groupedStocks.find(s => s.stock_code === result.stock_code);
          if (existingStock) {
            return existingStock;
          }
          // 기존 공시가 없으면 검색 결과로 새 항목 생성
          return {
            stock_code: result.stock_code,
            corp_name: result.corp_name,
            corp_name_en: result.corp_name_en,
            market: 'KOSPI',
            disclosures: result.latest_disclosure ? [{
              id: result.latest_disclosure.id,
              corp_name: result.corp_name,
              corp_name_en: result.corp_name_en,
              stock_code: result.stock_code,
              market: 'KOSPI',
              report_name: result.latest_disclosure.report_nm,
              summary: '',
              sentiment: result.latest_disclosure.sentiment || 'NEUTRAL',
              sentiment_score: 0,
              importance: result.latest_disclosure.importance || 'MEDIUM',
              analyzed_at: result.latest_disclosure.analyzed_at,
            }] : [],
            latestImportance: result.latest_disclosure?.importance || 'MEDIUM',
            hasHighImpact: result.latest_disclosure?.importance === 'HIGH',
          };
        }).filter((stock: GroupedStock) => stock.disclosures.length > 0);

        setFilteredStocks(searchedStocks);
      }
    } catch (error) {
      console.error('Search failed:', error);
      // 실패 시 클라이언트 사이드 검색으로 폴백
      const query_lower = query.toLowerCase();
      const filtered = groupedStocks.filter(stock =>
        stock.corp_name.toLowerCase().includes(query_lower) ||
        stock.stock_code.includes(query) ||
        (stock.corp_name_en && stock.corp_name_en.toLowerCase().includes(query_lower))
      );
      setFilteredStocks(filtered);
    } finally {
      setIsSearching(false);
    }
  }, [groupedStocks]);

  // 검색 필터링 (디바운스 적용)
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!searchQuery.trim()) {
      setFilteredStocks(groupedStocks);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    debounceRef.current = setTimeout(() => {
      searchFromServer(searchQuery);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, searchFromServer, groupedStocks]);

  // stock 파라미터에 따라 데이터 로드
  useEffect(() => {
    if (stockCodeParam) {
      // 특정 종목 조회
      fetchDisclosures(stockCodeParam);
    } else if (groupedStocks.length === 0) {
      // 전체 공시 로드 (데이터가 없을 때만)
      fetchDisclosures();
    } else {
      // 이미 데이터가 있으면 선택 상태만 초기화
      setSelectedStock(null);
      setSelectedDisclosure(null);
      setLoading(false);
    }
  }, [stockCodeParam]);

  // search 파라미터가 있으면 검색 실행
  useEffect(() => {
    if (searchQueryParam && groupedStocks.length > 0) {
      setSearchQuery(searchQueryParam);
      searchFromServer(searchQueryParam);
    }
  }, [searchQueryParam, groupedStocks.length]);

  // URL 기반 네비게이션 함수들
  const navigateToStock = useCallback((stock: GroupedStock) => {
    // 현재 스크롤 위치 저장
    setSavedScrollPosition(window.scrollY);
    setSelectedStock(stock);
    // 첫 번째 공시 자동 선택 - 바로 공시 상세 화면으로 이동
    if (stock.disclosures.length > 0) {
      setSelectedDisclosure(stock.disclosures[0]);
    }
    // push 사용 - 뒤로가기 시 이전 페이지로 이동
    router.push(`/disclosures?stock=${stock.stock_code}`, { scroll: false });
  }, [router]);

  const navigateToDisclosure = useCallback((disclosure: Disclosure) => {
    // URL을 변경하지 않고 상태만 변경
    setSelectedDisclosure(disclosure);
  }, []);

  const navigateBack = useCallback(() => {
    // 브라우저 히스토리 뒤로가기 - 이전 페이지로 바로 이동
    router.back();
  }, [router]);

  // 브라우저 뒤로가기 처리 - 상태만 초기화 (데이터는 유지)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const stockCode = params.get('stock');

      if (!stockCode) {
        // 선택 상태만 초기화 (데이터는 이미 있으므로 유지)
        setSelectedStock(null);
        setSelectedDisclosure(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const fetchDisclosures = async (stockCode?: string) => {
    try {
      // stock 파라미터가 있으면 해당 종목만, 없으면 전체
      const url = stockCode
        ? `/api/disclosures/latest?stock=${stockCode}&limit=50`
        : '/api/disclosures/latest?limit=100';

      console.log(`🔍 [Disclosures] Fetching: ${url}`);
      const response = await fetch(url);

      if (response.ok) {
        const data: Disclosure[] = await response.json();
        console.log(`✅ [Disclosures] Got ${data.length} disclosures`);

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

        // stock 파라미터가 있으면 해당 종목을 바로 선택
        if (stockCode && grouped.length > 0) {
          const targetStock = grouped.find(s => s.stock_code === stockCode);
          if (targetStock) {
            console.log(`🎯 [Disclosures] Auto-selecting stock: ${stockCode}`);
            setSelectedStock(targetStock);
            if (targetStock.disclosures.length > 0) {
              setSelectedDisclosure(targetStock.disclosures[0]);
            }
          }
        }

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

  // 날짜 포맷팅 함수
  const formatDate = (date: string | null | undefined) => {
    if (!date) return 'N/A';
    try {
      const d = new Date(date);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  const formatDateTime = (date: string | null | undefined) => {
    if (!date) return 'N/A';
    try {
      const d = new Date(date);
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch {
      return 'N/A';
    }
  };

  // 개별 공시 상세 보기 (새로운 디자인)
  if (selectedDisclosure && selectedStock) {
    const currentIndex = selectedStock.disclosures.findIndex(d => d.id === selectedDisclosure.id);

    return (
      <div className="bg-gray-950 text-white font-sans min-h-screen">
        {/* Header */}
        <header className="bg-black border-b border-gray-800 sticky top-0 z-40">
          <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={navigateBack}
                className="text-gray-400 hover:text-white transition"
              >
                ← Back
              </button>
              <span className="text-lg font-semibold">AI Disclosure Detail</span>
            </div>
            <div className="text-sm text-gray-400">
              {new Date().toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZoneName: 'short'
              })}
            </div>
          </div>
        </header>

        <div className="flex min-h-[calc(100vh-60px)]">
          {/* Left Sidebar - Disclosure History */}
          <aside className="w-64 bg-gray-900 border-r border-gray-800 flex-shrink-0">
            <div className="p-4 border-b border-gray-800">
              <h2 className="font-bold text-lg">Disclosure History</h2>
            </div>
            <div className="overflow-y-auto max-h-[calc(100vh-120px)]">
              {selectedStock.disclosures.map((disclosure, index) => {
                const isSelected = disclosure.id === selectedDisclosure.id;
                const isCurrent = index === 0;

                return (
                  <div
                    key={disclosure.id}
                    onClick={() => navigateToDisclosure(disclosure)}
                    className={`p-3 cursor-pointer border-b border-gray-800 transition-all ${
                      isSelected
                        ? 'bg-green-600 text-white'
                        : 'hover:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {!isSelected && (
                        <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                          disclosure.sentiment?.toUpperCase() === 'POSITIVE' ? 'bg-green-500' :
                          disclosure.sentiment?.toUpperCase() === 'NEGATIVE' ? 'bg-red-500' :
                          'bg-gray-500'
                        }`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium truncate ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                          {formatDate(disclosure.analyzed_at)}: {disclosure.report_name?.substring(0, 20)}...
                        </div>
                        {isCurrent && isSelected && (
                          <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded mt-1 inline-block">
                            Current
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto">
            <div className="p-6">
              {/* Company Header */}
              <div className="flex items-start gap-4 mb-6">
                <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center text-2xl font-bold flex-shrink-0">
                  AI
                </div>
                <div className="flex-1">
                  <h1 className="text-2xl font-bold mb-2">
                    {selectedStock.corp_name_en || selectedStock.corp_name} ({selectedStock.stock_code}): {selectedDisclosure.report_name}
                  </h1>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                      selectedDisclosure.sentiment?.toUpperCase() === 'POSITIVE'
                        ? 'bg-green-600 text-white'
                        : selectedDisclosure.sentiment?.toUpperCase() === 'NEGATIVE'
                        ? 'bg-red-600 text-white'
                        : 'bg-gray-600 text-white'
                    }`}>
                      {selectedDisclosure.sentiment || 'NEUTRAL'}
                    </span>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                      selectedDisclosure.sentiment?.toUpperCase() === 'POSITIVE'
                        ? 'bg-green-500/20 text-green-400 border border-green-500'
                        : selectedDisclosure.sentiment?.toUpperCase() === 'NEGATIVE'
                        ? 'bg-red-500/20 text-red-400 border border-red-500'
                        : 'bg-gray-500/20 text-gray-400 border border-gray-500'
                    }`}>
                      {selectedDisclosure.sentiment || 'NEUTRAL'}
                    </span>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                      selectedDisclosure.importance === 'HIGH'
                        ? 'bg-orange-500/20 text-orange-400 border border-orange-500'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500'
                    }`}>
                      {selectedDisclosure.importance || 'MEDIUM'} Importance
                    </span>
                  </div>

                  {/* Company Info */}
                  <div className="text-sm text-gray-400">
                    <p><span className="text-gray-500">corp_name</span></p>
                    <p>{selectedStock.corp_name_en || selectedStock.corp_name}</p>
                    <p><span className="text-gray-500">sector</span> {selectedDisclosure.sector_en || selectedDisclosure.sector || 'Others'}</p>
                    <p>{formatDateTime(selectedDisclosure.analyzed_at)}</p>
                  </div>
                </div>
              </div>

              {/* Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Analysis */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Tabs */}
                  <div className="flex gap-2">
                    <button className="bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
                      AI Analysis
                    </button>
                    <button className="bg-gray-800 text-gray-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition">
                      Original Text
                    </button>
                  </div>

                  {/* Key Takeaways */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold">Key Takeaways</h3>
                      <span className={selectedDisclosure.sentiment?.toUpperCase() === 'POSITIVE' ? 'text-green-400' : selectedDisclosure.sentiment?.toUpperCase() === 'NEGATIVE' ? 'text-red-400' : 'text-gray-400'}>
                        {selectedDisclosure.sentiment?.toUpperCase() === 'POSITIVE' ? '↑' : selectedDisclosure.sentiment?.toUpperCase() === 'NEGATIVE' ? '↓' : '→'}
                      </span>
                    </div>
                    <div className="text-gray-300">
                      {selectedDisclosure.summary ? (
                        <p className="whitespace-pre-wrap">{selectedDisclosure.summary}</p>
                      ) : (
                        <p className="text-gray-500 italic">AI 분석 요약이 없습니다.</p>
                      )}
                    </div>
                  </div>

                  {/* Investor Impact Analysis */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold">Investor Impact Analysis</h3>
                      <span className={selectedDisclosure.sentiment?.toUpperCase() === 'POSITIVE' ? 'text-green-400' : selectedDisclosure.sentiment?.toUpperCase() === 'NEGATIVE' ? 'text-red-400' : 'text-gray-400'}>
                        {selectedDisclosure.sentiment?.toUpperCase() === 'POSITIVE' ? '↑' : selectedDisclosure.sentiment?.toUpperCase() === 'NEGATIVE' ? '↓' : '→'}
                      </span>
                    </div>
                    <div className="text-gray-300">
                      {selectedDisclosure.investment_implications ? (
                        <p className="whitespace-pre-wrap">{selectedDisclosure.investment_implications}</p>
                      ) : selectedDisclosure.detailed_analysis ? (
                        <p className="whitespace-pre-wrap">{selectedDisclosure.detailed_analysis}</p>
                      ) : selectedDisclosure.summary ? (
                        <p className="whitespace-pre-wrap text-gray-400">{selectedDisclosure.summary}</p>
                      ) : (
                        <p className="text-gray-500 italic">상세 분석 정보가 없습니다.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column - Charts & Related */}
                <div className="space-y-6">
                  {/* Stock Price Trend (하드코딩) */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold mb-4">Stock Price Trend (Past 1M)</h3>
                    <div className="h-32 flex items-end justify-between gap-1 mb-2">
                      {/* 하드코딩된 차트 바 */}
                      {[40, 55, 45, 60, 50, 70, 65, 80, 75, 90, 85, 95].map((height, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-blue-500 rounded-t"
                          style={{ height: `${height}%` }}
                        />
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>20</span>
                      <span>300</span>
                      <span>400</span>
                      <span>300</span>
                    </div>
                    <div className="text-right mt-2">
                      <span className="text-green-400 font-bold">+15.2%</span>
                    </div>
                  </div>

                  {/* Financial Ratios (하드코딩) */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold mb-4">Financial Ratios (YoY)</h3>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Revenue</span>
                          <span className="text-green-400">+10%</span>
                        </div>
                        <div className="flex gap-2">
                          <div className="h-6 bg-green-600 rounded" style={{ width: '60%' }}></div>
                          <div className="h-6 bg-green-400 rounded" style={{ width: '30%' }}></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Revenue</div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Net Profit</span>
                          <span className="text-green-400">+17%</span>
                        </div>
                        <div className="flex gap-2">
                          <div className="h-6 bg-green-600 rounded" style={{ width: '50%' }}></div>
                          <div className="h-6 bg-green-400 rounded" style={{ width: '40%' }}></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">Net Profit</div>
                      </div>
                    </div>
                  </div>

                  {/* Related Disclosures (하드코딩) */}
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <h3 className="text-sm font-bold mb-4">Related Disclosures (Automotive Sector)</h3>
                    <ol className="space-y-2 text-sm text-gray-300">
                      <li className="flex gap-2">
                        <span className="text-gray-500">1.</span>
                        <span>Kia Corp: New EV Platform Launch</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-gray-500">2.</span>
                        <span>Tesla Inc: Gigafactory Expansion Plans</span>
                      </li>
                    </ol>
                    <div className="flex gap-2 mt-4">
                      <button className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded text-xs hover:bg-gray-700 transition">
                        This Company (2)
                      </button>
                      <button className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded text-xs hover:bg-gray-700 transition">
                        (This Company) (2)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
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
            {/* 검색 드롭다운 */}
            <div className="w-48 md:w-80">
              <SearchDropdown
                onSelectStock={(stockCode) => {
                  const stock = groupedStocks.find(s => s.stock_code === stockCode);
                  if (stock) {
                    navigateToStock(stock);
                  } else {
                    router.push(`/disclosures?stock=${stockCode}`);
                  }
                }}
                onSearch={(query) => {
                  // 검색어로 전체 검색 - URL 업데이트
                  router.push(`/disclosures?search=${encodeURIComponent(query)}`);
                }}
                isSuperUser={true}
                placeholder="Search company..."
              />
            </div>
            <Link href="/signup" className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition">
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8 min-h-[60px]">
          <h1 className="text-3xl font-bold mb-2">All Disclosures</h1>
          <p className="text-gray-400 h-6">
            {isSearching ? (
              'Searching...'
            ) : searchQuery ? (
              `${filteredStocks.length} results for "${searchQuery}"`
            ) : (
              `${filteredStocks.length} companies with recent announcements`
            )}
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
        ) : filteredStocks.length === 0 && !isSearching ? (
          <div className="text-center py-16 min-h-[200px]">
            <p className="text-gray-400 text-lg">
              {searchQuery ? `No results for "${searchQuery}"` : 'No disclosures found'}
            </p>
            {searchQuery && (
              <p className="text-gray-500 text-sm mt-2">
                Try searching with Korean or English company name, or stock code
              </p>
            )}
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
                        {/* 영문명 우선, 한글명 아래 배치 */}
                        <h4 className="font-bold text-lg">{stock.corp_name_en || stock.corp_name}</h4>
                        {stock.corp_name_en && (
                          <p className="text-sm text-gray-400">{stock.corp_name}</p>
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
