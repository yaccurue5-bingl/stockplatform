import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Globe, AlertCircle, BarChart3, ChevronRight } from 'lucide-react';
import { supabase } from './services/supabase-auth-service'; // 기존 설정 유지

// --- 글로벌 유틸리티 함수 ---
const formatUSD = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(val);

function Dashboard() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInsights = async () => {
      const { data, error } = await supabase
        .from('disclosure_insights')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(6);
      
      if (!error) setInsights(data);
      setLoading(false);
    };
    fetchInsights();
  }, []);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans">
      {/* 상단 GNB */}
      <nav className="border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg text-white"><Globe size={20}/></div>
          <span className="text-xl font-bold tracking-tight text-white">K-Market <span className="text-blue-500">Insight</span></span>
        </div>
        <div className="hidden md:flex gap-8 text-sm font-medium text-slate-400">
          <button className="hover:text-white transition">Markets</button>
          <button className="text-white border-b-2 border-blue-500 pb-1">AI Summaries</button>
          <button className="hover:text-white transition">Governance</button>
        </div>
        <button className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-full text-xs font-bold transition">
          PRO PLAN
        </button>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        {/* Market Ticker Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
            <p className="text-slate-500 text-xs font-bold uppercase mb-1">KOSPI Index</p>
            <div className="flex justify-between items-end">
              <h3 className="text-2xl font-bold text-white">2,580.44</h3>
              <span className="text-emerald-400 text-sm font-medium flex items-center gap-1"><TrendingUp size={14}/> +0.82%</span>
            </div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 p-5 rounded-2xl">
            <p className="text-slate-500 text-xs font-bold uppercase mb-1">USD/KRW Exchange</p>
            <div className="flex justify-between items-end">
              <h3 className="text-2xl font-bold text-white">1,342.10</h3>
              <span className="text-rose-400 text-sm font-medium flex items-center gap-1"><TrendingDown size={14}/> -0.15%</span>
            </div>
          </div>
          <div className="bg-blue-900/20 border border-blue-800/50 p-5 rounded-2xl">
            <p className="text-blue-400 text-xs font-bold uppercase mb-1">Foreigner Net Buy</p>
            <div className="flex justify-between items-end">
              <h3 className="text-2xl font-bold text-white">{formatUSD(245000000)}</h3>
              <span className="text-blue-400 text-sm font-medium">Daily Inflow</span>
            </div>
          </div>
        </div>

        {/* AI Insight Cards Section */}
        <section className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1 italic">"While you were sleeping"</h2>
              <p className="text-slate-400 text-sm">AI-driven summary of crucial filings from the KOSPI market.</p>
            </div>
            <button className="text-blue-400 text-sm font-bold flex items-center hover:underline">View All <ChevronRight size={16}/></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? [1,2,3].map(i => <div key={i} className="h-48 bg-slate-800 animate-pulse rounded-2xl"></div>) : 
              insights.map((item) => (
                <div key={item.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl hover:border-slate-600 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <span className={`text-[10px] font-black px-2 py-1 rounded ${item.sentiment === 'POSITIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                      {item.sentiment || 'NEUTRAL'}
                    </span>
                    <span className="text-slate-500 text-[10px] font-mono">{new Date(item.created_at).toLocaleTimeString()}</span>
                  </div>
                  <h4 className="font-bold text-lg text-white mb-2 group-hover:text-blue-400 transition">{item.corp_name}</h4>
                  <p className="text-slate-400 text-sm line-clamp-3 leading-relaxed mb-4">
                    {item.ai_summary || "Analyzing the latest disclosure for potential market impact..."}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <AlertCircle size={12}/> {item.category || 'General'}
                  </div>
                </div>
              ))
            }
          </div>
        </section>

        {/* Treemap & Governance Table (Bottom Area) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-blue-500"/> Foreigner's Strategy Map</h3>
            <div className="h-64 bg-slate-800/50 rounded-xl flex items-center justify-center border border-dashed border-slate-700">
              <span className="text-slate-500 font-mono text-sm">[ Sector Heatmap Visualization Coming Soon ]</span>
            </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Governance Alert</h3>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3 border-b border-slate-800 pb-3 last:border-0">
                  <div className="w-1 h-10 bg-blue-600 rounded-full mt-1"></div>
                  <div>
                    <p className="text-xs font-bold text-white uppercase">Corporate Value-up</p>
                    <p className="text-[11px] text-slate-500">New shareholder return policy announced by Hyundai.</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        {/* 필요에 따라 StockDetailPage 등 추가 */}
      </Routes>
    </Router>
  );
}

export default App;