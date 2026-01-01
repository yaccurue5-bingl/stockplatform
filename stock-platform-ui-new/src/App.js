import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { Globe, ChevronRight, MessageSquare, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from './supabaseClient';

// --- 축소된 공포와 탐욕 게이지 ---
const FearGreedGauge = ({ score = 50 }) => {
  const data = [{ value: 25, color: '#ef4444' }, { value: 25, color: '#f97316' }, { value: 25, color: '#eab308' }, { value: 25, color: '#22c55e' }];
  const RADIAN = Math.PI / 180;
  const cx = 60, cy = 50, iR = 30, oR = 45; // 크기 축소

  const needle = (value, cx, cy, iR, oR, color) => {
    const ang = 180.0 * (1 - value / 100);
    const length = (iR + oR) / 2;
    const sin = Math.sin(-RADIAN * ang), cos = Math.cos(-RADIAN * ang);
    return [<circle key="c" cx={cx} cy={cy} r={3} fill={color} />, <path key="p" d={`M${cx-3*sin} ${cy+3*cos}L${cx+3*sin} ${cy-3*cos}L${cx+length*cos} ${cy+length*sin}Z`} fill={color} />];
  };

  return (
    <div className="w-[120px] h-[75px] bg-slate-900/50 rounded-xl border border-slate-800 flex flex-col items-center justify-center overflow-hidden">
      <ResponsiveContainer width="100%" height={55}>
        <PieChart>
          <Pie dataKey="value" startAngle={180} endAngle={0} data={data} cx={cx} cy={cy} innerRadius={iR} outerRadius={oR} stroke="none">
            {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          {needle(score, cx, cy, iR, oR, '#fff')}
        </PieChart>
      </ResponsiveContainer>
      <div className="text-center -mt-2 pb-1">
        <span className="text-white text-[10px] font-black">{score}</span>
      </div>
    </div>
  );
};

const DynamicStatCard = ({ title, value, change, history }) => {
  const isPositive = parseFloat(change) >= 0;
  const chartData = history ? (typeof history === 'string' ? JSON.parse(history) : history).map(v => ({ val: v })) : [];
  return (
    <div className="w-40 lg:w-44 bg-slate-900/80 border border-slate-800 p-2 rounded-xl shadow-lg">
      <div className="flex justify-between items-start mb-0.5">
        <p className="text-slate-500 text-[9px] font-bold uppercase">{title}</p>
        <span className={`text-[8px] font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>{isPositive ? '▲' : '▼'}{Math.abs(change) || '0.0'}%</span>
      </div>
      <h3 className="text-sm font-bold text-white mb-1">{value || '---'}</h3>
      <div className="h-5 w-full">
        <ResponsiveContainer><LineChart data={chartData}><Line type="monotone" dataKey="val" stroke={isPositive ? '#10b981' : '#f43f5e'} strokeWidth={1.5} dot={false} /></LineChart></ResponsiveContainer>
      </div>
    </div>
  );
};

function StockDetailPage() {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const [stockInsights, setStockInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const { data } = await supabase.from('disclosure_insights').select('*').eq('stock_code', ticker).order('created_at', { ascending: false });
        if (data) setStockInsights(data);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchDetail();
  }, [ticker]);

  if (loading) return <div className="text-white p-10 flex justify-center bg-[#0f172a] min-h-screen"><Loader2 className="animate-spin mr-2" /> Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 text-white min-h-screen">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors"><ArrowLeft size={20} /> Back</button>
      {stockInsights.map((item) => (
        <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl mb-6">
          <h2 className="text-xl font-bold mb-6 text-blue-400">"{item.report_nm}"</h2>
          <div className="bg-slate-800/30 p-6 rounded-2xl border border-slate-800/50 space-y-4">
            {item.ai_summary?.split('\n').map((line, idx) => (
              <div key={idx} className="flex gap-3 text-slate-300 leading-relaxed">
                <span className="text-blue-500 font-bold">•</span><span>{line}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Dashboard() {
  const [insights, setInsights] = useState([]);
  const [indices, setIndices] = useState([]);
  const [fgScore, setFgScore] = useState(50);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      const { data: ins } = await supabase.from('disclosure_insights').select('*').order('created_at', { ascending: false });
      const { data: ind } = await supabase.from('market_indices').select('*').order('name', { ascending: true });
      if (ins) setInsights(ins);
      if (ind) {
        const fg = ind.find(i => i.name === 'FEAR_GREED');
        if (fg) setFgScore(parseInt(fg.current_val));
        setIndices(ind.filter(i => i.name !== 'FEAR_GREED'));
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('changes').on('postgres_changes', { event: '*', schema: 'public', table: 'market_indices' }, fetchData).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  if (loading) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="relative">
      {/* 지수바 높이 조절: py-4 -> py-2 */}
      <div className="sticky top-[64px] z-40 bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-800/50 py-2">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center gap-4">
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide flex-grow">
            {indices.map(idx => <DynamicStatCard key={idx.name} {...idx} />)}
          </div>
          <FearGreedGauge score={fgScore} />
        </div>
      </div>
      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {insights.map(item => (
          <div key={item.id} onClick={() => navigate(`/stock/${item.stock_code}`)} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl hover:border-blue-500/50 transition cursor-pointer">
            <h4 className="font-bold text-lg text-white mb-1">{item.corp_name}</h4>
            <p className="text-slate-400 text-xs line-clamp-2">{item.report_nm}</p>
          </div>
        ))}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#0f172a]">
        <nav className="h-[64px] sticky top-0 z-50 bg-[#0f172a] border-b border-slate-800 px-6 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2"><Globe className="text-blue-500" /><span className="text-xl font-black text-white uppercase tracking-tighter">K-Market Insight</span></Link>
          <div className="bg-blue-600/10 text-blue-500 px-3 py-1 rounded-full text-[10px] font-bold border border-blue-500/20">LIVE</div>
        </nav>
        <Routes><Route path="/" element={<Dashboard />} /><Route path="/stock/:ticker" element={<StockDetailPage />} /></Routes>
      </div>
    </Router>
  );
}