'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSupabase } from "@/lib/supabase/client";

function DisclosureDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('id');
  const selectedCorpCode = searchParams.get('corp');

  const [indices, setIndices] = useState<any[]>([]);
  const [disclosures, setDisclosures] = useState<any[]>([]);
  const [groupedDisclosures, setGroupedDisclosures] = useState<any[]>([]);
  const [stockInfo, setStockInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const scrollPositionRef = useRef(0);

  // ✅ 스크롤 위치 저장 (문제 4 해결)
  useEffect(() => {
    const handleScroll = () => {
      scrollPositionRef.current = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ✅ 종목별 공시 그룹핑 (문제 1 해결)
  const groupDisclosuresByCompany = (disclosuresList: any[]) => {
    const grouped = disclosuresList.reduce((acc: any, disclosure: any) => {
      const key = disclosure.corp_name || 'Unknown';
      if (!acc[key]) {
        acc[key] = {
          corp_name: disclosure.corp_name,
          stock_code: disclosure.stock_code,
          disclosures: [],
          latest_created_at: disclosure.created_at,
          has_pending: false,
          has_high_importance: false
        };
      }
      acc[key].disclosures.push(disclosure);
      
      if (new Date(disclosure.created_at) > new Date(acc[key].latest_created_at)) {
        acc[key].latest_created_at = disclosure.created_at;
      }
      
      if (disclosure.analysis_status !== 'completed') {
        acc[key].has_pending = true;
      }
      if (disclosure.importance === 'HIGH') {
        acc[key].has_high_importance = true;
      }
      
      return acc;
    }, {});

    return Object.values(grouped).sort((a: any, b: any) => 
      new Date(b.latest_created_at).getTime() - new Date(a.latest_created_at).getTime()
    );
  };

  // ✅ 무한 로딩 방지 (문제 2 해결)
  const refreshSelectedItem = async (id: string) => {
    try {
      const supabase = getSupabase();
      const { data } = await supabase
        .from('disclosure_insights')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (data) {
        setDisclosures(prev =>
          prev.map(item => item.id.toString() === id ? data as any : item)
        );

        if ((data as any).stock_code) {
          fetchStockInfo((data as any).stock_code);
        }
      }
    } catch (error) {
      console.error('Failed to refresh item:', error);
    }
  };

  // ✅ 종목 정보 로드 개선 (문제 3 해결)
  const fetchStockInfo = async (stockCode: string) => {
    if (!stockCode || stockCode === 'null' || stockCode === '') {
      console.log('유효하지 않은 종목 코드');
      setStockInfo(null);
      return;
    }

    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('stock_code', stockCode)
        .maybeSingle();
      
      if (error) {
        console.log(`종목 정보 없음: ${stockCode}`);
        setStockInfo(null);
        return;
      }
      
      if (data) {
        setStockInfo(data);
        console.log(`✅ 종목 정보 로드: ${(data as any).corp_name}`);
      }
    } catch (error) {
      console.error('Failed to fetch stock info:', error);
      setStockInfo(null);
    }
  };

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = getSupabase();
        const [indicesRes, disclosuresRes] = await Promise.all([
          supabase.from('market_indices').select('*').order('symbol', { ascending: true }),
          supabase.from('disclosure_insights')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100)
        ]);
        
        setIndices(indicesRes.data || []);
        const disclosuresList = disclosuresRes.data || [];
        setDisclosures(disclosuresList);
        
        const grouped = groupDisclosuresByCompany(disclosuresList);
        setGroupedDisclosures(grouped);
        
        console.log(`✅ ${disclosuresList.length}개 공시 (${grouped.length}개 종목)`);
        
      } catch (error) {
        console.error('❌ 데이터 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // ✅ 자동 새로고침 제한 (문제 2, 5 해결)
  useEffect(() => {
    if (!selectedId) {
      setStockInfo(null);
      return;
    }

    const selectedItem = disclosures.find(item => item.id.toString() === selectedId);
    if (!selectedItem) return;

    if (selectedItem.stock_code) {
      fetchStockInfo(selectedItem.stock_code);
    }

    const isAnalyzing = selectedItem.analysis_status !== 'completed' || 
                       !selectedItem.ai_summary || 
                       !selectedItem.sentiment || 
                       typeof selectedItem.sentiment_score !== 'number';

    if (isAnalyzing && selectedItem.analysis_status !== 'failed') {
      let refreshCount = 0;
      const maxRefreshCount = 10; // 최대 10회 (50초)

      const interval = setInterval(() => {
        refreshCount++;
        console.log(`🔄 자동 새로고침 (${refreshCount}/${maxRefreshCount})`);
        
        if (refreshCount >= maxRefreshCount) {
          console.log('⏹️ 최대 새로고침 횟수 도달 - 페이지 유지');
          clearInterval(interval);
        } else {
          refreshSelectedItem(selectedId);
        }
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [selectedId, disclosures]);

  const selectedItem = disclosures.find(item => item.id.toString() === selectedId);
  const selectedCorpDisclosures = selectedCorpCode 
    ? disclosures.filter(d => d.stock_code === selectedCorpCode || d.corp_name === selectedCorpCode)
    : [];

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white font-black italic">
        LOADING KMI INSIGHT...
      </div>
    );
  }

  // 🎯 공시 상세 화면
  if (selectedItem) {
    const isAnalysisComplete = selectedItem.analysis_status === 'completed' &&
                               selectedItem.ai_summary && 
                               selectedItem.sentiment && 
                               typeof selectedItem.sentiment_score === 'number';

    const isFailed = selectedItem.analysis_status === 'failed';

    const priceChange = stockInfo ? stockInfo.close_price - stockInfo.open_price : 0;
    const isPositive = priceChange >= 0;
    const changeRate = stockInfo?.open_price > 0 
      ? ((priceChange / stockInfo.open_price) * 100).toFixed(2)
      : '0.00';

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-black dark:to-zinc-900">
        {/* ✅ 네비게이션 - 고정 해제, 작은 버튼 (문제 4 해결) */}
        <nav className="p-4 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5">
          <button 
            onClick={() => {
              router.push('/');
              setTimeout(() => {
                window.scrollTo(0, scrollPositionRef.current);
              }, 100);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-full text-xs font-bold text-white hover:bg-blue-700 transition-all active:scale-95"
          >
            <span>←</span> 목록으로
          </button>
        </nav>

        <main className="max-w-6xl mx-auto px-6 py-8">
          {/* ✅ 종목명 + 코드 통합 표시 (문제 6 해결) */}
          <div className="mb-10">
            <div className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 px-6 py-3 rounded-2xl mb-4 shadow-sm">
              <span className="text-lg font-black text-blue-600 dark:text-blue-400">
                {selectedItem.corp_name}
              </span>
              {selectedItem.stock_code && (
                <span className="text-sm font-mono font-bold text-blue-500 dark:text-blue-300 bg-white dark:bg-blue-950 px-3 py-1.5 rounded-full border border-blue-200 dark:border-blue-700">
                  {selectedItem.stock_code}
                </span>
              )}
            </div>
            <h1 className="text-3xl md:text-5xl font-black leading-tight dark:text-white">
              {selectedItem.report_nm}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-3 text-sm">
              📅 {new Date(selectedItem.created_at).toLocaleString('ko-KR')}
            </p>
          </div>

          {/* AI 분석 결과 */}
          <section className="mb-10">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 md:p-12 shadow-xl text-white">
              <div className="mb-10 flex flex-col md:flex-row justify-between md:items-end gap-4">
                <div>
                  <h2 className="text-xs font-black text-blue-400 uppercase tracking-wider mb-2">
                    AI Analysis Report
                  </h2>
                  <p className="text-slate-400 text-xs">Powered by Groq LLaMA 3.3 70B</p>
                </div>
                {isAnalysisComplete && (
                  <div className="text-right">
                    <p className="text-[9px] text-slate-500 font-black uppercase mb-1">Impact</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-black text-blue-400">
                        {(selectedItem.sentiment_score * 100).toFixed(0)}
                      </p>
                      <span className="text-lg text-slate-500">/100</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* ✅ 분석 완료 / 실패 / 진행중 처리 (문제 2 해결) */}
              {isAnalysisComplete ? (
                <div className="bg-slate-800/50 rounded-3xl p-8 border border-slate-700/50">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="text-4xl">
                      {selectedItem.sentiment === 'POSITIVE' ? '😊' :
                       selectedItem.sentiment === 'NEGATIVE' ? '😟' : '😐'}
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-white">
                        {selectedItem.sentiment || 'NEUTRAL'}
                      </div>
                      <div className="text-slate-400">
                        Score: {selectedItem.sentiment_score || 0}/100
                      </div>
                    </div>
                  </div>
                  <div className="text-slate-300 whitespace-pre-wrap">
                    {selectedItem.ai_summary || 'No summary available'}
                  </div>
                </div>
              ) : isFailed ? (
                <div className="bg-rose-500/10 rounded-3xl p-8 border border-rose-500/20 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="text-6xl">⚠️</div>
                    <p className="text-rose-400 font-black text-lg">분석 실패</p>
                    <p className="text-slate-400 text-sm">
                      AI 분석 중 오류가 발생했습니다. 잠시 후 자동으로 재시도됩니다.
                    </p>
                    <button
                      onClick={() => refreshSelectedItem(selectedId!)}
                      className="px-6 py-2 bg-rose-600 hover:bg-rose-700 rounded-full text-sm font-bold transition-all active:scale-95"
                    >
                      수동 재시도
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-white/5 rounded-3xl p-8 border border-dashed border-white/20 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-blue-400 font-bold">AI가 공시를 분석하고 있습니다</p>
                    <p className="text-slate-500 text-sm">잠시만 기다려주세요 (최대 50초 대기)</p>
                    <button
                      onClick={() => refreshSelectedItem(selectedId!)}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-full text-sm font-bold transition-all active:scale-95"
                    >
                      🔄 새로고침
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-10 pt-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-wrap gap-4">
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Importance</span>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                      selectedItem.importance === 'HIGH' ? 'bg-rose-500 text-white' :
                      selectedItem.importance === 'MEDIUM' ? 'bg-blue-500 text-white' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {selectedItem.importance || 'MEDIUM'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-500 font-bold uppercase block mb-1">Status</span>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                      isAnalysisComplete ? 'bg-emerald-500 text-white' :
                      isFailed ? 'bg-rose-500 text-white' :
                      'bg-amber-500 text-white'
                    }`}>
                      {isAnalysisComplete ? '완료' : isFailed ? '실패' : '처리중'}
                    </span>
                  </div>
                </div>
                <a 
                  href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${selectedItem.rcept_no}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-bold text-blue-400 hover:text-blue-300 bg-white/5 px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 transition-all"
                >
                  DART 원문 보기
                  <span className="transition-transform group-hover:translate-x-1">↗</span>
                </a>
              </div>
            </div>
          </section>

          {/* ✅ 종목 정보 표시 (문제 3, 7 해결) */}
          {stockInfo ? (
            <section>
              <h2 className="text-2xl font-black mb-6 dark:text-white flex items-center gap-3">
                <span className="w-2 h-8 bg-emerald-600 rounded-full"></span>
                종목 정보
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 가격 카드 */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-200 dark:border-white/5 shadow-lg hover:shadow-xl transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Current Price</span>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                      stockInfo.market_type === 'KOSPI' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 
                      stockInfo.market_type === 'KOSDAQ' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 
                      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {stockInfo.market_type}
                    </span>
                  </div>
                  
                  <p className="text-4xl font-black dark:text-white mb-2">
                    {stockInfo.close_price?.toLocaleString()}
                    <span className="text-sm text-slate-400 ml-1">원</span>
                  </p>
                  
                  <div className={`inline-flex items-center gap-2 text-sm font-bold px-3 py-1.5 rounded-full ${
                    isPositive ? 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'
                  }`}>
                    <span>{isPositive ? '▲' : '▼'}</span>
                    <span>{Math.abs(Number(changeRate))}%</span>
                    <span className="text-xs opacity-75">
                      ({isPositive ? '+' : ''}{priceChange.toLocaleString()})
                    </span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/5 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">시가</p>
                      <p className="font-bold dark:text-white">{stockInfo.open_price?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">종가</p>
                      <p className="font-bold dark:text-white">{stockInfo.close_price?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">고가</p>
                      <p className="font-bold text-rose-600">{stockInfo.high_price?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">저가</p>
                      <p className="font-bold text-blue-600">{stockInfo.low_price?.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                {/* 거래 정보 카드 */}
                <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-200 dark:border-white/5 shadow-lg hover:shadow-xl transition-all">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase block mb-4">Trading Info</span>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">거래량</p>
                      <p className="text-2xl font-black dark:text-white">
                        {(stockInfo.volume / 10000).toFixed(1)}
                        <span className="text-sm text-slate-400 ml-1">만주</span>
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">거래대금</p>
                      <p className="text-2xl font-black text-emerald-600">
                        {(stockInfo.trade_value / 100000000).toFixed(0)}
                        <span className="text-sm ml-1">억원</span>
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">상장주식수</p>
                      <p className="text-lg font-black dark:text-white">
                        {stockInfo.listed_shares ? (stockInfo.listed_shares / 10000).toFixed(0) : 'N/A'}
                        <span className="text-xs text-slate-400 ml-1">만주</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* 시가총액 카드 */}
                <div className="bg-gradient-to-br from-blue-600 via-blue-500 to-purple-600 p-6 rounded-3xl shadow-xl text-white hover:shadow-2xl transition-all">
                  <span className="text-xs font-bold uppercase tracking-widest opacity-80 block mb-6">
                    Market Capitalization
                  </span>
                  
                  <div className="mb-6">
                    <p className="text-5xl font-black mb-1">
                      {(stockInfo.market_cap / 100000000).toFixed(0)}
                    </p>
                    <p className="text-xl font-bold opacity-90">억원</p>
                  </div>

                  <div className="pt-4 border-t border-white/20 space-y-3">
                    <div>
                      <p className="text-xs opacity-75 mb-1">종목코드</p>
                      <p className="text-xl font-black font-mono">{stockInfo.stock_code}</p>
                    </div>

                    {/* ✅ sector 정보 표시 (문제 7 해결) */}
                    {stockInfo.sector && stockInfo.sector !== 'N/A' && stockInfo.sector !== '기타' && (
                      <div>
                        <p className="text-xs opacity-75 mb-1">업종</p>
                        <p className="text-sm font-bold">{stockInfo.sector}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-center">
                <p className="text-xs text-slate-400">
                  종목 정보 업데이트: {new Date(stockInfo.updated_at).toLocaleString('ko-KR')}
                </p>
              </div>
            </section>
          ) : selectedItem.stock_code ? (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-3xl p-6 text-center">
              <p className="text-amber-800 dark:text-amber-200 font-bold">
                ⏳ 종목 정보를 불러오는 중입니다... (종목코드: {selectedItem.stock_code})
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                KRX 데이터베이스에 해당 종목이 없을 수 있습니다.
              </p>
            </div>
          ) : (
            <div className="bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-center">
              <p className="text-slate-600 dark:text-slate-400 font-bold">
                ℹ️ 이 공시는 종목 코드가 없어 종목 정보를 표시할 수 없습니다
              </p>
            </div>
          )}
        </main>
      </div>
    );
  }

  // 🆕 종목별 공시 목록 화면 (여러 공시)
  if (selectedCorpCode && selectedCorpDisclosures.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-black dark:to-zinc-900">
        <nav className="p-4 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5">
          <button 
            onClick={() => {
              router.push('/');
              setTimeout(() => {
                window.scrollTo(0, scrollPositionRef.current);
              }, 100);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-full text-xs font-bold text-white hover:bg-blue-700 transition-all active:scale-95"
          >
            <span>←</span> 목록으로
          </button>
        </nav>

        <main className="max-w-4xl mx-auto px-6 py-8">
          <div className="mb-8">
            <div className="inline-flex items-center gap-3 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 px-6 py-3 rounded-2xl mb-4">
              <span className="text-xl font-black text-blue-600 dark:text-blue-400">
                {selectedCorpDisclosures[0].corp_name}
              </span>
              {selectedCorpDisclosures[0].stock_code && (
                <span className="text-sm font-mono font-bold text-blue-500 dark:text-blue-300 bg-white dark:bg-blue-950 px-3 py-1.5 rounded-full">
                  {selectedCorpDisclosures[0].stock_code}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black dark:text-white">
              공시 목록 ({selectedCorpDisclosures.length}건)
            </h1>
          </div>

          <div className="space-y-4">
            {selectedCorpDisclosures.map((disclosure) => {
              const isComplete = disclosure.analysis_status === 'completed';
              
              return (
                <div
                  key={disclosure.id}
                  onClick={() => router.push(`?id=${disclosure.id}`)}
                  className="cursor-pointer bg-white dark:bg-zinc-900 p-6 rounded-2xl border-2 border-gray-200 dark:border-white/5 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-bold dark:text-white flex-1 line-clamp-2">
                      {disclosure.report_nm}
                    </h3>
                    {!isComplete && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full ml-4">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                        분석중
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-sm text-slate-500">
                      {new Date(disclosure.created_at).toLocaleString('ko-KR')}
                    </p>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      disclosure.importance === 'HIGH' ? 'bg-rose-500 text-white' :
                      disclosure.importance === 'MEDIUM' ? 'bg-blue-500 text-white' :
                      'bg-slate-300 text-slate-700'
                    }`}>
                      {disclosure.importance || 'LOW'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  // 📋 메인 화면
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-black dark:to-zinc-900">
      <nav className="sticky top-0 z-50 w-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-gray-200 dark:border-white/5 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-blue-600 tracking-tight">KMI INSIGHT</h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">
              AI Financial Intelligence Platform
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">LIVE</span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Market Pulse */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1 h-10 bg-gradient-to-b from-blue-600 to-blue-400 rounded-full"></div>
            <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight">Market Pulse</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {indices.map((idx) => {
              const isPositive = idx.change_rate >= 0;
              const displayName = idx.name || idx.symbol;
              
              return (
                <div 
                  key={idx.symbol} 
                  className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border-2 border-gray-200 dark:border-white/5 shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-3">
                    {displayName}
                  </span>
                  <p className="text-4xl font-black dark:text-white tracking-tight mb-3">
                    {idx.price}
                  </p>
                  
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold ${
                      isPositive 
                        ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400' 
                        : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      <span className="mr-1">{isPositive ? '▲' : '▼'}</span>
                      {Math.abs(idx.change_rate).toFixed(2)}%
                    </div>
                    
                    {idx.change_value && (
                      <span className={`text-sm font-bold ${
                        isPositive ? 'text-rose-600 dark:text-rose-400' : 'text-blue-600 dark:text-blue-400'
                      }`}>
                        {isPositive ? '+' : ''}{idx.change_value}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-[10px] text-slate-400 mt-3 font-medium">
                    Updated: {new Date(idx.updated_at).toLocaleTimeString('ko-KR')}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ✅ Live Disclosures - 종목별 그룹핑 (문제 1 해결) */}
        <section>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-1 h-10 bg-gradient-to-b from-emerald-600 to-emerald-400 rounded-full"></div>
            <h2 className="text-2xl font-black dark:text-white uppercase tracking-tight">Live Disclosures</h2>
            <div className="flex items-center gap-2 ml-3">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {groupedDisclosures.length}개 종목
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groupedDisclosures.map((group: any) => {
              const firstDisclosure = group.disclosures[0];
              const disclosureCount = group.disclosures.length;
              
              return (
                <div 
                  key={group.corp_name}
                  onClick={() => {
                    if (disclosureCount === 1) {
                      router.push(`?id=${firstDisclosure.id}`);
                    } else {
                      router.push(`?corp=${group.stock_code || group.corp_name}`);
                    }
                  }}
                  className="cursor-pointer group bg-white dark:bg-zinc-900 p-6 rounded-3xl border-2 border-gray-200 dark:border-white/5 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
                >
                  {/* 배경 효과 */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 to-purple-500/0 group-hover:from-blue-500/5 group-hover:to-purple-500/5 rounded-3xl transition-all duration-300"></div>
                  
                  <div className="relative">
                    {/* ✅ 종목명 + 코드 통합 표시 (문제 6 해결) */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 px-4 py-2 rounded-xl mb-2">
                          <span className="text-sm font-black text-blue-600 dark:text-blue-400">
                            {group.corp_name}
                          </span>
                          {group.stock_code && (
                            <span className="text-xs font-mono font-bold text-blue-500 dark:text-blue-300 bg-white dark:bg-blue-950 px-2 py-0.5 rounded-md">
                              {group.stock_code}
                            </span>
                          )}
                        </div>
                        
                        {/* 공시 개수 배지 */}
                        {disclosureCount > 1 && (
                          <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-black rounded-full">
                            {disclosureCount}개 공시
                          </span>
                        )}
                      </div>
                      
                      {/* 분석 상태 배지 */}
                      {group.has_pending && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-[10px] font-black rounded-full">
                          <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                          분석중
                        </span>
                      )}
                    </div>
                    
                    {/* 공시 제목 (대표 공시) */}
                    <h3 className="text-base font-black leading-tight mb-4 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2 min-h-[3rem]">
                      {firstDisclosure.report_nm}
                    </h3>
                    
                    {/* 하단 정보 */}
                    <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-white/5">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">
                        {new Date(group.latest_created_at).toLocaleString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                      
                      {/* 중요도 배지 */}
                      {group.has_high_importance && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white">
                          HIGH
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center text-white font-black italic tracking-widest">
        INITIALIZING...
      </div>
    }>
      <DisclosureDashboard />
    </Suspense>
  );
}