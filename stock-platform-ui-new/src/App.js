import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { Globe, ChevronRight, Clock, MessageSquare, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from './supabaseClient';

// --- 공포와 탐욕 게이지 컴포넌트 ---
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

// --- 역동적 지수 카드 (스파크라인 포함) ---
const DynamicStatCard = ({ title, value, change, history }) => {
  const isPositive = parseFloat(change) >= 0;
  // 문자열 형태의 history 데이터를 배열로 변환
  const chartData = history ? JSON.parse(history).map((v, i) => ({ val: v })) : [];

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
        // 기존 6개 제한을 풀고 싶다면 slice를 조정하세요.
        const unique = Array.from(new Map(ins.map(item => [item.corp_name, item])).values());
        setInsights(unique); // 전체 표시
      }
      if (ind) {
        const fg = ind.find(i => i.name === 'FEAR_GREED');
        if (fg) setFgScore(parseInt(fg.current_val));
        setIndices(ind.filter(i => i.name !== 'FEAR_GREED'));
      }
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'market_indices' }, () => fetchData())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  return (
    <div className="relative">
      <div className="sticky top-[64px] z-40 bg-[#0f172a]/95 backdrop-blur-md border-b border-slate-800/50 py-4">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center gap-6">
          {/* 좌측: 3대 지수 */}
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {indices.length > 0 ? (
              indices.map(idx => (
                <DynamicStatCard 
                  key={idx.name} 
                  title={idx.name} 
                  value={idx.current_val} 
                  change={idx.change_rate}
                  history={idx.history}
                />
              ))
            ) : (
              ['KOSPI', 'KOSDAQ', 'USD/KRW'].map(name => <StatCard key={name} title={name} value="Loading..." />)
            )}
          </div>
          {/* 우측: 공포 탐욕 지수 */}
          <FearGreedGauge score={fgScore} />
        </div>
      </div>

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
                  {item.sentiment || 'NEUTRAL'}
                </span>
                <span className="text-slate-500 text-[10px]">{new Date(item.created_at).toLocaleTimeString()}</span>
              </div>
              <h4 className="font-bold text-lg text-white mb-1">{item.corp_name}</h4>
              <p className="text-slate-400 text-xs line-clamp-2 mb-4">{item.report_nm}</p>
              
              {/* 하단 정보 추가: 종목코드 및 원문 링크 느낌 */}
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

// StatCard 기본 컴포넌트 (로딩용)
const StatCard = ({ title, value }) => (
  <div className="w-44 lg:w-52 bg-slate-900/80 border border-slate-800 p-3 rounded-xl flex flex-col justify-center shadow-lg">
    <p className="text-slate-500 text-[10px] font-bold uppercase mb-0.5 tracking-wider">{title}</p>
    <h3 className="text-base font-bold text-white tracking-tight">{value || '---'}</h3>
  </div>
);

// StockDetailPage 및 App 컴포넌트는 기존과 동일하게 유지...
// (이하 생략 - 기존 코드의 StockDetailPage와 App 정의를 그대로 붙여넣으세요)