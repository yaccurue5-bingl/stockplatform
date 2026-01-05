import Image from "next/image";
import { supabase } from "../lib/supabase";

// Force dynamic rendering to show the latest data on every visit
export const revalidate = 0;

export default async function Home() {
  // Fetch market indices and company list in parallel
  const [indicesResult, companiesResult] = await Promise.all([
    supabase
      .from('market_indices')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(3),
    supabase
      .from('companies')
      .select('*')
      .order('market_cap', { ascending: false })
      .limit(50)
  ]);

  const indices = indicesResult.data;
  const companies = companiesResult.data;
  const error = companiesResult.error;

  return (
    <div className="min-h-screen bg-[#F9FAFB] font-sans dark:bg-black">
      {/* --- Global Navigation Bar --- */}
      <nav className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-gray-100 dark:bg-zinc-900/90 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center">
            {/* Logo linked to home */}
            <Image 
              src="/logo.jpg" 
              alt="KMI Insight Logo" 
              width={160} 
              height={40} 
              className="object-contain"
              priority
            />
          </div>
          <div className="hidden md:flex gap-10 text-[11px] font-black uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
            <a href="#" className="hover:text-blue-600 transition">Market Intelligence</a>
            <a href="#" className="hover:text-blue-600 transition">AI Analysis</a>
            <a href="#" className="hover:text-blue-600 transition">Global Terminal</a>
          </div>
        </div>
      </nav>

      {/* --- Hero Section with English Slogan --- */}
      <header className="w-full bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 py-24 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-black text-gray-900 dark:text-white mb-6 tracking-tight">
            Strategic Insight for <span className="text-blue-600 text-shadow-sm">Global Investors</span>
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Real-time AI-powered analysis for the Korean stock market. <br className="hidden md:block"/>
            Bridge the gap between data and intelligence.
          </p>
          
          {/* Global Search Bar UI */}
          <div className="relative max-w-2xl mx-auto shadow-2xl shadow-blue-500/10">
            <input 
              type="text" 
              placeholder="Search Ticker or Company Name..."
              className="w-full pl-8 pr-16 py-6 bg-gray-50 dark:bg-zinc-800 border-2 border-gray-100 dark:border-zinc-700 rounded-[2rem] focus:border-blue-500 focus:bg-white transition outline-none text-xl"
            />
            <div className="absolute right-6 top-1/2 -translate-y-1/2 bg-blue-600 p-3 rounded-2xl text-white shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-8">
        {/* --- Market Indices Dashboard --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
          {indices && indices.length > 0 ? (
            indices.map((idx: any) => (
              <div key={idx.symbol} className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-zinc-800">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-[10px] font-black bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-3 py-1 rounded-full uppercase tracking-widest">
                    {idx.symbol}
                  </span>
                  <div className={`text-sm font-black ${idx.change_rate > 0 ? 'text-red-500' : 'text-blue-500'}`}>
                    {idx.change_rate > 0 ? '▲' : '▼'} {Math.abs(idx.change_rate)}%
                  </div>
                </div>
                <p className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter mb-1">{idx.price}</p>
                <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">{idx.name}</p>
              </div>
            ))
          ) : (
            <div className="col-span-3 text-center py-16 bg-gray-50 rounded-[2.5rem] border-2 border-dashed border-gray-100 text-gray-400 font-bold">
              Connecting to Live Market Feed...
            </div>
          )}
        </div>

        {/* --- AI Analysis List (Korean Data for Verification) --- */}
        <section>
          <div className="flex items-end justify-between mb-12 px-2">
            <div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight italic uppercase">Market Feed</h2>
              <p className="text-sm text-gray-400 mt-2 font-medium tracking-wide">Real-time Korean disclosure analysis by KMI AI.</p>
            </div>
            <div className="text-right">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></span>
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Live System Active</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {companies && companies.length > 0 ? (
              companies.map((company: any) => (
                <a 
                  href={`/stock/${company.stock_code}`} // Link to stock detail
                  key={company.stock_code} 
                  className="group relative p-8 bg-white border border-gray-100 rounded-[2rem] hover:border-blue-500 hover:shadow-2xl transition-all duration-500 dark:bg-zinc-900 dark:border-zinc-800"
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-zinc-100 group-hover:text-blue-600 transition-colors">
                          {company.corp_name} {/* Company name in Korean */}
                        </h3>
                        <p className="text-[11px] font-bold text-gray-400 tracking-[0.3em] uppercase mt-1">{company.stock_code}</p>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed max-w-[280px]">
                        AI is currently processing the latest disclosures for {company.corp_name}. Check for sentiment analysis.
                      </p>
                    </div>
                    {company.market_cap > 0 && (
                      <div className="bg-gray-50 dark:bg-zinc-800 p-4 rounded-2xl text-right">
                        <p className="text-[9px] text-gray-400 font-black uppercase mb-1 tracking-widest">Market Cap</p>
                        <p className="text-md font-black text-blue-600 dark:text-blue-400">
                          ₩ {(company.market_cap / 100000000).toLocaleString()}B
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="mt-6 flex items-center text-[10px] font-black text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-[0.2em]">
                    View Analysis Report &rarr;
                  </div>
                </a>
              ))
            ) : (
              <div className="col-span-full text-center py-32 bg-white border border-dashed border-gray-100 rounded-[3rem] text-gray-300">
                <p className="text-4xl mb-6">📡</p>
                <p className="text-xl font-black uppercase tracking-widest">Synchronizing Master Data</p>
                <p className="text-xs mt-3 font-medium text-gray-400">Database update scheduled at 17:30 KST.</p>
              </div>
            )}
          </div>
        </section>
      </main>
      
      {/* Global Footer */}
      <footer className="mt-40 py-20 border-t border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-center px-6">
        <Image src="/logo.jpg" alt="Logo" width={120} height={30} className="mx-auto opacity-40 grayscale mb-10 hover:grayscale-0 transition-all duration-500 cursor-pointer" />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] max-w-lg mx-auto leading-loose">
          © 2026 KMI Insight. All intellectual property rights reserved. <br/>
          Strategic Intelligence for Global Financial Markets.
        </p>
      </footer>
    </div>
  );
}