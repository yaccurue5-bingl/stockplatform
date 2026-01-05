import Image from "next/image";
import { supabase } from "../lib/supabase";

// 페이지를 열 때마다 새 데이터를 가져오도록 설정
export const revalidate = 0;

export default async function Home() {
  // 1. 데이터 페칭 로직 (market_indices & companies)
  const { data: indices } = await supabase
    .from('market_indices')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(3);

  const { data: companies, error } = await supabase
    .from('companies')
    .select('*')
    .order('market_cap', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Data Load Error:', error.message);
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] font-sans dark:bg-black">
      {/* --- Global Navigation Bar --- */}
      <nav className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-gray-100 dark:bg-zinc-900/90 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <Image 
              src="/logo.jpg" 
              alt="KMI Insight Logo" 
              width={160} 
              height={40} 
              className="object-contain"
              priority
            />
          </div>
          <div className="hidden md:flex gap-10 text-[13px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <a href="#" className="hover:text-blue-600 transition">Market Intelligence</a>
            <a href="#" className="hover:text-blue-600 transition">AI Disclosure Analysis</a>
            <a href="#" className="hover:text-blue-600 transition">Reports</a>
          </div>
        </div>
      </nav>

      {/* --- Global Hero Section --- */}
      <header className="w-full bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 py-20 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white mb-6 tracking-tight">
            The Hub of Korea Market Intelligence, <span className="text-blue-600">KMI Insight</span>
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Experience the most accurate market flow with our real-time AI-powered disclosure analysis system.
          </p>
          
          {/* Integrated Search Bar */}
          <div className="relative max-w-2xl mx-auto shadow-xl shadow-blue-500/5">
            <input 
              type="text" 
              placeholder="Search by Ticker or Company Name..."
              className="w-full pl-6 pr-14 py-5 bg-gray-50 dark:bg-zinc-800 border-2 border-gray-100 dark:border-zinc-700 rounded-2xl focus:border-blue-500 focus:bg-white transition outline-none text-lg"
            />
            <div className="absolute right-5 top-1/2 -translate-y-1/2 bg-blue-600 p-2.5 rounded-xl text-white">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8">
        {/* --- Market Indices Widget --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {indices && indices.length > 0 ? (
            indices.map((idx: any) => (
              <div key={idx.symbol} className="bg-white dark:bg-zinc-900 p-8 rounded-[2rem] shadow-sm border border-gray-100 dark:border-zinc-800 hover:shadow-md transition">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-[11px] font-black bg-gray-100 dark:bg-zinc-800 px-3 py-1 rounded-full text-gray-400 uppercase tracking-widest">
                    {idx.symbol}
                  </span>
                  <div className={`text-sm font-bold ${idx.change_rate > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                    {idx.change_rate > 0 ? '▲' : '▼'} {Math.abs(idx.change_rate)}%
                  </div>
                </div>
                <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">{idx.price}</p>
                <p className="text-xs text-gray-400 mt-2 font-medium">{idx.name}</p>
              </div>
            ))
          ) : (
            <div className="col-span-3 text-center py-10 bg-gray-50 rounded-3xl border border-dashed border-gray-200 text-gray-400 text-sm">
              Waiting for live market index sync...
            </div>
          )}
        </div>

        {/* --- AI Analysis Feed --- */}
        <section>
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Real-time AI Research</h2>
              <p className="text-sm text-gray-400 mt-1">AI-driven analysis of the latest KOSPI & KOSDAQ disclosures.</p>
            </div>
            <button className="text-blue-600 font-bold text-sm hover:underline">View All &rarr;</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {companies && companies.length > 0 ? (
              companies.map((company: any) => (
                <a 
                  href={`/stock/${company.stock_code}`}
                  key={company.stock_code} 
                  className="group p-6 bg-white border border-gray-100 rounded-3xl hover:border-blue-500 hover:shadow-xl transition-all duration-300 dark:bg-zinc-900 dark:border-zinc-800"
                >
                  <div className="flex justify-between items-center">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <p className="text-xl font-bold text-gray-900 dark:text-zinc-100 group-hover:text-blue-600 transition">
                          {company.corp_name}
                        </p>
                        <span className="text-[10px] font-bold text-gray-400 tracking-widest">{company.stock_code}</span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed max-w-[200px] truncate">
                        Analyzing core financial data and recent reports...
                      </p>
                    </div>
                    {company.market_cap > 0 && (
                      <div className="text-right">
                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Market Cap</p>
                        <p className="text-md font-black text-gray-800 dark:text-gray-200">
                          ₩ {(company.market_cap / 100000000).toLocaleString()}B
                        </p>
                      </div>
                    )}
                  </div>
                </a>
              ))
            ) : (
              <div className="col-span-full text-center py-24 bg-white border border-dashed border-gray-200 rounded-[3rem] text-gray-400">
                <p className="text-2xl mb-4">📡</p>
                <p className="font-bold text-gray-600">Building Master Database...</p>
                <p className="text-xs mt-2">Data sync will complete after market close (17:30 KST).</p>
              </div>
            )}
          </div>
        </section>
      </main>
      
      <footer className="mt-32 py-16 border-t border-gray-100 dark:border-zinc-800 text-center">
        <Image src="/logo.jpg" alt="Logo" width={100} height={25} className="mx-auto opacity-30 grayscale mb-6" />
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
          © 2026 KMI Insight. Strategic Intelligence for Global Investors.
        </p>
      </footer>
    </div>
  );
}