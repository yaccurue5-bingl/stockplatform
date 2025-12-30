import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
// AlertCircle을 추가하여 컴파일 에러 해결
import { Globe, TrendingUp, TrendingDown, ChevronRight, Clock, MessageSquare, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { supabase } from './supabaseClient';

// --- 컴포넌트: 상단 지표 카드 ---
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
      // SQL 인덱스 최적화에 맞춰 최신순 조회
      const { data: ins } = await supabase.from('disclosure_insights').select('*').order('created_at', { ascending: false });
      const { data: ind } = await supabase.from('market_indices').select('*').order('name', { ascending: true });
      
      if (ins) {
        // 회사별 최신 공시 1개씩만 추출 (중복 제거)
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
    // 5분 간격 새로고침 (사용자 요청 사항 반영)
    const timer = setInterval(fetchData, 300000); 
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
        
        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-500" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {insights.map(item => (
              <div 
                key={item.id} 
                // SQL 필드명인 stock_code를 사용하여 상세 페이지 이동
                onClick={() => navigate(`/stock/${item.stock_code}`)} 
                className="bg-slate-900 border border-slate-800 p-5 rounded-2xl hover:border-blue-500/50 transition cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${item.sentiment === 'POSITIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                    {item.sentiment || 'NEUTRAL'}
                  </span>
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
        )}
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
      if (!ticker || ticker === 'undefined') {
        setLoading(false);
        return;
      }
      
      setLoading(true);
      // stock_code 필드를 기준으로 해당 종목의 모든 공시 이력 조회
      const { data: res } = await supabase
        .from('disclosure_insights')
        .select('*')
        .eq('stock_code', ticker)
        .order('created_at', { ascending: false });
      
      setData(res || []);
      setLoading(false);
    };
    getLogs();
  }, [ticker]);

  if (loading) return <div className="flex justify-center p-20 min-h-screen bg-[#0f172a]"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div className="max-w-4xl mx-auto p-10 text-white min-h-screen">
      <button onClick={() => navigate('/')} className="text-slate-500 text-sm hover:text-white mb-6 flex items-center gap-1 transition">
        <ArrowLeft size={16}/> Back to Dashboard
      </button>
      
      {data.length > 0 ? (
        <>
          <div className="mb-10">
            <h1 className="text-4xl font-bold mb-2">{data[0].corp_name}</h1>
            <p className="text-slate-500 text-sm uppercase tracking-widest font-bold">Intelligence Feed: {ticker}</p>
          </div>
          <div className="space-y-6">
            {data.map(f => (
              <div key={f.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Clock size={12}/> {new Date(f.created_at).toLocaleString()}
                  </span>
                  <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded italic">
                    {f.category}
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-4 text-white leading-tight">{f.report_nm}</h3>
                <div className="bg-[#0f172a] p-5 rounded-xl border-l-4 border-blue-600">
                  <div className="flex gap-2 text-blue-500 mb-2 font-black text-[10px] tracking-widest uppercase">
                    <MessageSquare size={14}/> AI Insights
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{f.ai_summary}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-32 text-slate-600 flex flex-col items-center gap-4">
          <AlertCircle size={48} className="text-slate-800" />
          <p className="font-bold italic">No disclosures found for Ticker: {ticker}</p>
          <button onClick={() => navigate('/')} className="text-blue-500 text-sm underline">Return to main</button>
        </div>
      )}
    </div>
  );
}

// --- 메인 앱 구조 ---
export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#0f172a] font-sans">
        <nav className="h-[64px] sticky top-0 z-50 bg-[#0f172a]/80 backdrop-blur-lg border-b border-slate-800 px-6 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2 group">
            <Globe className="text-blue-500 group-hover:rotate-12 transition-transform" />
            <span className="text-xl font-black text-white tracking-tighter uppercase">K-Market <span className="text-blue-500">Insight</span></span>
          </Link>
          <div className="hidden md:flex gap-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
             <Link to="/" className="text-white">AI Summaries</Link>
             <Link to="/markets" className="hover:text-white transition">Markets</Link>
             <Link to="/governance" className="hover:text-white transition">Governance</Link>
          </div>
          <div className="bg-blue-600/10 text-blue-500 border border-blue-500/20 px-3 py-1 rounded-full text-[9px] font-black shadow-[0_0_15px_rgba(59,130,246,0.2)]">PRO PLAN</div>
        </nav>

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stock/:ticker" element={<StockDetailPage />} />
          <Route path="*" element={<div className="p-20 text-center text-slate-600 italic">This area is currently being analyzed by AI...</div>} />
        </Routes>
      </div>
    </Router>
  );
}