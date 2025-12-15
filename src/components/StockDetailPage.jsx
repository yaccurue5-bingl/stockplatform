import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar, CartesianGrid, Legend } from 'recharts';
import { Loader2, AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';

const API_BASE_URL = 'http://localhost:8000';

const StockDetailPage = () => {
  const navigate = useNavigate();
  const { ticker } = useParams();
  
  const [stockData, setStockData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // API 호출
  useEffect(() => {
    const fetchStockData = async () => {
      if (!ticker) return;
      
      setLoading(true);
      setError(null);
      
      try {
        console.log(`Fetching data for ticker: ${ticker}`);
        const response = await fetch(`${API_BASE_URL}/api/stock/details/${ticker}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to fetch stock data`);
        }
        
        const data = await response.json();
        console.log('Received data:', data);
        setStockData(data);
        
      } catch (err) {
        console.error('Error fetching stock data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStockData();
  }, [ticker]);

  // 로딩 상태
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading real-time data for {ticker}...</p>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-red-800 mb-2">Error Loading Data</h2>
          <p className="text-red-600">{error}</p>
          <button 
            onClick={() => navigate('/')} 
            className="mt-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!stockData) {
    return (
      <div className="p-8 text-center text-gray-500">
        No data available for {ticker}
      </div>
    );
  }

  const sentiment = stockData.aiInsight?.sentiment || 'neutral';
  const sentimentColors = {
    positive: 'text-green-600',
    negative: 'text-red-600',
    neutral: 'text-gray-600'
  };

  return (
    <div className="animate-fade-in">
      <button 
        onClick={() => navigate('/')} 
        className="text-sm text-gray-500 hover:text-black mb-4"
      >
        ← Back to Dashboard
      </button>
      
      {/* Header Info */}
      <div className="bg-white p-6 rounded-xl border shadow-sm mb-6">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {stockData.companyName}
              <span className="text-lg text-gray-400 font-normal ml-2">{ticker}</span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Last updated: {new Date(stockData.scraped_at).toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <div className={`text-2xl font-bold ${sentimentColors[sentiment]}`}>
              {sentiment === 'positive' && <TrendingUp className="inline w-6 h-6 mr-2" />}
              {sentiment === 'negative' && <TrendingDown className="inline w-6 h-6 mr-2" />}
              {sentiment.toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column: Chart & AI Insight */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Financial Chart */}
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="font-bold text-lg mb-4">Financial Health (Revenue & OP)</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stockData.financials}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="rev" fill="#cbd5e1" name="Revenue(T)" />
                  <Bar dataKey="op" fill="#3b82f6" name="Op. Profit(T)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Translated News */}
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="font-bold text-lg mb-4">🤖 AI-Translated Latest News</h3>
            
            {stockData.aiInsight?.title_en ? (
              <>
                <h4 className="text-xl font-semibold text-gray-800 mb-3">
                  {stockData.aiInsight.title_en}
                </h4>
                <p className="text-gray-700 mb-4 leading-relaxed">
                  {stockData.aiInsight.summary_en}
                </p>
                
                {stockData.aiInsight.key_points && stockData.aiInsight.key_points.length > 0 && (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h5 className="font-semibold text-blue-900 mb-2">Key Points:</h5>
                    <ul className="list-disc pl-5 space-y-1 text-blue-800">
                      {stockData.aiInsight.key_points.map((point, idx) => (
                        <li key={idx}>{point}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-500 italic">No AI analysis available</p>
            )}
          </div>
        </div>

        {/* Right Column: Original News */}
        <div className="space-y-6">
          
          {/* Original Korean News */}
          <div className="bg-white p-6 rounded-xl border shadow-sm">
            <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">
              Original News (Korean)
            </h3>
            
            {stockData.scrapedNews?.title_kr ? (
              <>
                <h4 className="font-bold text-lg mb-2 text-gray-900">
                  {stockData.scrapedNews.title_kr}
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  {stockData.scrapedNews.content_kr}...
                </p>
                <a 
                  href={stockData.scrapedNews.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 text-sm hover:underline"
                >
                  Read full article →
                </a>
              </>
            ) : (
              <p className="text-gray-500 italic">No news available</p>
            )}
          </div>

          {/* Analyst View */}
          {stockData.aiInsight?.analyst_view && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
              <h3 className="text-sm font-bold text-blue-900 uppercase mb-3">
                💡 AI Analyst View
              </h3>
              <p className="text-blue-800 text-sm leading-relaxed">
                {stockData.aiInsight.analyst_view}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockDetailPage;