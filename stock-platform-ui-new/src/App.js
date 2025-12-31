import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { Globe, ChevronRight, MessageSquare, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from './supabaseClient';

// --- [공용 컴포넌트] 공포와 탐욕 게이지 ---
const FearGreedGauge = ({ score = 50 }) => {
  const data = [
    { value: 25, color: '#ef4444' }, // Extreme Fear
    { value: 25, color: '#f97316' }, // Fear
    { value: 25, color: '#eab308' }, // Greed
    { value: 25, color: '#22c55e' }, // Extreme Greed
  ];

  const RADIAN = Math.PI / 180;
  const cx = 90, cy = 80, iR = 45, oR = 70;

  const needle = (value, cx, cy, iR, oR, color) => {
    const ang = 180.0 * (1 - value / 100);
    const length = (iR + oR) / 2;
    const sin = Math.sin(-RADIAN * ang), cos = Math.cos(-RADIAN * ang);
    const r = 4;
    return [
      <circle key="c" cx={cx} cy={cy} r={r} fill={color} />,
      <path key="p" d={`M${cx - r * sin} ${cy + r * cos}L${cx + r * sin} ${cy - r * cos}L${cx + length * cos} ${cy + length * sin}Z`} fill={color} />
    ];
  };

  const getStatusText = (s) => {
    if (s <= 25) return "EXTREME FEAR";
    if (s <= 50) return "FEAR";
    if (s <= 75) return "GREED";
    return "EXTREME GREED";
  };

  return (
    <div className="w-[180px] h-[120px] bg-slate-900/50 rounded-xl border border-slate-800 flex flex-col items-center justify-center overflow-hidden">
      <ResponsiveContainer width="100%" height={100}>
        <PieChart>
          <Pie dataKey="value" startAngle={180} endAngle={0} data={data} cx={cx} cy={cy} innerRadius={iR} outerRadius={oR} stroke="none">
            {data.map((entry, index) => <Cell key={index} fill={entry.color} />)}
          </Pie>
          {needle(score, cx, cy, iR, oR, '#fff')}
        </PieChart>
      </ResponsiveContainer>
      <div className="text-center -mt-4 pb-2">
        <span className="text-white text-sm font-black">{score}</span>
        <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">{getStatusText(score)}</p>
      </div>
    </div>
  );
};

// --- [공용 컴포넌트] 마켓 지수 카드 ---
const DynamicStatCard = ({ title, value, change, history }) => {
  const isPositive = parseFloat(change) >= 0;
  const chartData = history ? JSON.parse(history).map((v) => ({ val: v })) : [];

  return (
    <div className="w-44 lg:w-52 bg-slate-900/80 border border-slate-800 p-3 rounded-xl shadow-lg relative overflow-hidden">
      <div className="flex justify-between items-start mb-1">
        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{title}</p>
        <span className={`text-[9px] font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
          {isPositive ? '▲' : '▼'} {Math.abs(change) || '0.00'}%
        </span>
      </div>
      <h3 className="text-base font-bold text-white tracking-tight mb-2">{value || '---'}</h3>
      <div className="h-8 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <Line type="monotone" dataKey="val" stroke={isPositive ? '#10b981' : '#f43f5e'} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// --- [페이지] 공시 상세 정보 ---
function StockDetailPage() {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const [stockInsights, setStockInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStockData = async () => {
      try {
        const { data } = await supabase
          .from('disclosure_insights')
          .select('*')
          .eq('stock_code', ticker)
          .order('created_at', { ascending: false });
        if (data) setStockInsights(data);
      } catch (err) {
        console.error("Fetch detail error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStockData();
  }, [ticker]);

  if (loading) return <div className="text-white p-10 flex items-center justify-center min-h-screen bg-[#0f172a]"><Loader2 className="animate-spin mr-2" /> Loading detail...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 text-white min-h-screen">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors">
        <ArrowLeft size={20} /> Back to List
      </button>
      
      {stockInsights.length > 0 ? (
        <div className="space-y-8">
          <div className="border-b border-slate-800 pb-6">
            <h1 className="text-3xl font-bold mb-2">{stockInsights[0].corp_name}</h1>
            <p className="text-slate-500 font-mono italic">Stock Code: #{ticker}</p>
          </div>

          {stockInsights.map((item) => (
            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <span className={`px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${item.sentiment === 'POSITIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                  {item.sentiment} ANALYSIS
                </span>
                <span className="text-slate-500 text-sm italic">{new Date(item.created_at).toLocaleDateString()}</span>
              </div>
              
              <h2 className="text-xl font-bold mb-6 text-blue-400 leading-tight">"{item.report_nm}"</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                    <MessageSquare size={14} /> AI Integrated Summary
                  </h3>
                  {/* 줄바꿈(\n)을 기준으로 리스트화하여 출력 */}
                  <div className="bg-slate-800/30 p-6 rounded-2xl border border-slate-800/50 space-y-4 shadow-inner">
                    {item.ai_summary.split('\n').filter(line => line.trim() !== '').map((line, idx) => (
                      <div key={idx} className="flex gap-3 text-slate-300 leading-relaxed">
                        <span className="text-blue-500 font-bold shrink-0">•</span>
                        <span>{line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 flex flex-col items-center">
            <AlertCircle className="mx-auto mb-4 text-slate-700" size={48} />
            <p className="text-slate-500">No details found for Ticker: {ticker}</p>
        </div>
      )}
    </div>
  );
}

// --- [페이지] 대시보드 메인 ---
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
      
      if (ins) {
        // 동일 기업의 여러 공시가 크롤러에서 통합되지 않았을 경우를 대비한 클라이언트 사이드 그룹화 (옵션)
        setInsights(ins); 
      }
      if (ind) {
        const fg = ind.find(i => i.name === 'FEAR_GREED');
        if (fg) setFgScore(parseInt(fg.current_val));
        setIndices(ind.filter(i => i.name !== 'FEAR_GREED'));
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('market-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'market_indices' }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  if (loading) return <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white"><Loader2 className="animate-spin mr-2" /> Loading Dashboard...</div>;

  return (
    <div className="relative">
      {/* 상단 지수 바 */}
      <div className="sticky top-[64px] z-40 bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-800/50 py-4">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-between items-center gap-6">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide flex-grow">
            {indices.map(idx => (
              <DynamicStatCard 
                key={idx.name} 
                title={idx.name} 
                value={idx.current_val} 
                change={idx.change_rate}
                history={idx.history}
              />
            ))}
          </div>
          <FearGreedGauge score={fgScore} />
        </div>
      </div>

      {/* 공시 리스트 */}
      <main className="max-w-7xl mx-auto p-6">
        <h2 className="text-2xl font-bold text-white italic mb-8">"While you were sleeping"</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {insights.map(item => (
            <div 
              key={item.id} 
              onClick={() => navigate(`/stock/${item.stock_code}`)} 
              className="bg-slate-900 border border-slate-800 p-5 rounded-2xl hover:border-blue-500/50 transition cursor-pointer group"
            >
              <div className="flex justify-between items-start mb-3">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${item.sentiment === 'POSITIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                  {item.sentiment}
                </span>
                <span className="text-slate-500 text-[10px]">{new Date(item.created_at).toLocaleTimeString()}</span>
              </div>
              <h4 className="font-bold text-lg text-white mb-1">{item.corp_name}</h4>
              <p className="text-slate-400 text-xs line-clamp-2 mb-4">{item.report_nm}</p>
              
              <div className="flex justify-between items-center pt-4 border-t border-slate-800/50">
                <span className="text-slate-600 text-[10px] font-bold uppercase tracking-tighter">#{item.stock_code}</span>
                <div className="flex items-center gap-1 text-blue-500 text-[10px] font-bold opacity-0 group-hover:opacity-100 transition">
                  <span>VIEW ANALYTICS</span>
                  <ChevronRight size={14}/>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

// --- [루트] App 컴포넌트 ---
export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-[#0f172a]">
        {/* 네비게이션 바 */}
        <nav className="h-[64px] sticky top-0 z-50 bg-[#0f172a] border-b border-slate-800 px-6 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <Globe className="text-blue-500" />
            <span className="text-xl font-black text-white tracking-tighter uppercase">K-Market <span className="text-blue-500">Insight</span></span>
          </Link>
          <div className="flex gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
             <Link to="/" className="text-white hover:text-blue-500 transition">AI Summaries</Link>
          </div>
          <div className="bg-blue-600/10 text-blue-500 px-3 py-1 rounded-full text-[10px] font-bold border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
             LIVE DATA
          </div>
        </nav>

        {/* 라우팅 설정 */}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stock/:ticker" element={<StockDetailPage />} />
        </Routes>
      </div>
    </Router>
  );
}