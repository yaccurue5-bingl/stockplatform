import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { Globe, ChevronRight, Loader2, ArrowLeft } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { supabase } from './supabaseClient';

// --- [개선] 지수 카드 (높이를 대폭 줄인 초슬림 버전) ---
const DynamicStatCard = ({ title, value, history }) => {
  const chartData = history ? (typeof history === 'string' ? JSON.parse(history) : history).map(v => ({ val: v })) : [];
  
  let strokeColor = "#3b82f6";
  if (chartData.length >= 2) {
    const first = chartData[0].val;
    const last = chartData[chartData.length - 1].val;
    strokeColor = last > first ? "#10b981" : last < first ? "#f43f5e" : "#3b82f6";
  }

  return (
    <div className="flex items-center gap-3 bg-slate-900/40 border border-slate-800/50 px-3 py-1.5 rounded-lg backdrop-blur-sm min-w-[130px]">
      <div className="flex flex-col">
        <p className="text-slate-500 text-[8px] font-bold uppercase leading-none mb-1">{title}</p>
        <h3 className="text-[11px] font-black text-white leading-none">{value || '---'}</h3>
      </div>
      <div className="h-4 w-10">
        <ResponsiveContainer>
          <LineChart data={chartData.slice(-10)}>
            <Line type="monotone" dataKey="val" stroke={strokeColor} strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// --- [유지] 상세 페이지 디자인 ---
function StockDetailPage() {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const [stockInsights, setStockInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const { data } = await supabase
          .from('disclosure_insights')
          .select('*')
          .eq('stock_code', ticker)
          .order('created_at', { ascending: false });
        if (data) setStockInsights(data);
      } catch (err) {
        console.error('Error fetching detail:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [ticker]);

  if (loading) return (
    <div className="text-white p-10 flex justify-center bg-[#060b18] min-h-screen">
      <Loader2 className="animate-spin mr-2" /> 상세 데이터를 불러오는 중...
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6 text-white min-h-screen">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors">
        <ArrowLeft size={20} /> 뒤로 가기
      </button>
      {stockInsights.length > 0 ? (
        <div className="space-y-6">
          <h1 className="text-3xl font-black mb-2">{stockInsights[0].corp_name} 전문 분석</h1>
          <p className="text-slate-400 mb-10">종목 코드: {ticker}</p>
          {stockInsights.map((item) => (
            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
              <h2 className="text-xl font-bold mb-6 text-blue-400">"{item.report_nm}"</h2>
              <div className="bg-slate-800/30 p-6 rounded-2xl border border-slate-800/50">
                <h3 className="text-sm font-bold text-slate-500 uppercase mb-4 tracking-widest">AI 통합 요약</h3>
                <div className="space-y-4">
                  {item.ai_summary?.split('\n').map((line, idx) => (
                    <div key={idx} className="flex gap-3 text-slate-300 leading-relaxed">
                      <span className="text-blue-500 font-bold">•</span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-8 flex justify-between items-center text-xs text-slate-500">
                <span>공시 번호: {item.rcept_no}</span>
                <span>분석 일시: {new Date(item.created_at).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      ) : <div className="text-center py-20">분석 데이터가 존재하지 않습니다.</div>}
    </div>
  );
}

// --- [수정] 대시보드 메인 (게이지 제거 및 슬림 레이아웃) ---
function Dashboard() {
  const [insights, setInsights] = useState([]);
  const [indices, setIndices] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    const { data: ins } = await supabase.from('disclosure_insights').select('*').order('created_at', { ascending: false });
    const { data: ind } = await supabase.from('market_indices').select('*');
    
    if (ins) {
      // [수정] 동일 회사 중복 카드 통합 로직
      const uniqueInsights = ins.reduce((acc, current) => {
        const x = acc.find(item => item.stock_code === current.stock_code);
        if (!x) return acc.concat([current]);
        return acc;
      }, []);
      setInsights(uniqueInsights);
    }
    if (ind) {
      setIndices(ind.filter(i => i.name !== 'FEAR_GREED'));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const sub = supabase.channel('any').on('postgres_changes', { event: '*', schema: 'public', table: 'disclosure_insights' }, fetchData).subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  if (loading) return <div className="min-h-screen bg-[#060b18] flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div>
      {/* 상단 지수 영역: 높이(py-1.5) 축소 및 게이지 컴포넌트 제거 */}
      <div className="sticky top-[56px] z-40 bg-[#060b18]/80 backdrop-blur-xl border-b border-white/5 py-1.5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {indices.map(idx => <DynamicStatCard key={idx.name} title={idx.name} value={idx.current_val} history={idx.history} />)}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-6 mt-4">
        <div className="flex items-center gap-3 mb-8">
            <div className="h-1 w-8 bg-blue-600 rounded-full"></div>
            <h2 className="text-xl font-black text-white tracking-tighter uppercase italic">While you were sleeping</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {insights.map(item => (
            <div 
              key={item.id} 
              onClick={() => navigate(`/stock/${item.stock_code}`)}
              className="group relative bg-[#0f172a] border border-slate-800/50 p-5 rounded-2xl hover:bg-slate-800/40 transition-all cursor-pointer shadow-lg"
            >
              <div className={`absolute top-0 left-0 w-full h-1 rounded-t-2xl ${item.sentiment === 'POSITIVE' ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[9px] font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded tracking-widest uppercase">{item.sentiment} ANALYSIS</span>
                <span className="text-slate-600 text-[9px]">{new Date(item.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
              </div>
              <h4 className="font-bold text-base text-white mb-1 group-hover:text-blue-400 transition-colors">{item.corp_name}</h4>
              <p className="text-slate-500 text-[11px] leading-relaxed line-clamp-2">{item.report_nm}</p>
              <div className="mt-4 pt-3 border-t border-slate-800/50 flex justify-between items-center">
                <span className="text-slate-700 text-[9px] font-mono">#{item.stock_code}</span>
                <ChevronRight size={14} className="text-slate-700 group-hover:text-blue-500 transition-all" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#060b18]">
        {/* 상단 네비게이션: 높이(h-56) 축소 */}
        <nav className="h-[56px] sticky top-0 z-50 bg-[#060b18] border-b border-white/5 px-6 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-blue-600 p-1 rounded-lg"><Globe size={18} className="text-white" /></div>
            <span className="text-lg font-black text-white tracking-tighter uppercase">K-Market <span className="text-blue-500">Insight</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-[9px] font-black text-emerald-500 tracking-widest uppercase">Live Alpha</span>
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