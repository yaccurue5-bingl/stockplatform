import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { Globe, TrendingUp, TrendingDown, ChevronRight, Clock, MessageSquare } from 'lucide-react';
import { supabase } from './supabaseClient';

const StatCard = ({ title, value, size = "w-40 lg:w-52" }) => (
  <div className={`${size} bg-slate-900/80 border border-slate-800 p-2.5 rounded-xl flex flex-col justify-center`}>
    <p className="text-slate-500 text-[10px] font-bold uppercase mb-0.5">{title}</p>
    <h3 className="text-base font-bold text-white tracking-tight">{value}</h3>
  </div>
);

function Dashboard() {
  const [insights, setInsights] = useState([]);
  const [indices, setIndices] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const { data: ins } = await supabase.from('disclosure_insights').select('*').order('created_at', { ascending: false });
      const { data: ind } = await supabase.from('market_indices').select('*');
      
      if (ins) {
        const unique = Array.from(new Map(ins.map(item => [item.corp_name, item])).values());
        setInsights(unique.slice(0, 6));
      }
      if (ind) setIndices(ind);
    };
    fetchData();
    const timer = setInterval(fetchData, 900000); // 15분 동기화
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative">
      {/* 3번 해결: 상단 고정 지표 바 */}
      <div className="sticky top-[64px] z-40 bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-800/50 py-2">
        <div className="max-w-7xl mx-auto px-6 flex justify-center gap-3">
          {indices.map(idx => (
            <StatCard key={idx.name} title={idx.name} value={idx.current_val} />
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {insights.map(item => (
            <div key={item.id} onClick={() => navigate(`/stock/${item.stock_code}`)} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl hover:border-blue-500/50 transition cursor-pointer">
              <span className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">{item.sentiment}</span>
              <h4 className="font-bold text-lg text-white mt-3 mb-2">{item.corp_name}</h4>
              <p className="text-slate-400 text-xs line-clamp-2">{item.report_nm}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

// 1번 해결: StockDetailPage 통합 (공시 목록 출력용)
function StockDetailPage() {
  const { ticker } = useParams();
  const [data, setData] = useState([]);

  useEffect(() => {
    const getLogs = async () => {
      const { data } = await supabase.from('disclosure_insights').select('*').eq('stock_code', ticker).limit(5);
      setData(data || []);
    };
    getLogs();
  }, [ticker]);

  return (
    <div className="max-w-4xl mx-auto p-8 text-white">
      <Link to="/" className="text-slate-500 text-sm mb-6 inline-block hover:text-white transition">← Back</Link>
      <h1 className="text-3xl font-bold mb-8">{data[0]?.corp_name} Disclosure History</h1>
      <div className="space-y-4">
        {data.map(f => (
          <div key={f.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
            <h3 className="font-bold mb-3">{f.report_nm}</h3>
            <div className="bg-[#0f172a] p-4 rounded-xl text-sm text-slate-300 leading-relaxed">{f.ai_summary}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#0f172a]">
        <nav className="h-[64px] sticky top-0 z-50 bg-[#0f172a] border-b border-slate-800 px-6 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <Globe className="text-blue-500" />
            <span className="text-xl font-bold text-white tracking-tighter">K-MARKET <span className="text-blue-500">INSIGHT</span></span>
          </Link>
          <div className="flex gap-6 text-[11px] font-bold text-slate-400 uppercase">
             <Link to="/markets">Markets</Link>
             <Link to="/summaries" className="text-white">AI Summaries</Link>
          </div>
        </nav>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stock/:ticker" element={<StockDetailPage />} />
        </Routes>
      </div>
    </Router>
  );
}