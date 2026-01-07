'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation'; // 뒤로가기 지원용
import { supabase } from "../lib/supabase";
import StockSentiment from '../components/StockSentiment';

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('id'); // URL에서 ID 추출

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

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-black">LOADING...</div>;

  // 1. 상세 분석 화면
  if (selectedItem) {
    return (
      <div className="min-h-screen bg-white dark:bg-black text-slate-900">
        <nav className="p-6 bg-slate-50 dark:bg-zinc-900/50 border-b border-gray-100 dark:border-white/5">
          <button 
            onClick={() => router.back()} // 브라우저 뒤로가기 기능 활용
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 rounded-full shadow-sm border border-gray-200 dark:border-white/10 text-sm font-black text-blue-600 hover:bg-blue-50 transition-all uppercase tracking-widest"
          >
            <span className="text-lg">←</span> BACK TO LIST
          </button>
        </nav>

        <main className="max-w-4xl mx-auto px-6 py-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="mb-10">
            <span className="text-blue-600 text-xs font-black uppercase tracking-[0.2em]">{selectedItem.corp_name}</span>
            <h1 className="text-4xl font-black leading-tight mt-4 dark:text-white">
              {selectedItem.report_nm}
            </h1>
            <p className="text-slate-400 mt-4 font-medium">Analyzed on {new Date(selectedItem.created_at).toLocaleString()}</p>
          </div>

          <section className="bg-slate-900 rounded-[3rem] p-10 shadow-2xl text-white">
            {/* 🚀 AI 분석 결과 컴포넌트 호출 */}
            <StockSentiment 
              sentiment={selectedItem.sentiment} 
              sentiment_score={selectedItem.sentiment_score} 
              ai_summary={selectedItem.ai_summary} 
            />

            <div className="mt-12 pt-8 border-t border-white/10 flex justify-between items-center text-slate-500">
              <span className="text-[10px] font-black uppercase">Importance: {selectedItem.importance || 'MID'}</span>
              <a href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${selectedItem.rcept_no}`} target="_blank" className="text-xs font-black text-blue-400 hover:underline">VIEW ORIGINAL DART ↗</a>
            </div>
          </section>
        </main>
      </div>
    );
  }

  // 2. 목록 화면
  return (
    <div className="min-h-screen bg-[#F9FAFB] dark:bg-black p-6">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-2xl font-black mb-8 dark:text-white uppercase tracking-tighter">Live Disclosures</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {disclosures.map((item) => (
            <div 
              key={item.id} 
              onClick={() => router.push(`?id=${item.id}`)} // URL 파라미터 변경으로 상세 이동
              className="cursor-pointer p-8 rounded-[2.5rem] border border-gray-100 bg-white dark:bg-zinc-900 hover:border-blue-500 transition-all shadow-sm group"
            >
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">{item.corp_name}</span>
              <h3 className="text-xl font-black leading-tight mt-2 mb-6 dark:text-white group-hover:text-blue-600">{item.report_nm}</h3>
              <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 rounded-full text-[8px] font-black uppercase text-blue-600">
                {item.importance || 'MID'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}