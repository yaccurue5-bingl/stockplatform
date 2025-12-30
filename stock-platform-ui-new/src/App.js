import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { Globe, TrendingUp, TrendingDown, ChevronRight, Clock, MessageSquare, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from './supabaseClient';

// --- 컴포넌트: 상단 지수 카드 ---
const StatCard = ({ title, value, size = "w-40 lg:w-52" }) => (
  <div className={`${size} bg-slate-900/80 border border-slate-800 p-2.5 rounded-xl flex flex-col justify-center shadow-lg`}>
    <p className="text-slate-500 text-[10px] font-bold uppercase mb-0.5 tracking-wider">{title}</p>
    <h3 className="text-base font-bold text-white tracking-tight">{value || '---'}</h3>
  </div>
);

// --- 화면 1: 메인 대시보드 ---
function Dashboard() {
  const [insights, setInsights] = useState([]);
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const { data: ins } = await supabase.from('disclosure_insights').select('*').order('created_at', { ascending: false });
      const { data: ind } = await supabase.from('market_indices').select('*').order('name', { ascending: true });
      
      if (ins) {
        // 동일 종목의 중복 공시를 제거하고 최신 것만 유지
        const unique = Array.from(new Map(ins.map(item => [item.corp_name, item])).values());
        setInsights(unique.slice(0, 6));
      }
      if (ind) setIndices(ind);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 300000); // 5분 주기
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative">
      <div className="sticky top-[64px] z-40 bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-800/50 py-2">
        <div className="max-w-7xl mx-auto px-6 flex justify-center gap-3">
          {indices.map(idx => (
            <StatCard key={idx.name} title={idx.name} value={idx.current_val} />
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-6">
        <h2 className="text-2xl font-bold text-white italic mb-8">"While you were sleeping"</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {insights.map(item => (
            <div 
              key={item.id} 
              // 수정 포인트: 'item.stock_code'가 정확한 변수명인지 확인 (crawler.py 기준)
              onClick={() => navigate(`/stock/${item.stock_code}`)} 
              className="bg-slate-900 border border-slate-800 p-5 rounded-2xl hover:border-blue-500/50 transition cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-3">
                <span className="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">{item.sentiment}</span>
                <span className="text-slate-500 text-[10px]">{new Date(item.created_at).toLocaleTimeString()}</span>
              </div>
              <h4 className="font-bold text-lg text-white mb-2">{item.corp_name}</h4>
              <p className="text-slate-400 text-xs line-clamp-2 mb-4">{item.report_nm}</p>
              <div className="flex items-center justify-between text-blue-500 text-[10px] font-bold">
                <span>ANALYZE FILINGS</span>
                <ChevronRight size={14}/>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

// --- 화면 2: 종목 상세 페이지 ---
function StockDetailPage() {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getLogs = async () => {
      if (!ticker || ticker === 'undefined') return;
      
      setLoading(true);
      const { data: res } = await supabase
        .from('disclosure_insights')
        .select('*')
        .eq('stock_code', ticker) // crawler.py에서 저장한 컬럼명 사용
        .order('created_at', { ascending: false });
      
      setData(res || []);
      setLoading(false);
    };
    getLogs();
  }, [ticker]);

  if (loading) return <div className="flex justify-center p-20 min-h-screen bg-[#0f172a]"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div className="max-w-4xl mx-auto p-10 text-white min-h-screen">
      <button onClick={() => navigate('/')} className="text-slate-500 text-sm hover:text-white mb-6 flex items-center gap-1">
        <ArrowLeft size={16}/> Back to Dashboard
      </button>
      
      {data.length > 0 ? (
        <>
          <h1 className="text-3xl font-bold mb-8">{data[0].corp_name} History</h1>
          <div className="space-y-4">
            {data.map(f => (
              <div key={f.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <h3 className="font-bold mb-3">{f.report_nm}</h3>
                <div className="bg-[#0f172a] p-4 rounded-xl text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {f.ai_summary}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-20 text-slate-500">
          <AlertCircle className="mx-auto mb-4" />
          Information Not Found (Ticker: {ticker})
        </div>
      )}
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
            <span className="text-xl font-bold text-white tracking-tighter uppercase">K-Market <span className="text-blue-500">Insight</span></span>
          </Link>
          <div className="flex gap-6 text-[10px] font-bold text-slate-400 uppercase">
             <Link to="/markets">Markets</Link>
             <Link to="/" className="text-white">AI Summaries</Link>
             <Link to="/governance">Governance</Link>
          </div>
          <div className="bg-blue-600/10 text-blue-500 border border-blue-500/20 px-3 py-1 rounded-full text-[9px] font-bold">PRO PLAN</div>
        </nav>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stock/:ticker" element={<StockDetailPage />} />
        </Routes>
      </div>
    </Router>
  );
}