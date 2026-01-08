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

  useEffect(() => {
    async function fetchData() {
      const [indicesRes, disclosuresRes] = await Promise.all([
        supabase.from('market_indices').select('*').order('symbol', { ascending: true }),
        supabase.from('disclosure_insights').select('*').order('created_at', { ascending: false }).limit(40)
      ]);
      setIndices(indicesRes.data || []);
      setDisclosures(disclosuresRes.data || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  const selectedItem = disclosures.find(item => item.id.toString() === selectedId);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-black italic">LOADING KMI INSIGHT...</div>;

  // 상세 분석 화면
  if (selectedItem) {
    // ✅ AI 분석이 완료되었는지 체크: ai_summary, sentiment, sentiment_score 모두 있어야 함
    const isAnalysisComplete = selectedItem.ai_summary && 
                               selectedItem.sentiment && 
                               typeof selectedItem.sentiment_score === 'number';

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

        <main className="max-w-4xl mx-auto px-6 py-12 animate-in fade-in slide-in-from-bottom-6 duration-1000">
          <div className="mb-12">
            <span className="text-blue-600 text-xs font-black uppercase tracking-[0.3em] bg-blue-50 px-3 py-1 rounded">{selectedItem.corp_name}</span>
            <h1 className="text-4xl md:text-5xl font-black leading-tight mt-6 dark:text-white tracking-tighter">
              {selectedItem.report_nm}
            </h1>
            <p className="text-slate-400 mt-4 font-medium italic">Analyzed on {new Date(selectedItem.created_at).toLocaleString()}</p>
          </div>

          <section className="bg-slate-950 rounded-[3.5rem] p-8 md:p-12 shadow-2xl text-white border border-white/5">
            <div className="mb-10 flex justify-between items-end">
              <h2 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">AI Smart Analysis Report</h2>
              {isAnalysisComplete && (
                <div className="text-right">
                  <p className="text-[8px] text-slate-500 font-black uppercase mb-1">Impact Intensity</p>
                  <p className="text-xl font-black text-blue-400">{(selectedItem.sentiment_score * 100).toFixed(0)}%</p>
                </div>
              )}
            </div>
            
            {/* ✅ 모든 AI 분석 데이터가 준비되었을 때만 표시 */}
            {isAnalysisComplete ? (
              <StockSentiment 
                sentiment={selectedItem.sentiment} 
                sentiment_score={selectedItem.sentiment_score} 
                ai_summary={selectedItem.ai_summary} 
              />
            ) : (
              <div className="bg-white/5 rounded-3xl p-8 border border-dashed border-white/20 text-center">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-blue-400 font-bold">
                    AI가 공시 내용을 심층 분석하고 있습니다
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase">Analysis in progress</p>
                  {/* 디버깅용: 어떤 데이터가 없는지 표시 */}
                  <div className="text-[8px] text-slate-600 mt-4 text-left bg-slate-900/50 p-3 rounded">
                    <p>• AI Summary: {selectedItem.ai_summary ? '✓' : '✗ (처리중)'}</p>
                    <p>• Sentiment: {selectedItem.sentiment ? '✓' : '✗ (처리중)'}</p>
                    <p>• Score: {typeof selectedItem.sentiment_score === 'number' ? '✓' : '✗ (처리중)'}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-16 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex gap-6">
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-500 font-black uppercase">Importance</span>
                  <span className="text-xs font-black text-slate-300">{selectedItem.importance || 'MID'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] text-slate-500 font-black uppercase">Sector Code</span>
                  <span className="text-xs font-black text-slate-300">{selectedItem.stock_code}</span>
                </div>
              </div>
              <a 
                href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${selectedItem.rcept_no}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="group flex items-center gap-2 text-xs font-black text-blue-400 hover:text-blue-300 transition-colors bg-white/5 px-4 py-2 rounded-xl border border-white/5"
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

  // 목록 화면
  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-black text-slate-900 transition-colors duration-500">
      <nav className="sticky top-0 z-50 w-full bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-gray-100 dark:border-white/5 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <span className="text-2xl font-black text-blue-600 tracking-tighter">KMI INSIGHT</span>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:block">AI Financial 가공 정보 서비스</div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Market Pulse Section */}
        <section className="mb-20">
          <h2 className="text-2xl font-black mb-10 uppercase tracking-tighter dark:text-white flex items-center gap-3">
            <span className="w-2 h-8 bg-blue-600 rounded-full"></span> Market Pulse
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {indices.map((idx) => (
              <div key={idx.symbol} className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-shadow">
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{idx.name}</span>
                <p className="text-4xl font-black mt-2 dark:text-white tracking-tighter">{idx.price}</p>
                <div className={`inline-flex items-center mt-3 px-3 py-1 rounded-full text-xs font-black ${idx.change_rate >= 0 ? 'bg-rose-50 text-rose-500' : 'bg-blue-50 text-blue-500'}`}>
                  {idx.change_rate >= 0 ? '▲' : '▼'} {Math.abs(idx.change_rate).toFixed(2)}%
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Live Disclosures Section */}
        <section>
          <h2 className="text-2xl font-black mb-10 uppercase tracking-tighter dark:text-white flex items-center gap-3">
            <span className="w-2 h-8 bg-blue-600 rounded-full"></span> Live Disclosures
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {disclosures.map((item) => {
              const hasAnalysis = item.ai_summary && item.sentiment && typeof item.sentiment_score === 'number';
              
              return (
                <div 
                  key={item.id} 
                  onClick={() => router.push(`?id=${item.id}`)}
                  className="cursor-pointer group p-8 rounded-[3rem] border border-gray-100 bg-white dark:bg-zinc-900 dark:border-white/5 hover:border-blue-500 dark:hover:border-blue-600 transition-all shadow-sm hover:shadow-2xl hover:-translate-y-1 duration-300 relative"
                >
                  {/* ✅ 분석 완료 여부 뱃지 */}
                  {!hasAnalysis && (
                    <div className="absolute top-4 right-4">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-[8px] font-black rounded-full">
                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                        분석중
                      </span>
                    </div>
                  )}
                  
                  <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em]">{item.corp_name}</span>
                  <h3 className="text-xl font-black leading-tight mt-3 mb-8 dark:text-white group-hover:text-blue-600 transition-colors line-clamp-2">
                    {item.report_nm}
                  </h3>
                  <div className="flex justify-between items-center pt-4 border-t border-gray-50 dark:border-white/5">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{new Date(item.created_at).toLocaleDateString()}</p>
                    <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest ${
                      item.importance === 'HIGH' ? 'bg-rose-500 text-white' : 'bg-blue-50 text-blue-600'
                    }`}>
                      {item.importance || 'MID'}
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