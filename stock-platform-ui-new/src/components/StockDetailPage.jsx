import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '../supabaseClient';

const StockDetailPage = () => {
  const { ticker } = useParams();
  const navigate = useNavigate();
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDetailData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // .single() 대신 .maybeSingle()을 사용하면 데이터가 없을 때 에러 대신 null을 반환합니다.
        const { data, error: fetchError } = await supabase
          .from('stock_details')
          .select('*')
          .eq('ticker', ticker)
          .maybeSingle();

        if (fetchError) throw fetchError;
        
        if (!data) {
          setError(`티커 ${ticker}에 해당하는 상세 데이터가 데이터베이스에 없습니다. 크롤러를 통해 데이터를 먼저 넣어주세요.`);
          return;
        }
        
        setStockData(data);
      } catch (err) {
        console.error('Error fetching stock data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (ticker) fetchDetailData();
  }, [ticker]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-gray-500">주식 정보를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-red-700 mb-2">데이터 없음</h2>
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={() => navigate('/')} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition">홈으로 돌아가기</button>
      </div>
    );
  }

  if (!stockData) return null;

  const isUp = stockData.change_amount > 0;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 hover:text-gray-900 transition">
        <ArrowLeft className="w-4 h-4 mr-1" /> 뒤로가기
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{stockData.name}</h1>
            <p className="text-gray-500">{stockData.ticker}</p>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold ${isUp ? 'text-red-500' : 'text-blue-500'}`}>
              {Number(stockData.current_price).toLocaleString()}원
            </div>
            <div className={`flex items-center justify-end font-medium ${isUp ? 'text-red-500' : 'text-blue-500'}`}>
              {isUp ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
              {stockData.change_amount.toLocaleString()} ({stockData.change_rate})
            </div>
          </div>
        </div>

        {/* 중요: 부모 div에 확실한 높이(h-[400px])를 주어야 차트 에러가 나지 않습니다. */}
        <div className="h-[400px] w-full mt-8" style={{ minHeight: '400px' }}>
          <h3 className="text-lg font-semibold mb-4">주가 흐름</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stockData.chart_data || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="time" />
              <YAxis domain={['auto', 'auto']} />
              <Tooltip />
              <Legend />
              <Bar dataKey="price" fill={isUp ? "#ef4444" : "#3b82f6"} name="가격" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default StockDetailPage;