import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Globe, AlertCircle, BarChart3, ChevronRight } from 'lucide-react';
import { supabase } from './services/supabase-auth-service';

/**
 * [공통 유틸리티]
 * 숫자를 $M, $K 단위로 포맷팅합니다.
 */
const formatUSD = (val) => new Intl.NumberFormat('en-US', { 
  style: 'currency', 
  currency: 'USD', 
  notation: 'compact' 
}).format(val);

/**
 * 2번 요청: 지표 카드 컴포넌트
 * @param {string} size - 'w-64' 등으로 크기를 직접 조정할 수 있도록 주석 처리된 부분입니다.
 */
const StatCard = ({ title, value, change, isUp, size = "w-full" }) => (
  /* 아래 className에서 'w-full' 부분을 'max-w-[280px]' 등으로 바꾸어 전체적인 카드의 너비를 제한할 수 있습니다. */
  <div className={`${size} bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex flex-col justify-between`}>
    <p className="text-slate-500 text-[10px] font-bold uppercase mb-1">{title}</p>
    <div className="flex justify-between items-end">
      <h3 className="text-xl font-bold text-white">{value}</h3>
      {change && (
        <span className={`text-[11px] font-medium flex items-center gap-1 ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
          {isUp ? <TrendingUp size={12}/> : <TrendingDown size={12}/>} {change}
        </span>
      )}
    </div>
  </div>
);

function Dashboard() {
  const [insights, setInsights] = useState([]);
  const [marketData, setMarketData] = useState({
    kospi: { value: "2,580.44", change: "+0.82%", isUp: true },
    exchange: { value: "1,342.10", change: "-0.15%", isUp: false },
    netBuy: { value: 245000000 }
  });
  const [loading, setLoading] = useState(true);

  // 3번 요청: 실시간(지연) 지표 가져오기 로직
  useEffect(() => {
    const fetchMarketInfo = async () => {
      // 실제 API(예: Yahoo Finance, 한국거래소 등) 연동 지점입니다. 
      // 현재는 1분마다 랜덤하게 변동을 주는 시뮬레이션 로직을 배치합니다.
      const interval = setInterval(() => {
        setMarketData(prev => ({
          ...prev,
          kospi: { ...prev.kospi, value: (2580 + Math.random() * 10).toFixed(2) }
        }));
      }, 60000); // 1분 간격 업데이트

      return () => clearInterval(interval);
    };

    const fetchInsights = async () => {
      // 4번 요청: 종목당 하나의 박스만 노출하기 위해 중복 제거 로직 포함
      const { data, error } = await supabase
        .from('disclosure_insights')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        // 종목명(corp_name) 기준으로 가장 최신 데이터 1개씩만 추출
        const uniqueEntries = Array.from(new Map(data.map(item => [item.corp_name, item])).values());
        setInsights(uniqueEntries.slice(0, 6)); // 상위 6개 종목만 노출
      }
      setLoading(false);
    };

    fetchMarketInfo();
    fetchInsights();
  }, []);

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-sans">
      {/* 1번 요청: 로고 클릭 시 홈 이동 (Link 컴포넌트 활용) */}
      <nav className="border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex justify-between items-center">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition">
          <div className="bg-blue-600 p-1.5 rounded-lg text-white"><Globe size={20}/></div>
          <span className="text-xl font-bold tracking-tight text-white">K-Market <span className="text-blue-500">Insight</span></span>
        </Link>
        
        {/* 5번 요청: 메뉴 클릭 시 연결 페이지 이동 (to="/경로" 수정 가능) */}
        <div className="hidden md:flex gap-8 text-sm font-medium text-slate-400">
          <Link to="/markets" className="hover:text-white transition">Markets</Link>
          <Link to="/summaries" className="text-white border-b-2 border-blue-500 pb-1">AI Summaries</Link>
          <Link to="/governance" className="hover:text-white transition">Governance</Link>
        </div>
        <button className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-full text-[10px] font-bold transition uppercase">
          PRO PLAN
        </button>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        {/* 2번 요청: 지표 영역 크기 조정 및 고정 */}
        <div className="flex flex-wrap lg:flex-nowrap gap-4 mb-10 justify-center">
          <StatCard title="KOSPI Index" value={marketData.kospi.value} change={marketData.kospi.change} isUp={marketData.kospi.isUp} size="w-full lg:w-64" />
          <StatCard title="USD/KRW Exchange" value={marketData.exchange.value} change={marketData.exchange.change} isUp={marketData.exchange.isUp} size="w-full lg:w-64" />
          <StatCard title="Foreigner Net Buy" value={formatUSD(marketData.netBuy.value)} isUp={true} size="w-full lg:w-64" />
        </div>

        {/* 4번 요청: 공시 내용 요약 섹션 */}
        <section className="mb-12">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1 italic">"While you were sleeping"</h2>
              <p className="text-slate-400 text-xs">A unified view of the latest filings per company.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? [1,2,3].map(i => <div key={i} className="h-40 bg-slate-800 animate-pulse rounded-2xl"></div>) : 
              insights.map((item) => (
                // 카드 클릭 시 해당 종목의 상세 리스트 페이지로 이동하도록 설정
                <Link to={`/stock/${item.stock_code}`} key={item.id} className="bg-slate-900 border border-slate-800 p-5 rounded-2xl hover:bg-slate-800/50 hover:border-blue-500/50 transition-all group cursor-pointer">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded ${item.sentiment === 'POSITIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                      {item.sentiment || 'NEUTRAL'}
                    </span>
                    <span className="text-slate-500 text-[10px]">{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                  <h4 className="font-bold text-lg text-white mb-2">{item.corp_name}</h4>
                  <p className="text-slate-400 text-xs line-clamp-2 leading-relaxed mb-4">
                    Latest: {item.report_nm}
                  </p>
                  <div className="flex items-center justify-between text-blue-400 text-[10px] font-bold">
                    <span>VIEW 5 RECENT FILINGS</span>
                    <ChevronRight size={14}/>
                  </div>
                </Link>
              ))
            }
          </div>
        </section>

        {/* 하단 영역 (기존 유지) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 border-t border-slate-800 pt-10">
          <div className="lg:col-span-2 bg-slate-900/30 border border-slate-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><BarChart3 size={18} className="text-blue-500"/> Foreigner's Strategy Map</h3>
            <div className="h-48 flex items-center justify-center border border-dashed border-slate-800 rounded-xl text-slate-600 text-sm">Sector Analysis Coming Soon</div>
          </div>
          <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-6 text-sm">
             <h3 className="text-white font-bold mb-4">Governance Alert</h3>
             <div className="text-slate-500 text-xs">No critical alerts for the last 24 hours.</div>
          </div>
        </div>
      </main>
    </div>
  );
}

// 5번 요청: 연결된 페이지들을 위한 임시 컴포넌트
const PlaceholderPage = ({ title }) => (
  <div className="min-h-screen bg-[#0f172a] flex items-center justify-center text-white">
    <h1 className="text-3xl font-bold">{title} Page Coming Soon</h1>
    <Link to="/" className="ml-4 text-blue-500 underline">Back Home</Link>
  </div>
);

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        {/* 상세 페이지 및 메뉴 페이지 라우팅 */}
        <Route path="/markets" element={<PlaceholderPage title="Markets" />} />
        <Route path="/summaries" element={<PlaceholderPage title="AI Summaries" />} />
        <Route path="/governance" element={<PlaceholderPage title="Governance" />} />
        <Route path="/stock/:ticker" element={<PlaceholderPage title="Stock Detail" />} />
      </Routes>
    </Router>
  );
}

export default App;