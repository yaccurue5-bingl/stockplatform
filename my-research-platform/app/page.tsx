'use client';

import { useState, useEffect } from 'react';
import { supabase } from "../lib/supabase";

export default function Home() {
  const [indices, setIndices] = useState<any[]>([]);
  const [disclosures, setDisclosures] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null); // 클릭된 카드 상태
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

  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-black text-slate-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-gray-100 dark:bg-zinc-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <span className="text-2xl font-black text-blue-600">KMI INSIGHT</span>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Financial Terminal</div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Market Pulse */}
        <section className="mb-16">
          <h2 className="text-2xl font-black mb-8 uppercase tracking-tighter">Market Pulse</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {indices.map((idx) => (
              <div key={idx.symbol} className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] border border-gray-100 shadow-sm">
                <span className="text-[10px] font-black text-blue-500 uppercase">{idx.name}</span>
                <p className="text-3xl font-black mt-1">{idx.price}</p>
                <p className={`text-sm font-black ${idx.change_rate >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                  {idx.change_rate >= 0 ? '▲' : '▼'} {Math.abs(idx.change_rate).toFixed(2)}%
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left: Disclosure List */}
          <section className="flex-1">
            <h2 className="text-2xl font-black mb-8 uppercase tracking-tighter">Live Disclosures</h2>
            <div className="space-y-4">
              {disclosures.map((item) => (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedItem(item)}
                  className={`cursor-pointer p-6 rounded-[2rem] border transition-all ${
                    selectedItem?.id === item.id 
                    ? 'border-blue-500 bg-blue-50/30 shadow-lg scale-[1.02]' 
                    : 'border-gray-100 bg-white hover:border-blue-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black text-blue-600 uppercase">{item.corp_name}</span>
                      <h3 className="text-lg font-black leading-tight mt-1">{item.report_nm}</h3>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[8px] font-black ${item.importance === 'High' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                      {item.importance || 'MID'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Right: AI Analysis View (Fixed on scroll) */}
          <section className="lg:w-[450px]">
            <div className="sticky top-28 bg-slate-900 text-white p-8 rounded-[3rem] shadow-2xl min-h-[500px]">
              {selectedItem ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="mb-8">
                    <span className="text-blue-400 text-[10px] font-black uppercase tracking-widest">{selectedItem.corp_name} Analysis</span>
                    <h3 className="text-2xl font-black leading-tight mt-2">{selectedItem.report_nm}</h3>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <p className="text-slate-400 text-[10px] font-black uppercase mb-3">AI Executive Summary</p>
                      <p className="text-sm leading-relaxed text-slate-200 bg-white/5 p-5 rounded-2xl border border-white/10 italic">
                        "{selectedItem.ai_summary || "분석 데이터를 불러오는 중입니다."}"
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                        <p className="text-slate-500 text-[8px] font-black uppercase mb-1">Sentiment</p>
                        <p className={`text-sm font-black ${selectedItem.sentiment === 'Positive' ? 'text-green-400' : 'text-rose-400'}`}>
                          {selectedItem.sentiment || 'NEUTRAL'}
                        </p>
                      </div>
                      <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                        <p className="text-slate-500 text-[8px] font-black uppercase mb-1">Impact Score</p>
                        <p className="text-sm font-black text-blue-400">{(selectedItem.sentiment_score * 100).toFixed(0)}% Intensity</p>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-white/10">
                      <a 
                        href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${selectedItem.rcept_no}`}
                        target="_blank"
                        className="inline-flex items-center gap-2 text-xs font-black text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        VIEW ORIGINAL DART DOCUMENT ↗
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-20">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6 animate-pulse">
                    <span className="text-blue-500 text-2xl">⚡</span>
                  </div>
                  <p className="text-slate-400 font-black uppercase text-xs tracking-[0.2em]">Select a disclosure<br/>to initiate AI analysis</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}