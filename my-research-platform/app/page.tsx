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
  const [loading, setLoading] = useState(true);

  // 🔄 선택된 항목을 실시간으로 새로고침하는 함수 (기업 정보 포함)
  const refreshSelectedItem = async (id: string) => {
    try {
      const { data } = await supabase
        .from('disclosure_insights')
        .select(`
          *,
          companies (
            market_type,
            close_price,
            market_cap,
            volume,
            trade_value,
            sector
          )
        `)
        .eq('id', id)
        .single();
      
      if (data) {
        setDisclosures(prev => 
          prev.map(item => item.id.toString() === id ? data : item)
        );
      }
    } catch (error) {
      console.error('Failed to refresh item:', error);
    }
  };

  useEffect(() => {
    async function fetchData() {
      const [indicesRes, disclosuresRes] = await Promise.all([
        supabase.from('market_indices').select('*').order('symbol', { ascending: true }),
        // 공시 목록 불러올 때 기업 시세 정보도 함께 가져옴
        supabase.from('disclosure_insights')
          .select('*, companies(*)')
          .order('created_at', { ascending: false })
          .limit(40)
      ]);
      setIndices(indicesRes.data || []);
      setDisclosures(disclosuresRes.data || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  // 🔄 자동 새로고침 로직 유지
  useEffect(() => {
    if (!selectedId) return;
    const selectedItem = disclosures.find(item => item.id.toString() === selectedId);
    if (!selectedItem) return;

    const isAnalyzing = selectedItem.analysis_status !== 'completed' || !selectedItem.ai_summary;

    if (isAnalyzing) {
      const interval = setInterval(() => {
        refreshSelectedItem(selectedId);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedId, disclosures]);

  const selectedItem = disclosures.find(item => item.id.toString() === selectedId);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-black italic tracking-widest text-xl animate-pulse">LOADING KMI INSIGHT...</div>;

  // 상세 분석 화면
  if (selectedItem) {
    const isAnalysisComplete = selectedItem.analysis_status === 'completed' && selectedItem.ai_summary;
    const company = selectedItem.companies; // KRX 데이터

    return (
      <div className="min-h-screen bg-white dark:bg-black text-slate-900 transition-all duration-500">
        <nav className="sticky top-0 z-50 p-6 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-gray-100 dark:border-white/5">
          <button 
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 rounded-full shadow-xl shadow-blue-500/20 text-sm font-black text-white hover:bg-blue-700 hover:scale-105 transition-all uppercase tracking-widest active:scale-95"
          >
            <span className="text-xl">←</span> LIST 로 돌아가기
          </button>
        </nav>

        <main className="max-w-5xl mx-auto px-6 py-12 animate-in fade-in slide-in-from-bottom-6 duration-1000">
          {/* 기업 시세 섹션 (추가된 부분) */}
          <div className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div>
              <span className="text-blue-600 text-xs font-black uppercase tracking-[0.3em] bg-blue-50 px-3 py-1 rounded">
                {company?.market_type || 'KOSPI/KOSDAQ'} | {company?.sector || '정보없음'}
              </span>
              <h1 className="text-4xl md:text-5xl font-black leading-tight mt-6 dark:text-white tracking-tighter">
                {selectedItem.corp_name}
              </h1>
              <p className="text-slate-500 font-bold mt-2">{selectedItem.report_nm}</p>
            </div>
            
            <div className="flex gap-4 w-full md:w-auto overflow-x-auto pb-2">
              <div className="bg-slate-50 dark:bg-zinc-900 px-5 py-3 rounded-2xl border border-slate-100 dark:border-white/5 min-w-[120px]">
                <p className="text-[10px] text-slate-400 font-black uppercase mb-1">현재가</p>
                <p className="text-xl font-black dark:text-white">{company?.close_price?.toLocaleString() || '-'}원</p>
              </div>
              <div className="bg-slate-50 dark:bg-zinc-900 px-5 py-3 rounded-2xl border border-slate-100 dark:border-white/5 min-w-[120px]">
                <p className="text-[10px] text-slate-400 font-black uppercase mb-1">시가총액</p>
                <p className="text-xl font-black dark:text-white">
                  {company?.market_cap ? `${(company.market_cap / 100000000).toFixed(0)}억` : '-'}
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-zinc-900 px-5 py-3 rounded-2xl border border-slate-100 dark:border-white/5 min-w-[120px]">
                <p className="text-[10px] text-slate-400 font-black uppercase mb-1">거래량</p>
                <p className="text-xl font-black dark:text-white">{company?.volume?.toLocaleString() || '-'}주</p>
              </div>
            </div>
          </div>

          <section className="bg-slate-950 rounded-[3.5rem] p-8 md:p-12 shadow-2xl text-white border border-white/5">
            <div className="mb-10 flex justify-between items-end">
              <h2 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">AI Smart Analysis Report</h2>
              <p className="text-slate-400 font-medium italic text-[10px]">Analyzed on {new Date(selectedItem.created_at).toLocaleString()}</p>
            </div>
            
            {isAnalysisComplete ? (
              <StockSentiment 
                sentiment={selectedItem.sentiment} 
                sentiment_score={selectedItem.sentiment_score} 
                ai_summary={selectedItem.ai_summary} 
              />
            ) : (
              <div className="bg-white/5 rounded-3xl p-12 border border-dashed border-white/20 text-center">
                <div className="flex flex-col items-center gap-6">
                  <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  <div>
                    <p className="text-blue-400 font-bold text-lg">AI가 공시 내용을 심층 분석하고 있습니다</p>
                    <p className="text-[10px] text-slate-500 uppercase mt-2 tracking-widest">
                      {selectedItem.analysis_status === 'failed' ? '분석 실패 - 재시도 중' : '5초 후 자동 새로고침'}
                    </p>
                  </div>
                  <button
                    onClick={() => refreshSelectedItem(selectedId!)}
                    className="mt-4 px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-full text-xs font-black transition-all active:scale-95"
                  >
                    지금 데이터 업데이트 확인
                  </button>
                </div>
              </div>
            )}

            <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex gap-8">
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-500 font-black uppercase mb-1">Importance</span>
                  <span className={`text-xs font-black ${selectedItem.importance === 'HIGH' ? 'text-rose-400' : 'text-blue-400'}`}>
                    {selectedItem.importance || 'MEDIUM'}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-500 font-black uppercase mb-1">Stock Code</span>
                  <span className="text-xs font-black text-slate-300">{selectedItem.stock_code}</span>
                </div>
              </div>
              <a 
                href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${selectedItem.rcept_no}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="group flex items-center gap-2 text-xs font-black text-blue-400 hover:text-blue-300 transition-colors bg-white/5 px-6 py-3 rounded-2xl border border-white/5"
              >
                VIEW ORIGINAL DART DOCUMENT
                <span className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform">↗</span>
              </a>
            </div>
          </section>
        </main>
      </div>
    );
  }

  // 목록 화면 (기존 스타일 유지)
  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-black text-slate-900 transition-colors duration-500">
      <nav className="sticky top-0 z-50 w-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-gray-100 dark:border-white/5 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <span className="text-2xl font-black text-blue-600 tracking-tighter">KMI INSIGHT</span>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:block italic underline decoration-blue-500/30">AI Financial 가공 정보 서비스</div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Market Pulse (기존 유지) */}
        <section className="mb-20">
          <h2 className="text-2xl font-black mb-10 uppercase tracking-tighter dark:text-white flex items-center gap-3">
            <span className="w-2 h-8 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]"></span> Market Pulse
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {indices.map((idx) => {
              const isPositive = idx.change_rate >= 0;
              return (
                <div key={idx.symbol} className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1 group">
                  <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest group-hover:text-blue-600 transition-colors">{idx.name || idx.symbol}</span>
                  <p className="text-4xl font-black mt-2 dark:text-white tracking-tighter">{idx.price}</p>
                  <div className="flex items-center gap-2 mt-3">
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black ${isPositive ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'}`}>
                      {isPositive ? '▲' : '▼'} {Math.abs(idx.change_rate).toFixed(2)}%
                    </div>
                    {idx.change_value && <span className={`text-xs font-bold ${isPositive ? 'text-rose-600' : 'text-blue-600'}`}>{isPositive ? '+' : ''}{idx.change_value}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Live Disclosures (기존 유지) */}
        <section>
          <h2 className="text-2xl font-black mb-10 uppercase tracking-tighter dark:text-white flex items-center gap-3">
            <span className="w-2 h-8 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]"></span> Live Disclosures
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {disclosures.map((item) => {
              const isComplete = item.analysis_status === 'completed' && item.ai_summary;
              return (
                <div 
                  key={item.id} 
                  onClick={() => router.push(`?id=${item.id}`)}
                  className="cursor-pointer group p-8 rounded-[3rem] border border-gray-100 bg-white dark:bg-zinc-900 dark:border-white/5 hover:border-blue-500 transition-all shadow-sm hover:shadow-2xl hover:-translate-y-2 duration-300 relative overflow-hidden"
                >
                  {!isComplete && (
                    <div className="absolute top-4 right-4 animate-pulse">
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 text-[8px] font-black rounded-full uppercase">
                        AI Analyzing...
                      </span>
                    </div>
                  )}
                  <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em]">{item.corp_name}</span>
                  <h3 className="text-xl font-black leading-tight mt-3 mb-8 dark:text-white group-hover:text-blue-600 transition-colors line-clamp-2">
                    {item.report_nm}
                  </h3>
                  <div className="flex justify-between items-center pt-4 border-t border-gray-50 dark:border-white/5">
                    <p className="text-[10px] text-slate-400 font-bold">{new Date(item.created_at).toLocaleDateString()}</p>
                    <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                      item.importance === 'HIGH' ? 'bg-rose-500 text-white' : 
                      item.importance === 'MEDIUM' ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {item.importance || 'PENDING'}
                    </span>
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
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white font-black italic tracking-widest">INITIALIZING TERMINAL...</div>}>
      <DisclosureDashboard />
    </Suspense>
  );
}