'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from "../lib/supabase";
import StockSentiment from '../components/StockSentiment';

function DisclosureDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('id');

  const [indices, setIndices] = useState<any[]>([]);
  const [disclosures, setDisclosures] = useState<any[]>([]);
  const [stockInfo, setStockInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 🔄 선택된 공시 새로고침 함수
  const refreshSelectedItem = async (id: string) => {
    try {
      const { data } = await supabase
        .from('disclosure_insights')
        .select('*')
        .eq('id', id)
        .single();
      
      if (data) {
        setDisclosures(prev => 
          prev.map(item => item.id.toString() === id ? data : item)
        );
        
        if (data.stock_code) {
          fetchStockInfo(data.stock_code);
        }
      }
    } catch (error) {
      console.error('Failed to refresh item:', error);
    }
  };

  // 📊 종목 상세 정보 로드 (companies 테이블)
  const fetchStockInfo = async (stockCode: string) => {
    try {
      const { data } = await supabase
        .from('companies')
        .select('*')
        .eq('stock_code', stockCode)
        .single();
      
      if (data) {
        setStockInfo(data);
      }
    } catch (error) {
      console.error('Failed to fetch stock info:', error);
      setStockInfo(null);
    }
  };

  // 초기 데이터 로드 (지수 + 공시 목록)
  useEffect(() => {
    async function fetchData() {
      try {
        const [indicesRes, disclosuresRes] = await Promise.all([
          supabase.from('market_indices').select('*').order('symbol', { ascending: true }),
          supabase.from('disclosure_insights')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50)
        ]);
        
        setIndices(indicesRes.data || []);
        setDisclosures(disclosuresRes.data || []);
      } catch (error) {
        console.error('❌ 데이터 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // 선택된 공시 변경 시 종목 정보 로드 및 자동 새로고침 타이머
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

    // 분석 미완료 시 5초마다 새로고침
    const isAnalyzing = selectedItem.analysis_status !== 'completed' || 
                        !selectedItem.ai_summary || 
                        !selectedItem.sentiment;

    if (isAnalyzing) {
      const interval = setInterval(() => {
        refreshSelectedItem(selectedId);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedId, disclosures]);

  const selectedItem = disclosures.find(item => item.id.toString() === selectedId);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white font-black italic">
        LOADING KMI INSIGHT...
      </div>
    );
  }

  // 🎯 1. 상세 보기 화면
  if (selectedItem) {
    const isAnalysisComplete = selectedItem.analysis_status === 'completed' && selectedItem.ai_summary;
    const priceChange = stockInfo ? stockInfo.close_price - stockInfo.open_price : 0;
    const isPositive = priceChange >= 0;
    const changeRate = stockInfo?.open_price > 0 
      ? ((priceChange / stockInfo.open_price) * 100).toFixed(2)
      : '0.00';

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-black dark:to-zinc-900 text-slate-900">
        <nav className="sticky top-0 z-50 p-6 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-200 dark:border-white/5">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 rounded-full shadow-lg text-sm font-black text-white hover:bg-blue-700 transition-all uppercase tracking-widest"
          >
            ← 목록으로
          </button>
        </nav>

        <main className="max-w-6xl mx-auto px-6 py-12">
          {/* 공시 헤더 */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-blue-600 text-xs font-black uppercase tracking-[0.3em] bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-full">
                {selectedItem.corp_name}
              </span>
              {selectedItem.stock_code && (
                <span className="text-slate-500 text-xs font-mono font-bold">{selectedItem.stock_code}</span>
              )}
            </div>
            <h1 className="text-4xl md:text-6xl font-black leading-tight dark:text-white tracking-tighter">
              {selectedItem.report_nm}
            </h1>
            <p className="text-slate-500 mt-4 font-medium">
              📅 {new Date(selectedItem.created_at).toLocaleString('ko-KR')}
            </p>
          </div>

          {/* AI 분석 리포트 섹션 */}
          <section className="mb-12">
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-[3rem] p-10 md:p-14 shadow-2xl text-white border border-white/10">
              <div className="mb-12 flex flex-col md:flex-row justify-between md:items-end gap-4">
                <div>
                  <h2 className="text-sm font-black text-blue-400 uppercase tracking-[0.3em] mb-2">AI Analysis Report</h2>
                  <p className="text-slate-400 text-xs">Powered by Groq LLaMA 3.3 70B</p>
                </div>
                {isAnalysisComplete && (
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-black mb-2 uppercase">Impact Intensity</p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-4xl font-black text-blue-400">{(selectedItem.sentiment_score * 100).toFixed(0)}</p>
                      <span className="text-xl text-slate-500">/100</span>
                    </div>
                  </div>
                )}
              </div>
              
              {isAnalysisComplete ? (
                <StockSentiment 
                  sentiment={selectedItem.sentiment} 
                  sentiment_score={selectedItem.sentiment_score} 
                  ai_summary={selectedItem.ai_summary} 
                />
              ) : (
                <div className="bg-white/5 rounded-3xl p-10 border border-dashed border-white/20 text-center">
                  <div className="flex flex-col items-center gap-6">
                    <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-blue-400 font-black text-lg">AI가 공시를 분석하고 있습니다...</p>
                    <button onClick={() => refreshSelectedItem(selectedId!)} className="px-8 py-3 bg-blue-600 rounded-full text-sm font-black shadow-lg">
                      🔄 지금 새로고침
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-12 pt-8 border-t border-white/10 flex justify-between items-center">
                <span className={`px-4 py-1 rounded-full text-sm font-black ${selectedItem.importance === 'HIGH' ? 'bg-rose-500' : 'bg-blue-500'} text-white`}>
                  {selectedItem.importance || 'MEDIUM'}
                </span>
                <a 
                  href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${selectedItem.rcept_no}`} 
                  target="_blank" className="text-sm font-black text-blue-400 hover:underline"
                >
                  DART 원문 보기 ↗
                </a>
              </div>
            </div>
          </section>

          {/* 주가 정보 섹션 */}
          {stockInfo && (
            <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-gray-200 dark:border-white/5 shadow-lg">
                <p className="text-xs font-black text-slate-500 uppercase mb-4">Current Price</p>
                <p className="text-4xl font-black dark:text-white">{stockInfo.close_price?.toLocaleString()}원</p>
                <div className={`mt-2 font-bold ${isPositive ? 'text-rose-600' : 'text-blue-600'}`}>
                  {isPositive ? '▲' : '▼'} {Math.abs(Number(changeRate))}%
                </div>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl border border-gray-200 dark:border-white/5 shadow-lg">
                <p className="text-xs font-black text-slate-500 uppercase mb-4">Market Cap</p>
                <p className="text-4xl font-black dark:text-white">{(stockInfo.market_cap / 100000000).toFixed(0)}억원</p>
              </div>
              <div className="bg-blue-600 p-8 rounded-3xl shadow-lg text-white">
                <p className="text-xs font-black uppercase mb-4 opacity-80">Sector</p>
                <p className="text-2xl font-black">{stockInfo.sector || 'N/A'}</p>
                <p className="mt-4 font-mono text-sm">{stockInfo.stock_code}</p>
              </div>
            </section>
          )}
        </main>
      </div>
    );
  }

  // 📋 2. 메인 대시보드 리스트 화면
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black">
      <nav className="sticky top-0 z-50 bg-white/95 dark:bg-zinc-900/95 border-b border-gray-200 dark:border-white/5 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-3xl font-black text-blue-600 tracking-tighter">KMI INSIGHT</h1>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-bold dark:text-white">LIVE UPDATE</span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Market Pulse (지수) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {indices.map((idx) => (
            <div key={idx.symbol} className="bg-white dark:bg-zinc-900 p-8 rounded-3xl shadow-lg border-2 border-transparent hover:border-blue-500 transition-all">
              <p className="text-xs font-black text-blue-500 uppercase mb-2">{idx.name || idx.symbol}</p>
              <p className="text-4xl font-black dark:text-white mb-2">{idx.price}</p>
              <p className={`text-sm font-bold ${idx.change_rate >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                {idx.change_rate >= 0 ? '▲' : '▼'} {Math.abs(idx.change_rate).toFixed(2)}%
              </p>
            </div>
          ))}
        </div>

        {/* 공시 리스트 */}
        <div className="flex items-center gap-4 mb-10">
          <h2 className="text-3xl font-black uppercase dark:text-white">Live Disclosures</h2>
          <span className="bg-blue-600 text-white text-[10px] px-2 py-1 rounded-md">{disclosures.length}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {disclosures.map((item) => (
            <div 
              key={item.id} 
              onClick={() => router.push(`?id=${item.id}`)}
              className="cursor-pointer group p-8 rounded-3xl bg-white dark:bg-zinc-900 border-2 border-gray-100 dark:border-white/5 hover:border-blue-500 transition-all shadow-md hover:shadow-2xl"
            >
              <div className="flex justify-between items-start mb-6">
                <span className="text-xs font-black text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full uppercase">
                  {item.corp_name}
                </span>
                {item.analysis_status !== 'completed' && (
                  <span className="flex items-center gap-1.5 text-[10px] font-black text-amber-600 animate-pulse">
                    ANALYZING...
                  </span>
                )}
              </div>
              <h3 className="text-xl font-black dark:text-white line-clamp-3 mb-8 group-hover:text-blue-600 transition-colors">
                {item.report_nm}
              </h3>
              <div className="pt-6 border-t border-gray-50 dark:border-white/5 flex justify-between items-center">
                <p className="text-[10px] text-slate-400 font-bold uppercase">
                  {new Date(item.created_at).toLocaleDateString()}
                </p>
                {item.sentiment && (
                  <span className={`text-[10px] font-black px-3 py-1 rounded-full ${item.sentiment === 'POSITIVE' ? 'bg-emerald-500' : 'bg-rose-500'} text-white`}>
                    {item.sentiment}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white">LOADING...</div>}>
      <DisclosureDashboard />
    </Suspense>
  );
}