'use client';

import { useState, useEffect } from 'react';
import { supabase } from "../lib/supabase";
import StockSentiment from '../components/StockSentiment';

export default function Home() {
  const [indices, setIndices] = useState<any[]>([]);
  const [disclosures, setDisclosures] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
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

  // 1. 공시 목록 화면 (기존 레이아웃 유지)
  if (!selectedItem) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] dark:bg-black text-slate-900">
        <nav className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-gray-100 dark:bg-zinc-900 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <span className="text-2xl font-black text-blue-600 tracking-tighter">KMI INSIGHT</span>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Financial Terminal</div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-6 py-12">
          {/* Market Pulse Section */}
          <section className="mb-16">
            <h2 className="text-2xl font-black mb-8 uppercase tracking-tighter dark:text-white">Market Pulse</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {indices.map((idx) => (
                <div key={idx.symbol} className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-gray-100 dark:border-white/5 shadow-sm">
                  <span className="text-[10px] font-black text-blue-500 uppercase">{idx.name}</span>
                  <p className="text-3xl font-black mt-1 dark:text-white">{idx.price}</p>
                  <p className={`text-sm font-black ${idx.change_rate >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                    {idx.change_rate >= 0 ? '▲' : '▼'} {Math.abs(idx.change_rate).toFixed(2)}%
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Disclosure List Section */}
          <section>
            <h2 className="text-2xl font-black mb-8 uppercase tracking-tighter dark:text-white">Live Disclosures</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {disclosures.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedItem(item)}
                  className="cursor-pointer p-8 rounded-[2.5rem] border border-gray-100 bg-white dark:bg-zinc-900 dark:border-white/5 hover:border-blue-500 transition-all shadow-sm hover:shadow-xl group"
                >
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">{item.corp_name}</span>
                  <h3 className="text-xl font-black leading-tight mt-2 mb-4 group-hover:text-blue-600 transition-colors dark:text-white">
                    {item.report_nm}
                  </h3>
                  <div className="flex justify-between items-center mt-auto">
                    <p className="text-[10px] text-slate-400 font-medium">
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
                    <span className="px-3 py-1 bg-slate-100 dark:bg-white/10 rounded-full text-[8px] font-black uppercase text-slate-500">
                      {item.importance || 'MID'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    );
  }

  // 2. 공시 상세 분석 화면 (클릭 시 전환되는 화면)
  return (
    <div className="min-h-screen bg-white dark:bg-black text-slate-900">
      <nav className="p-6">
        <button 
          onClick={() => setSelectedItem(null)}
          className="flex items-center gap-2 text-xs font-black text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-widest"
        >
          ← Back to List
        </button>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="mb-12">
          <span className="text-blue-600 text-xs font-black uppercase tracking-[0.2em]">{selectedItem.corp_name}</span>
          <h1 className="text-4xl md:text-5xl font-black leading-tight mt-4 dark:text-white">
            {selectedItem.report_nm}
          </h1>
          <p className="text-slate-400 mt-4 font-medium">
            Analyzed on {new Date(selectedItem.created_at).toLocaleString('ko-KR')}
          </p>
        </div>

        {/* AI 가공 데이터 영역 */}
        <section className="bg-slate-900 rounded-[3rem] p-10 shadow-2xl text-white">
          <StockSentiment 
            sentiment={selectedItem.sentiment} 
            sentiment_score={selectedItem.sentiment_score} 
            ai_summary={selectedItem.ai_summary} 
          />
          
          <div className="mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex gap-4">
              <span className="text-[10px] font-black text-slate-500 uppercase">Importance: {selectedItem.importance}</span>
              <span className="text-[10px] font-black text-slate-500 uppercase">Sector: {selectedItem.stock_code}</span>
            </div>
            <a 
              href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${selectedItem.rcept_no}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-black text-blue-400 hover:text-blue-300 underline underline-offset-4"
            >
              VIEW ORIGINAL DART DOCUMENT ↗
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}