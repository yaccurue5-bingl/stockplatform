import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AlertCircle, Loader2, ArrowLeft, Clock, MessageSquare } from 'lucide-react';
import { supabase } from '../supabaseClient';

const StockDetailPage = () => {
  const { ticker } = useParams(); // URL의 종목코드 (예: 005930)
  const navigate = useNavigate();
  const [disclosures, setDisclosures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDisclosures = async () => {
      try {
        setLoading(true);
        // 1번 해결: 테이블명을 'disclosure_insights'로, 조건 필드를 'stock_code'로 변경
        const { data, error: fetchError } = await supabase
          .from('disclosure_insights')
          .select('*')
          .eq('stock_code', ticker)
          .order('created_at', { ascending: false })
          .limit(5); // 최근 5개 공시

        if (fetchError) throw fetchError;
        
        if (!data || data.length === 0) {
          setError(`종목코드 ${ticker}에 대한 최신 공시 데이터가 없습니다.`);
          return;
        }
        
        setDisclosures(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (ticker) fetchDisclosures();
  }, [ticker]);

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-500" /></div>;
  if (error) return (
    <div className="p-10 text-center">
      <AlertCircle className="mx-auto text-red-500 mb-4" />
      <p className="text-slate-400">{error}</p>
      <button onClick={() => navigate('/')} className="mt-4 text-blue-500">홈으로 돌아가기</button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 text-slate-200">
      <button onClick={() => navigate(-1)} className="flex items-center text-slate-400 hover:text-white transition">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">{disclosures[0]?.corp_name}</h1>
        <p className="text-slate-500">Recent 5 Critical Filings</p>
      </div>

      <div className="space-y-4">
        {disclosures.map((item) => (
          <div key={item.id} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl hover:border-slate-700 transition">
            <div className="flex justify-between items-start mb-4">
              <span className={`text-[10px] font-bold px-2 py-1 rounded ${item.sentiment === 'POSITIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                {item.sentiment}
              </span>
              <div className="flex items-center text-slate-500 text-xs gap-1">
                <Clock size={12}/> {new Date(item.created_at).toLocaleString()}
              </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-3">{item.report_nm}</h3>
            <div className="bg-slate-800/50 p-4 rounded-xl border-l-4 border-blue-500">
              <div className="flex gap-2 text-blue-400 mb-2 font-bold text-xs uppercase tracking-wider">
                <MessageSquare size={14}/> AI Summary
              </div>
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">{item.ai_summary}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StockDetailPage;