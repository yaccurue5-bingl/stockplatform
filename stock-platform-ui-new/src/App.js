import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { Globe, ChevronRight, MessageSquare, Loader2, ArrowLeft, Zap } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from './supabaseClient';

// --- [개선] 공포와 탐욕 게이지 (눈금 및 라벨 추가) ---
const FearGreedGauge = ({ score = 50 }) => {
  const data = [
    { value: 25, name: 'Ext. Fear', color: '#ef4444' },
    { value: 25, name: 'Fear', color: '#f97316' },
    { value: 25, name: 'Greed', color: '#eab308' },
    { value: 25, name: 'Ext. Greed', color: '#22c55e' }
  ];
  const RADIAN = Math.PI / 180;
  const cx = 60, cy = 45, iR = 25, oR = 40;

  const needle = (value) => {
    const ang = 180.0 * (1 - value / 100);
    const length = (iR + oR) / 2;
    const sin = Math.sin(-RADIAN * ang), cos = Math.cos(-RADIAN * ang);
    return [
      <circle key="c" cx={cx} cy={cy} r={3} fill="#fff" />,
      <path key="p" d={`M${cx-2*sin} ${cy+2*cos}L${cx+2*sin} ${cy-2*cos}L${cx+length*cos} ${cy+length*sin}Z`} fill="#fff" />
    ];
  };

  return (
    <div className="w-[125px] h-[75px] bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col items-center justify-center relative shadow-inner">
      <ResponsiveContainer width="100%" height={55}>
        <PieChart>
          <Pie dataKey="value" startAngle={180} endAngle={0} data={data} cx={cx} cy={cy} innerRadius={iR} outerRadius={oR} stroke="none">
            {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          {needle(score)}
        </PieChart>
      </ResponsiveContainer>
      {/* 게이지 하단 라벨 (20, 50, 80 표시) */}
      <div className="flex justify-between w-full px-4 -mt-2.5 text-[7px] font-bold text-slate-500 uppercase tracking-tighter">
        <span>FEAR</span>
        <span className="text-white font-black text-[10px]">{score}</span>
        <span>GREED</span>
      </div>
    </div>
  );
};

// --- [개선] 지수 카드 (상승/하락 색상 스파크라인) ---
const DynamicStatCard = ({ title, value, history }) => {
  const chartData = history ? (typeof history === 'string' ? JSON.parse(history) : history).map(v => ({ val: v })) : [];
  
  // 스파크라인 색상 결정 (첫 값 대비 마지막 값 비교)
  let strokeColor = "#3b82f6"; // 기본 파랑
  if (chartData.length >= 2) {
    const first = chartData[0].val;
    const last = chartData[chartData.length - 1].val;
    strokeColor = last > first ? "#10b981" : last < first ? "#f43f5e" : "#3b82f6";
  }

  return (
    <div className="min-w-[145px] bg-slate-900/60 border border-slate-800/50 p-2 rounded-xl backdrop-blur-sm">
      <div className="flex justify-between items-center mb-0.5">
        <p className="text-slate-500 text-[9px] font-bold uppercase">{title}</p>
        <div className="h-4 w-12">
            <ResponsiveContainer>
              <LineChart data={chartData.slice(-10)}>
                <Line type="monotone" dataKey="val" stroke={strokeColor} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
        </div>
      </div>
      <h3 className="text-xs font-black text-white">{value || '---'}</h3>
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
      const { data } = await supabase.from('disclosure_insights').select('*').eq('stock_code', ticker).order('created_at', { ascending: false });
      if (data) setStockInsights(data);
      setLoading(false);
    };
    fetchDetail();
  }, [ticker]);

  if (loading) return <div className="min-h-screen bg-[#060b18] flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="max-w-4xl mx-auto p-6 min-h-screen text-slate-200">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-white mb-10 transition-all group">
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
      </button>
      
      <div className="mb-12 border-l-4 border-blue-500 pl-6">
        <h1 className="text-4xl font-black text-white tracking-tight mb-2">{stockInsights[0]?.corp_name}</h1>
        <p className="text-slate-500 font-mono tracking-tighter">STOCK_ID: {ticker}</p>
      </div>

      <div className="space-y-8">
        {stockInsights.map((item) => (
          <div key={item.id} className="bg-[#0f172a] border border-slate-800/50 rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-slate-800/50 flex justify-between items-center bg-gradient-to-r from-slate-900 to-transparent">
               <span className="text-blue-400 font-bold text-sm uppercase tracking-widest">AI Deep Summary</span>
               <span className="text-slate-500 text-xs">{new Date(item.created_at).toLocaleDateString()}</span>
            </div>
            <div className="p-8">
              <h2 className="text-xl font-bold mb-8 text-white leading-snug">"{item.report_nm}"</h2>
              <div className="space-y-4 bg-slate-900/50 p-6 rounded-2xl border border-slate-800/30 shadow-inner">
                {item.ai_summary?.split('\n').filter(l => l.trim()).map((line, i) => (
                  <div key={i} className="flex gap-4 items-start">
                    <Zap size={16} className="text-blue-500 mt-1 shrink-0" />
                    <p className="text-slate-300 leading-relaxed text-sm lg:text-base">{line}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- [유지] 대시보드 메인 ---
function Dashboard() {
  const [insights, setInsights] = useState([]);
  const [indices, setIndices] = useState([]);
  const [fgScore, setFgScore] = useState(50);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    const { data: ins } = await supabase.from('disclosure_insights').select('*').order('created_at', { ascending: false });
    const { data: ind } = await supabase.from('market_indices').select('*');
    if (ins) setInsights(ins);
    if (ind) {
      setIndices(ind.filter(i => i.name !== 'FEAR_GREED'));
      const fg = ind.find(i => i.name === 'FEAR_GREED');
      if (fg) setFgScore(parseInt(fg.current_val));
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
      <div className="sticky top-[64px] z-40 bg-[#060b18]/80 backdrop-blur-xl border-b border-white/5 py-2">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center gap-4">
          <div className="flex gap-3 overflow-x-auto scrollbar-hide flex-grow">
            {indices.map(idx => <DynamicStatCard key={idx.name} title={idx.name} value={idx.current_val} history={idx.history} />)}
          </div>
          <FearGreedGauge score={fgScore} />
        </div>
      </div>

      <main className="max-w-7xl mx-auto p-6 mt-8">
        <div className="flex items-center gap-3 mb-10">
            <div className="h-1 w-12 bg-blue-600 rounded-full"></div>
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">While you were sleeping</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {insights.map(item => (
            <div 
              key={item.id} 
              onClick={() => navigate(`/stock/${item.stock_code}`)}
              className="group relative bg-[#0f172a] border border-slate-800/50 p-6 rounded-3xl hover:bg-slate-800/40 hover:border-blue-500/30 transition-all cursor-pointer shadow-xl"
            >
              <div className={`absolute top-0 left-0 w-full h-1 rounded-t-3xl ${item.sentiment === 'POSITIVE' ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded uppercase tracking-widest">{item.sentiment} ANALYSIS</span>
                <span className="text-slate-600 text-[10px]">{new Date(item.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
              </div>
              <h4 className="font-bold text-lg text-white mb-2 group-hover:text-blue-400 transition-colors">{item.corp_name}</h4>
              <p className="text-slate-500 text-xs leading-relaxed line-clamp-2">{item.report_nm}</p>
              <div className="mt-6 pt-4 border-t border-slate-800/50 flex justify-between items-center">
                <span className="text-slate-700 text-[10px] font-mono tracking-widest">#{item.stock_code}</span>
                <ChevronRight size={16} className="text-slate-700 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
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
        <nav className="h-[64px] sticky top-0 z-50 bg-[#060b18] border-b border-white/5 px-8 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-3">
            <div className="bg-blue-600 p-1.5 rounded-lg"><Globe size={20} className="text-white" /></div>
            <span className="text-xl font-black text-white tracking-tighter uppercase">K-Market <span className="text-blue-500">Insight</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-black text-emerald-500 tracking-widest uppercase">Live Alpha</span>
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