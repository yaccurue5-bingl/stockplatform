import { supabase } from "../lib/supabase";

// 사용자가 접속할 때마다 최신 데이터를 가져오도록 설정 (실시간성 확보)
export const revalidate = 0;

export default async function Home() {
  /**
   * 서버 측에서 데이터를 직접 가져오는 로직 (fetchData 역할)
   * 1. market_indices: 상단 지수 정보
   * 2. disclosure_insights: 하단 AI 공시 분석 리스트 (기존 companies 영역 대체)
   */
  const [indicesResult, disclosuresResult] = await Promise.all([
    supabase
      .from('market_indices')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(3),
    supabase
      .from('disclosure_insights')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
  ]);

  const indices = indicesResult.data || [];
  const disclosures = disclosuresResult.data || [];

  return (
    <div className="min-h-screen bg-[#F9FAFB] font-sans dark:bg-black text-slate-900">
      {/* --- Global Navigation Bar --- */}
      <nav className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-gray-100 dark:bg-zinc-900/95 dark:border-zinc-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-2xl font-black tracking-tighter text-blue-600 dark:text-blue-500 cursor-default">
              KMI <span className="text-slate-900 dark:text-white ml-1">INSIGHT</span>
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* --- Market Indices Section --- */}
        <section className="mb-20">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">Market Pulse</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {indices.length > 0 ? (
              indices.map((index) => (
                <div key={index.symbol} className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-gray-50 dark:border-zinc-800 transition-all hover:shadow-xl hover:-translate-y-1">
                  <div className="flex justify-between items-start mb-6">
                    <span className="px-5 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-black rounded-full uppercase tracking-widest">
                      {index.name}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white mb-2">{index.price}</span>
                    <span className={`text-sm font-black ${index.change_rate >= 0 ? 'text-rose-500' : 'text-blue-500'}`}>
                      {index.change_rate >= 0 ? '▲' : '▼'} {Math.abs(index.change_rate).toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-10 text-slate-400 font-bold uppercase tracking-widest">지수 데이터를 불러오는 중...</div>
            )}
          </div>
        </section>

        {/* --- AI Disclosure Insights Section --- */}
        <section>
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white uppercase tracking-tighter">AI Disclosure Insights</h2>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Updates</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {disclosures.length > 0 ? (
              disclosures.map((item) => (
                <div key={item.id} className="group bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-[3rem] p-8 transition-all hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/5">
                  <div className="flex justify-between items-start mb-8">
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">{item.corp_name}</span>
                      <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight group-hover:text-blue-600 transition-colors">
                        {item.report_nm}
                      </h3>
                    </div>
                    <span className={`px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest ${
                      item.importance === 'High' ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 text-slate-500'
                    }`}>
                      {item.importance || 'Medium'}
                    </span>
                  </div>
                  
                  <div className="bg-slate-50 dark:bg-zinc-800/50 p-6 rounded-[2rem] mb-6">
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400 leading-relaxed italic">
                      "{item.ai_summary || 'AI가 공시 내용을 분석하고 있습니다.'}"
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex gap-4">
                      <div className="text-center">
                        <p className="text-[8px] text-slate-400 font-black uppercase mb-1">Sentiment</p>
                        <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{item.sentiment || 'Neutral'}</p>
                      </div>
                      <div className="text-center border-l border-slate-100 dark:border-zinc-800 pl-4">
                        <p className="text-[8px] text-slate-400 font-black uppercase mb-1">Stock Code</p>
                        <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{item.stock_code}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[8px] text-slate-400 font-black uppercase mb-1">Published At</p>
                      <p className="text-[10px] font-black text-slate-500 tracking-widest">
                        {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-32 bg-white border border-dashed border-slate-100 rounded-[3rem] text-slate-300">
                <p className="text-xl font-black uppercase tracking-widest animate-pulse">Synchronizing Master Data</p>
              </div>
            )}
          </div>
        </section>
      </main>
      
      <footer className="mt-40 py-20 border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-center px-6">
        <span className="text-lg font-black tracking-tighter text-blue-600/40 block mb-8">KMI INSIGHT</span>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">© 2026 Financial AI Terminal. All rights reserved.</p>
      </footer>
    </div>
  );
}