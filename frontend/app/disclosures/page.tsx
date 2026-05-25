'use client';

import { useEffect, useState, useCallback, useRef, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import SearchDropdown from '@/components/SearchDropdown';
import BookmarkButton from '@/components/BookmarkButton';
import ExternalDataNotice from '@/components/ExternalDataNotice';
import { getSupabase } from '@/lib/supabase/client';
import { isSuperAdmin } from '@/lib/constants';
import SignalStrength from '@/components/disclosures/SignalStrength';
import ShortPressure from '@/components/disclosures/ShortPressure';
import FinancialRatios from '@/components/disclosures/FinancialRatios';
import PriceReactionChart from '@/components/disclosures/PriceReactionChart';
import WinRateCard from '@/components/disclosures/WinRateCard';
import SimilarEvents from '@/components/disclosures/SimilarEvents';
import SectorContext from '@/components/disclosures/SectorContext';
import DataSourceNote from '@/components/DataSourceNote';
import { generateTicker } from '@/lib/generateTicker';

interface Disclosure {
  id: string;
  rcept_no?: string;
  corp_name: string;
  corp_name_en?: string;
  stock_code: string;
  market: string;
  report_name: string;
  report_name_ko?: string;
  summary: string;
  sentiment: string;
  sentiment_score: number;
  importance: string;
  updated_at: string;
  sector?: string;
  sector_en?: string;
  detailed_analysis?: string;
  risk_factors?: string[];
  key_metrics?: string[];
  key_numbers?: Record<string, string> | null;
  event_type?: string | null;
  final_score?: number | null;
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

  const [groupedStocks, setGroupedStocks] = useState<GroupedStock[]>([]);
  const [filteredStocks, setFilteredStocks] = useState<GroupedStock[]>([]);
  const [selectedStock, setSelectedStock] = useState<GroupedStock | null>(null);
  const [selectedDisclosure, setSelectedDisclosure] = useState<Disclosure | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [savedScrollPosition, setSavedScrollPosition] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  // URL에서 즉시 초기화 (effect 지연 없이) — stockCodeParam effect의 race condition 방지
  const [eventFilter, setEventFilter] = useState(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('event') || '' : ''
  );
  const [scoreFilter, setScoreFilter] = useState(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('minScore') || '' : ''
  );
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 10;
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const isBackNavRef = useRef(false); // Back 버튼 클릭 시 스크롤 복원 플래그
  const searchContainerRef = useRef<HTMLDivElement>(null);
  // popstate / useEffect stale closure 방지용 ref
  const selectedStockRef   = useRef<GroupedStock | null>(null);
  const groupedStocksRef   = useRef<GroupedStock[]>([]);
  // router.push/back을 transition으로 감싸 Suspense fallback 깜빡임 방지
  const [, startTransition] = useTransition();
  // 인증 상태 (목록은 공개 — 비로그인도 접근 가능, 상세는 유료만 허용)
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  // 북마크 상태 (disclosure_id Set)
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  // Takeaways 펼치기/접기
  const [takeawaysExpanded, setTakeawaysExpanded] = useState(false);

  // ── 인증 상태 확인 (목록은 공개, 상세 뷰 진입 시만 유료 체크) ──
  useEffect(() => {
    const supabase = getSupabase();

    const checkPlan = async (userId: string, email: string) => {
      setIsLoggedIn(true);
      if (isSuperAdmin(email)) {
        setIsPaid(true);
        setAuthChecked(true);
        return;
      }
      const { data } = await supabase
        .from('users')
        .select('plan, subscription_status')
        .eq('id', userId)
        .single() as { data: { plan: string | null; subscription_status: string | null } | null };

      const paid =
        !!(data?.plan && data.plan !== 'free' && data?.subscription_status === 'active');
      setIsPaid(paid);
      setAuthChecked(true);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (!session?.user) {
          // 비로그인: 목록은 공개이므로 리다이렉트 없음
          setIsLoggedIn(false);
          setIsPaid(false);
          setAuthChecked(true);
          return;
        }
        void checkPlan(session.user.id, session.user.email ?? '');
      }
      if (event === 'SIGNED_OUT') {
        setIsLoggedIn(false);
        setIsPaid(false);
        // 상세 뷰에서 로그아웃 시 → 목록으로
        if (selectedStockRef.current) {
          setSelectedStock(null);
          setSelectedDisclosure(null);
          router.replace('/disclosures');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  // 로그인 + 유료 시 북마크 ID 목록 로드 (ids_only=true → JOIN 없이 빠름)
  useEffect(() => {
    if (!isLoggedIn || !isPaid) return;
    fetch('/api/bookmarks?ids_only=true')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.ids) {
          setBookmarkedIds(new Set(data.ids as string[]));
        }
      })
      .catch(() => {});
  }, [isLoggedIn, isPaid]);

  // URL 파라미터를 수동으로 관리 (useSearchParams 제거 → Suspense fallback 깜빡임 완전 차단)
  const [stockCodeParam, setStockCodeParam]     = useState<string | null>(null);
  const [disclosureParam, setDisclosureParam]   = useState<string | null>(null);
  const [searchQueryParam, setSearchQueryParam] = useState<string | null>(null);

  // 최초 마운트 시 URL에서 파라미터 읽기
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setStockCodeParam(p.get('stock'));
    setDisclosureParam(p.get('disclosure'));
    setSearchQueryParam(p.get('search'));
    // eventFilter / scoreFilter는 useState lazy init에서 이미 설정 — 여기선 생략
  }, []);

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
              sentiment: 'NEUTRAL',
              sentiment_score: 0,
              importance: 'MEDIUM',
              updated_at: result.latest_disclosure.updated_at || result.latest_disclosure.rcept_dt || '',
            }] : [],
            latestImportance: 'MEDIUM',
            hasHighImpact: false,
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

  // ref 동기화 — stale closure 방지
  useEffect(() => { selectedStockRef.current = selectedStock; }, [selectedStock]);
  useEffect(() => { groupedStocksRef.current = groupedStocks; }, [groupedStocks]);
  // 공시 전환 시 Takeaways 접기 초기화
  useEffect(() => { setTakeawaysExpanded(false); }, [selectedDisclosure?.id]);

  // Back 버튼 후 목록 뷰로 돌아왔을 때 스크롤 위치 복원
  useEffect(() => {
    if (!selectedStock && !loading && isBackNavRef.current) {
      isBackNavRef.current = false;
      const pos = savedScrollPosition;
      requestAnimationFrame(() => {
        window.scrollTo({ top: pos, behavior: 'instant' });
      });
    }
  }, [selectedStock, loading, savedScrollPosition]);

  // 페이지/필터 변경 시 새 데이터 로드 (목록 뷰 — 공개)
  useEffect(() => {
    if (stockCodeParam === null && !searchQuery) {
      fetchDisclosures(undefined, currentPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, eventFilter, scoreFilter]);

  // stock 파라미터에 따라 데이터 로드
  // groupedStocksRef 사용으로 stale closure 완전 차단
  // stockCodeParam === null  → ?stock 파라미터 없음 (목록 뷰 — 공개)
  // stockCodeParam === ''    → 빈 stock_code (무시)
  // stockCodeParam === 'XXX' → 상세 뷰 (로그인 + 유료 필요)
  useEffect(() => {
    if (stockCodeParam) {
      // 상세 뷰 진입: 인증 확인 후 처리
      if (!authChecked) return; // auth 로딩 중 → 대기
      if (!isLoggedIn) {
        router.replace(`/login?redirectTo=${encodeURIComponent(`/disclosures?stock=${stockCodeParam}`)}`);
        return;
      }
      if (!isPaid) {
        router.replace('/pricing');
        return;
      }

      const existing = groupedStocksRef.current.find(s => s.stock_code === stockCodeParam);
      if (existing) {
        const targetDisclosure = disclosureParam
          ? existing.disclosures.find(d => d.id === disclosureParam) ?? existing.disclosures[0]
          : existing.disclosures[0];
        setSelectedStock(existing);
        setSelectedDisclosure(targetDisclosure ?? null);
        setLoading(false);
        return;
      }
      fetchDisclosures(stockCodeParam);
    } else if (stockCodeParam === null) {
      // null = ?stock 파라미터 없음 → 목록 뷰 (공개, auth 불필요)
      if (groupedStocksRef.current.length === 0) {
        fetchDisclosures(undefined, currentPage);
      } else {
        setSelectedStock(null);
        setSelectedDisclosure(null);
        setLoading(false);
      }
    }
    // stockCodeParam === '' → 빈 stock_code, 무시 (상태 유지)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockCodeParam, authChecked, isLoggedIn, isPaid]);

  // search 파라미터가 있으면 검색 실행
  useEffect(() => {
    if (searchQueryParam && groupedStocks.length > 0) {
      setSearchQuery(searchQueryParam);
      searchFromServer(searchQueryParam);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQueryParam, groupedStocks.length]);

  // URL 기반 네비게이션
  const navigateToStock = useCallback((stock: GroupedStock) => {
    if (!stock.stock_code) return; // 빈 stock_code는 무시

    // 상세 뷰 진입: 비로그인 → 로그인, 무료 → 업그레이드 유도
    if (!isLoggedIn) {
      router.push(`/login?redirectTo=${encodeURIComponent(`/disclosures?stock=${stock.stock_code}`)}`);
      return;
    }
    if (!isPaid) {
      router.push('/pricing');
      return;
    }

    setSavedScrollPosition(window.scrollY);
    // 상태 즉시 업데이트 → 깜빡임 없이 화면 전환
    setSelectedStock(stock);
    setSelectedDisclosure(stock.disclosures[0] ?? null);
    setStockCodeParam(stock.stock_code);
    setDisclosureParam(null);
    startTransition(() => {
      router.push(`/disclosures?stock=${stock.stock_code}`, { scroll: false });
    });
  }, [router, startTransition, isLoggedIn, isPaid]);

  const navigateToDisclosure = useCallback((disclosure: Disclosure) => {
    setSelectedDisclosure(disclosure);
    setDisclosureParam(disclosure.id);
    const stock = selectedStockRef.current?.stock_code;
    if (stock) {
      startTransition(() => {
        router.push(`/disclosures?stock=${stock}&disclosure=${disclosure.id}`, { scroll: false });
      });
    }
  }, [router, startTransition]);

  const navigateBack = useCallback(() => {
    isBackNavRef.current = true; // 스크롤 복원 트리거
    setSelectedStock(null);
    setSelectedDisclosure(null);
    setStockCodeParam(null);
    setDisclosureParam(null);
    // currentPage 리셋 안 함 → 이전에 보던 페이지 유지
    //
    // ⚠️ router.back() 사용 금지:
    // auth redirect(/login?redirectTo=...)가 history에 쌓여 있어서
    // back() 하면 /login으로 돌아가 세션 초기화처럼 보이는 버그 발생.
    // router.replace()로 명시적 이동 — history 오염 없음.
    startTransition(() => {
      router.replace('/disclosures', { scroll: false });
    });
  }, [router, startTransition]);

  // 필터 변경 핸들러 — page 리셋 + URL 동기화
  const handleFilterChange = useCallback((newEvent: string, newScore: string) => {
    setEventFilter(newEvent);
    setScoreFilter(newScore);
    setCurrentPage(1);
    setGroupedStocks([]);
    setFilteredStocks([]);
    const p = new URLSearchParams(window.location.search);
    if (newEvent) p.set('event', newEvent); else p.delete('event');
    if (newScore) p.set('minScore', newScore); else p.delete('minScore');
    p.delete('stock');
    p.delete('disclosure');
    startTransition(() => {
      router.push(`/disclosures?${p.toString()}`, { scroll: false });
    });
  }, [router, startTransition]);

  // 브라우저 뒤로가기 처리 — URL에서 param 상태 동기화 (useEffect가 나머지 처리)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const stockCode    = params.get('stock');
      const disclosureId = params.get('disclosure');

      setStockCodeParam(stockCode);
      setDisclosureParam(disclosureId);
      setEventFilter(params.get('event') || '');
      setScoreFilter(params.get('minScore') || '');

      // stock이 없으면 목록 뷰로 즉시 전환 (useEffect는 null 판별하므로 여기서도 처리)
      if (!stockCode) {
        setSelectedStock(null);
        setSelectedDisclosure(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // ── auth 대기 중에도 데이터 fetch/렌더는 계속 진행 ──
  // (accessAllowed === null) early return 제거 → fetchDisclosures가 auth와 병렬로 실행됨
  // 인가 실패 시 checkPlan/SIGNED_OUT 핸들러가 router.replace()로 리다이렉트
  // 인가 성공까지 bookmark 상태는 빈 Set → 아이콘 비활성, auth 완료 후 정상화

  async function fetchDisclosures(stockCode?: string, page: number = 1) {
    try {
      setLoading(true);

      // ── 특정 종목 조회 ──
      if (stockCode) {
        const url = `/api/disclosures/latest?stock=${stockCode}`;
        console.log(`🔍 [Disclosures] Fetching stock: ${url}`);
        const response = await fetch(url);
        if (!response.ok) return;

        const data: Disclosure[] = await response.json();
        console.log(`✅ [Disclosures] Got ${data.length} disclosures for ${stockCode}`);

        const stockMap = new Map<string, GroupedStock>();
        data.forEach((disclosure) => {
          const key = disclosure.stock_code || disclosure.corp_name;
          if (stockMap.has(key)) {
            const existing = stockMap.get(key)!;
            existing.disclosures.push(disclosure);
            if (disclosure.importance === 'HIGH') existing.hasHighImpact = true;
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
        const targetStock = grouped.find(s => s.stock_code === stockCode);
        if (targetStock) {
          setSelectedStock(targetStock);
          const targetDisclosure = disclosureParam
            ? targetStock.disclosures.find(d => d.id === disclosureParam)
            : null;
          setSelectedDisclosure(targetDisclosure ?? targetStock.disclosures[0] ?? null);
        }

        // 해당 종목만 merge
        setGroupedStocks(prev => {
          const without = prev.filter(s => s.stock_code !== stockCode);
          return [...without, ...grouped];
        });
        setFilteredStocks(prev => {
          const without = prev.filter(s => s.stock_code !== stockCode);
          return [...without, ...grouped];
        });
        return;
      }

      // ── 전체 목록 조회 (페이지네이션) ──
      const filterParams = new URLSearchParams();
      filterParams.set('page', String(page));
      filterParams.set('pageSize', String(PAGE_SIZE));
      if (eventFilter) filterParams.set('event', eventFilter);
      if (scoreFilter) filterParams.set('minScore', scoreFilter);
      const url = `/api/disclosures/latest?${filterParams.toString()}`;
      console.log(`🔍 [Disclosures] Fetching page ${page}: ${url}`);
      const response = await fetch(url);
      if (!response.ok) return;

      const result = await response.json();
      const data: Disclosure[] = result.disclosures ?? [];
      console.log(`✅ [Disclosures] Got ${data.length} disclosures (page ${page}/${result.totalPages})`);

      // 페이지네이션 상태 업데이트
      setTotalCount(result.total ?? 0);
      setTotalPages(result.totalPages ?? 1);

      // 종목별 그룹화
      const stockMap = new Map<string, GroupedStock>();
      data.forEach((disclosure) => {
        const key = disclosure.stock_code || disclosure.corp_name;
        if (stockMap.has(key)) {
          const existing = stockMap.get(key)!;
          existing.disclosures.push(disclosure);
          if (disclosure.importance === 'HIGH') existing.hasHighImpact = true;
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

    } catch (error) {
      console.error('Failed to fetch disclosures:', error);
    } finally {
      setLoading(false);
    }
  }


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

    // ── Signal 레벨 분류 ──
    const HIGH_SIGNAL_EVENTS = ['CONTRACT', 'BUYBACK', 'DIVIDEND', 'MNA', 'DILUTION', 'EARNINGS', 'LEGAL', 'CAPEX'];
    const SHORT_PRESSURE_EVENTS = ['DILUTION', 'LEGAL', 'MNA'];
    const eventType = selectedDisclosure.event_type ?? '';
    const isHighSignalEvent = HIGH_SIGNAL_EVENTS.includes(eventType);
    // HIGH importance이거나 고시그널 이벤트 타입이면 Full layout
    const isHighSignal = selectedDisclosure.importance === 'HIGH' || isHighSignalEvent;
    const showShortPressure = SHORT_PRESSURE_EVENTS.includes(eventType);

    // ── Low Signal Compact 레이아웃 ──
    if (!isHighSignal) {
      return (
        <div className="bg-gray-950 text-white font-sans min-h-screen">
          <header className="bg-black border-b border-gray-800 sticky top-0 z-40">
            <div className="max-w-full mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button onClick={navigateBack} className="text-gray-400 hover:text-white transition">← Back</button>
                <span className="text-lg font-semibold">Disclosure Detail</span>
              </div>
            </div>
          </header>

          <div className="max-w-2xl mx-auto px-4 py-10">
            {/* 회사 헤더 */}
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-gray-700 rounded-xl flex items-center justify-center text-sm font-bold">
                {generateTicker(selectedStock.corp_name_en)}
              </div>
              <div>
                <h2 className="text-xl font-bold">{selectedStock.corp_name_en || selectedStock.corp_name}</h2>
                <p className="text-sm text-gray-500">{selectedStock.stock_code} · {selectedStock.market}</p>
              </div>
            </div>

            {/* Routine Notice */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs px-2 py-1 rounded bg-gray-800 text-gray-500 font-medium uppercase tracking-wide">
                  Routine Filing
                </span>
                <span className="text-xs text-gray-600">{formatDateTime(selectedDisclosure.updated_at)}</span>
              </div>
              <h3 className="text-base font-semibold text-gray-200 mb-2">
                {selectedDisclosure.report_name}
              </h3>
              {selectedDisclosure.report_name_ko && selectedDisclosure.report_name !== selectedDisclosure.report_name_ko && (
                <p className="text-xs text-gray-600 mb-3">{selectedDisclosure.report_name_ko}</p>
              )}
              <p className="text-sm text-gray-500 italic">
                No material market-moving signal detected for this filing.
              </p>
            </div>

            {/* Summary (있으면 간략 표시) */}
            {selectedDisclosure.summary && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-5">
                <h4 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wide">Filing Summary</h4>
                <p className="text-sm text-gray-400 leading-relaxed">{selectedDisclosure.summary}</p>
              </div>
            )}

            {/* DART 원문 링크 */}
            {selectedDisclosure.rcept_no && (
              <a
                href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${selectedDisclosure.rcept_no}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium py-3 rounded-xl transition"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View Original Filing on DART
              </a>
            )}

            {/* Related Disclosures */}
            {selectedStock.disclosures.length > 1 && (
              <div className="mt-8">
                <h4 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">Other Disclosures</h4>
                <div className="space-y-2">
                  {selectedStock.disclosures.filter(d => d.id !== selectedDisclosure.id).slice(0, 3).map(d => (
                    <button
                      key={d.id}
                      onClick={() => navigateToDisclosure(d)}
                      className="w-full text-left px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg hover:border-gray-600 transition text-sm text-gray-400"
                    >
                      <span className="text-gray-600 text-xs mr-2">{formatDate(d.updated_at)}</span>
                      {d.report_name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // ── Event type 표시 레이블 ──
    const EVENT_LABEL: Record<string, string> = {
      CONTRACT: '🤝 Contract', BUYBACK: '📈 Buyback', DIVIDEND: '💰 Dividend',
      MNA: '🔄 M&A', DILUTION: '⚠️ Dilution', EARNINGS: '📊 Earnings',
      LEGAL: '⚖️ Legal', CAPEX: '🏭 Capex',
    };
    const eventLabel = eventType ? (EVENT_LABEL[eventType] ?? eventType) : null;
    const sentimentArrow = selectedDisclosure.sentiment?.toUpperCase() === 'POSITIVE' ? '↑'
      : selectedDisclosure.sentiment?.toUpperCase() === 'NEGATIVE' ? '↓' : '→';
    const sentimentColor = selectedDisclosure.sentiment?.toUpperCase() === 'POSITIVE' ? 'text-green-400'
      : selectedDisclosure.sentiment?.toUpperCase() === 'NEGATIVE' ? 'text-red-400' : 'text-gray-400';

    return (
      <div className="bg-gray-950 text-white font-sans min-h-screen">
        {/* ── Sticky Header ── */}
        <header className="bg-black/95 border-b border-gray-800 sticky top-0 z-40 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
            <button onClick={navigateBack} className="text-gray-400 hover:text-white transition shrink-0">
              ← Back
            </button>
            <span className="text-sm text-gray-500 truncate hidden sm:block">
              {selectedStock.corp_name_en || selectedStock.corp_name} · {selectedDisclosure.report_name}
            </span>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 py-6">

          {/* ── Signal-first Hero ── */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
            <div className="flex items-start justify-between gap-4">
              {/* 좌: 회사 + 이벤트 */}
              <div className="flex items-start gap-4 min-w-0">
                <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-sm font-bold tracking-tight shrink-0">
                  {generateTicker(selectedStock.corp_name_en)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    {eventLabel && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 uppercase tracking-wide">
                        {eventLabel}
                      </span>
                    )}
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      selectedDisclosure.sentiment?.toUpperCase() === 'POSITIVE'
                        ? 'bg-green-500/15 text-green-400 border border-green-500/40'
                        : selectedDisclosure.sentiment?.toUpperCase() === 'NEGATIVE'
                        ? 'bg-red-500/15 text-red-400 border border-red-500/40'
                        : 'bg-gray-700 text-gray-400'
                    }`}>
                      {sentimentArrow} {selectedDisclosure.sentiment || 'NEUTRAL'}
                    </span>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-gray-800 text-gray-500">
                      {selectedStock.market}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold leading-snug mb-1">
                    {selectedStock.corp_name_en || selectedStock.corp_name}
                    <span className="text-gray-500 font-normal text-base ml-2">{selectedStock.stock_code}</span>
                  </h2>
                  <p className="text-sm text-gray-400 leading-snug">{selectedDisclosure.report_name}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {selectedDisclosure.sector_en || selectedDisclosure.sector || 'Others'} · {formatDateTime(selectedDisclosure.updated_at)}
                  </p>
                </div>
              </div>

              {/* 우: Signal Score */}
              {selectedDisclosure.final_score != null && (
                <div className="text-right shrink-0">
                  <div className={`text-4xl font-black tabular-nums ${
                    selectedDisclosure.final_score >= 70 ? 'text-green-400'
                    : selectedDisclosure.final_score >= 40 ? 'text-yellow-400'
                    : 'text-gray-500'
                  }`}>
                    {selectedDisclosure.final_score}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">Signal Score</div>
                </div>
              )}
            </div>
          </div>

          {/* ── Disclosure History 탭 (사이드바 대체) ── */}
          {selectedStock.disclosures.length > 1 && (
            <div className="mb-6 overflow-x-auto">
              <div className="flex gap-2 pb-1 min-w-max">
                {selectedStock.disclosures.map((d, idx) => {
                  const isActive = d.id === selectedDisclosure.id;
                  const dot = d.sentiment?.toUpperCase() === 'POSITIVE' ? 'bg-green-500'
                    : d.sentiment?.toUpperCase() === 'NEGATIVE' ? 'bg-red-500' : 'bg-gray-500';
                  return (
                    <button
                      key={d.id}
                      onClick={() => navigateToDisclosure(d)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap border transition shrink-0 ${
                        isActive
                          ? 'bg-blue-600 border-blue-500 text-white font-medium'
                          : 'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                      }`}
                    >
                      {!isActive && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />}
                      <span className="text-xs text-gray-500">{formatDate(d.updated_at)}</span>
                      <span className="max-w-[140px] truncate">
                        {(d.report_name || d.report_name_ko || '').substring(0, 30)}
                      </span>
                      {idx === 0 && !isActive && (
                        <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">Latest</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Main Grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 좌: AI Analysis */}
            <div className="lg:col-span-2 space-y-5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-500">AI Analysis</span>
              </div>

              {/* Key Takeaways — 길이 제한 + Show more */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold">Key Takeaways</h3>
                  <span className={`text-lg font-bold ${sentimentColor}`}>{sentimentArrow}</span>
                </div>
                {selectedDisclosure.summary ? (
                  <>
                    <p className={`text-sm text-gray-300 leading-relaxed whitespace-pre-wrap ${!takeawaysExpanded ? 'line-clamp-5' : ''}`}>
                      {selectedDisclosure.summary}
                    </p>
                    {selectedDisclosure.summary.length > 250 && (
                      <button
                        onClick={() => setTakeawaysExpanded(e => !e)}
                        className="mt-2 text-xs text-blue-400 hover:text-blue-300 transition"
                      >
                        {takeawaysExpanded ? '↑ Show less' : '↓ Show more'}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-500 italic">No AI analysis available.</p>
                )}
                <p className="text-xs text-gray-700 mt-3">For informational purposes only. Not investment advice.</p>
              </div>

              {/* Key Numbers — 숫자 인덱스 제외, 최대 4개 */}
              {(() => {
                if (!selectedDisclosure.key_numbers) return null;
                const validEntries = Object.entries(selectedDisclosure.key_numbers)
                  .filter(([k]) => !/^\d+$/.test(k) && k.trim().length > 0)
                  .slice(0, 4);
                if (validEntries.length === 0) return null;
                return (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <h3 className="text-base font-bold mb-3">Key Numbers</h3>
                    <dl className="grid grid-cols-2 gap-3">
                      {validEntries.map(([k, v]) => (
                        <div key={k} className="bg-gray-800/60 rounded-lg px-4 py-3">
                          <dt className="text-xs text-gray-500 mb-1">{k}</dt>
                          <dd className="text-sm font-semibold text-white">{String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              })()}

              {/* Price Reaction Chart */}
              <PriceReactionChart
                stockCode={selectedStock.stock_code}
                disclosureDate={selectedDisclosure.updated_at}
              />

              {/* Similar Past Events */}
              <SimilarEvents
                stockCode={selectedStock.stock_code}
                eventType={eventType || null}
              />


              <DataSourceNote
                source="DART"
                reportName={selectedDisclosure.report_name_ko || selectedDisclosure.report_name}
              />
            </div>

            {/* 우: 사이드 패널 */}
            <div className="space-y-5">
              {/* DART 원문 */}
              {selectedDisclosure.rcept_no && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Source Document</p>
                  <p className="text-sm text-gray-300 font-medium leading-snug mb-1 line-clamp-2">
                    {selectedDisclosure.report_name_ko || selectedDisclosure.report_name}
                  </p>
                  <p className="text-xs text-gray-600 font-mono mb-3">접수번호 {selectedDisclosure.rcept_no}</p>
                  <a
                    href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${selectedDisclosure.rcept_no}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5 rounded-lg transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    DART 원문 보기
                  </a>
                </div>
              )}

              {/* Signal Strength */}
              <SignalStrength
                sentimentScore={selectedDisclosure.sentiment_score ?? 0}
                importance={selectedDisclosure.importance ?? 'MEDIUM'}
              />

              {/* Win Rate (event_type 있을 때만) */}
              {eventType && <WinRateCard eventType={eventType} />}

              {/* Sector Context */}
              <SectorContext stockCode={selectedStock.stock_code} />


              {/* Short Pressure — DILUTION / LEGAL / MNA 에만 */}
              {showShortPressure && (
                <ShortPressure stockCode={selectedStock.stock_code} />
              )}

              {/* Financial YoY */}
              <FinancialRatios
                stockCode={selectedStock.stock_code}
                eventType={null}
                alwaysShow={true}
              />

              {/* Related Disclosures (Full layout 하단 우측) */}
              {selectedStock.disclosures.length > 1 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                    Other Disclosures ({selectedStock.disclosures.length - 1})
                  </h4>
                  <div className="space-y-2">
                    {selectedStock.disclosures
                      .filter(d => d.id !== selectedDisclosure.id)
                      .slice(0, 4)
                      .map(d => (
                        <button
                          key={d.id}
                          onClick={() => navigateToDisclosure(d)}
                          className="w-full text-left px-3 py-2.5 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition group"
                        >
                          <div className="flex items-start gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                              d.sentiment?.toUpperCase() === 'POSITIVE' ? 'bg-green-500'
                              : d.sentiment?.toUpperCase() === 'NEGATIVE' ? 'bg-red-500' : 'bg-gray-500'
                            }`} />
                            <div className="min-w-0">
                              <p className="text-xs text-gray-500 mb-0.5">{formatDate(d.updated_at)}</p>
                              <p className="text-xs text-gray-400 group-hover:text-gray-200 transition leading-snug line-clamp-2">
                                {d.report_name}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
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
                  const stock = groupedStocksRef.current.find(s => s.stock_code === stockCode);
                  if (stock) {
                    navigateToStock(stock);
                  } else {
                    // 현재 페이지에 없는 종목 → stockCodeParam state 업데이트해야 effect 발화
                    setStockCodeParam(stockCode);
                    startTransition(() => {
                      router.push(`/disclosures?stock=${stockCode}`);
                    });
                  }
                }}
                onSearch={(query) => {
                  setSearchQuery(query);
                }}
                isSuperUser={true}
                placeholder="Search company..."
              />
            </div>
            <Link href="/dashboard" className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition">
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
            <h1 className="text-3xl font-bold">All Disclosures</h1>
            <Link
              href="/disclosures/signals"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-[#00D4A6]/30 text-[#00D4A6] bg-[#00D4A6]/8 hover:bg-[#00D4A6]/15 transition-colors font-medium whitespace-nowrap"
            >
              📊 Signal Statistics
            </Link>
          </div>

          {/* ── 필터 바 ── */}
          <div className="flex flex-wrap items-center gap-3 mb-3">
            {/* Event 필터 */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 font-medium">Event</label>
              <select
                value={eventFilter}
                onChange={(e) => handleFilterChange(e.target.value, scoreFilter)}
                className="bg-gray-800 border border-gray-700 text-sm text-gray-200 rounded-lg px-3 py-1.5
                           focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">All</option>
                <option value="EARNINGS">📊 Earnings</option>
                <option value="CONTRACT">🤝 Contract</option>
                <option value="BUYBACK">📈 Buyback</option>
                <option value="DIVIDEND">💰 Dividend</option>
                <option value="MNA">🔄 M&amp;A</option>
                <option value="DILUTION">⚠️ Dilution</option>
                <option value="LEGAL">⚖️ Legal</option>
                <option value="CAPEX">🏭 Capex</option>
              </select>
            </div>

            {/* Score 필터 */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-gray-500 font-medium">Score</label>
              <select
                value={scoreFilter}
                onChange={(e) => handleFilterChange(eventFilter, e.target.value)}
                className="bg-gray-800 border border-gray-700 text-sm text-gray-200 rounded-lg px-3 py-1.5
                           focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
              >
                <option value="">All</option>
                <option value="70">🔥 High (≥70)</option>
                <option value="40">⚡ Medium+ (≥40)</option>
              </select>
            </div>

            {/* 필터 초기화 버튼 */}
            {(eventFilter || scoreFilter) && (
              <button
                onClick={() => handleFilterChange('', '')}
                className="text-xs text-gray-500 hover:text-gray-300 underline transition"
              >
                Clear filters
              </button>
            )}
          </div>

          <p className="text-gray-400 h-6 text-sm">
            {isSearching ? (
              'Searching...'
            ) : searchQuery ? (
              `${filteredStocks.length} results for "${searchQuery}"`
            ) : (
              `${totalCount > 0 ? `${totalCount} companies` : `${filteredStocks.length} companies`} with recent announcements`
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
            {filteredStocks.filter(stock => stock.stock_code).map((stock) => {
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
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xs tracking-tight text-white ${stock.hasHighImpact ? 'bg-orange-600' : 'bg-blue-600'}`}>
                        {generateTicker(stock.corp_name_en)}
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
                      <div className="text-xs text-gray-500 mb-1">{getTimeAgo(latestDisclosure.updated_at)}</div>
                      <span className={`inline-block text-xs px-3 py-1 rounded-full font-medium ${getImpactColor(stock.latestImportance, stock.hasHighImpact)}`}>
                        {disclosureCount} disclosure{disclosureCount > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <h5 className="font-medium mb-2">{latestDisclosure.report_name}</h5>
                  {latestDisclosure.report_name_ko && latestDisclosure.report_name !== latestDisclosure.report_name_ko && (
                    <p className="text-xs text-gray-500 mb-1">{latestDisclosure.report_name_ko}</p>
                  )}

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
                    <div className="flex items-center gap-2">
                      {/* 클릭이 부모(navigateToStock)로 전파되지 않도록 감싸기 */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <BookmarkButton
                          disclosureId={latestDisclosure.id}
                          initialBookmarked={bookmarkedIds.has(latestDisclosure.id)}
                          isLoggedIn={isLoggedIn && isPaid}
                          size="sm"
                        />
                      </div>
                      <span className="text-blue-500 text-sm font-medium">
                        View {disclosureCount > 1 ? 'All' : ''} →
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 페이지네이션 (검색 중이 아닐 때만, 전체 목록 뷰에서만) */}
        {!searchQuery && !loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-10 pb-4">
            {/* 이전 버튼 */}
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 rounded-lg text-sm font-medium transition
                bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white
                disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Prev
            </button>

            {/* 페이지 번호들 */}
            {(() => {
              const pages: (number | 'ellipsis')[] = [];
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                pages.push(1);
                if (currentPage > 3) pages.push('ellipsis');
                for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                  pages.push(i);
                }
                if (currentPage < totalPages - 2) pages.push('ellipsis');
                pages.push(totalPages);
              }
              return pages.map((p, idx) =>
                p === 'ellipsis' ? (
                  <span key={`e-${idx}`} className="px-2 text-gray-600 text-sm">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition ${
                      p === currentPage
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                )
              );
            })()}

            {/* 다음 버튼 */}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 rounded-lg text-sm font-medium transition
                bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white
                disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        )}
        {/* 외부 데이터 소스 고지 */}
        <ExternalDataNotice className="mt-8 pb-2" />
      </main>
    </div>
  );
}

export default function DisclosuresPage() {
  return <DisclosuresContent />;
}
