import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { Globe, ChevronRight, MessageSquare, Loader2, ArrowLeft, Zap } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from './supabaseClient';

// --- [개선] 공포와 탐욕 게이지 (눈금 및 라벨 추가) ---
// App.js 내 FearGreedGauge 컴포넌트 교체
const FearGreedGauge = ({ score = 50 }) => {
  const data = [
    { value: 25, name: '공포', color: '#ef4444' },
    { value: 25, name: '주의', color: '#f97316' },
    { value: 25, name: '탐욕', color: '#eab308' },
    { value: 25, name: '열광', color: '#22c55e' }
  ];

  const RADIAN = Math.PI / 180;
  // 바늘의 중심축과 크기 조정
  const cx = 100, cy = 90, iR = 50, oR = 80;

  const needle = (value) => {
    const ang = 180.0 * (1 - value / 100);
    const length = (iR + oR) / 2 + 10;
    const sin = Math.sin(-RADIAN * ang), cos = Math.cos(-RADIAN * ang);
    return [
      <circle key="c" cx={cx} cy={cy} r={6} fill="#fff" stroke="#0f172a" strokeWidth={2} />,
      <path key="p" d={`M${cx - 3 * sin} ${cy + 3 * cos}L${cx + 3 * sin} ${cy - 3 * cos}L${cx + length * cos} ${cy + length * sin}Z`} fill="#fff" />
    ];
  };

  return (
    <div className="w-[200px] h-[140px] bg-slate-900/90 rounded-2xl border border-slate-800 flex flex-col items-center justify-center relative shadow-2xl">
      <ResponsiveContainer width="100%" height={110}>
        <PieChart>
          <Pie dataKey="value" startAngle={180} endAngle={0} data={data} cx={cx} cy={cy} innerRadius={iR} outerRadius={oR} stroke="none">
            {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
          </Pie>
          {needle(score)}
        </PieChart>
      </ResponsiveContainer>
      
      {/* 게이지 내부 하단 숫자 표시 */}
      <div className="absolute bottom-6 flex flex-col items-center">
        <span className="text-2xl font-black text-white leading-none">{score}</span>
      </div>

      {/* 좌우 라벨 강화 */}
      <div className="flex justify-between w-full px-5 pb-2 text-[10px] font-black tracking-tighter uppercase">
        <span className="text-rose-500">FEAR</span>
        <span className="text-emerald-500">GREED</span>
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
// ... (기존 상단 코드 동일)

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
    <div className="text-white p-10 flex justify-center bg-[#0f172a] min-h-screen">
      <Loader2 className="animate-spin mr-2" /> 상세 분석 데이터를 불러오는 중...
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6 text-white min-h-screen">
      <button 
        onClick={() => navigate(-1)} 
        className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors"
      >
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
                  {/* 줄바꿈(\n)을 기준으로 나누어 리스트로 출력 */}
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
      ) : (
        <div className="text-center py-20">분석 데이터가 존재하지 않습니다.</div>
      )}
    </div>
  );
}

// ... (나머지 Dashboard 및 App 컴포넌트 동일)

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