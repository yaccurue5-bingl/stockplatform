import React, { useState, useEffect } from 'react';
import { Search, Globe } from 'lucide-react';
import { API_BASE_URL, API_ENDPOINTS, fetchAPI } from '../config/api';

const API_BASE_URL_DISPLAY = API_BASE_URL; // 디버깅용

const Header = () => (
  <header className="bg-slate-900 text-white sticky top-0 z-50 shadow-md">
    <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
      <div className="flex items-center gap-2 font-bold text-xl text-blue-400">
        <Globe className="w-6 h-6" />
        <span>K-Market Insight</span>
      </div>

      <div className="hidden md:flex flex-1 max-w-lg mx-8 relative">
        <input 
          type="text" 
          placeholder="Search Symbol (e.g., 005930, Samsung)" 
          className="w-full pl-10 pr-4 py-2 rounded-full bg-slate-800 border border-slate-700 focus:outline-none focus:border-blue-500 text-sm"
        />
        <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
      </div>

      <div className="flex items-center gap-6 text-sm font-medium">
        <span className="cursor-pointer hover:text-blue-400">Markets</span>
        <span className="cursor-pointer hover:text-blue-400">News</span>
        <span className="cursor-pointer hover:text-blue-400">Screener</span>
      </div>
    </div>
  </header>
);

const Footer = () => (
  <footer className="bg-slate-100 border-t mt-12 py-8 text-center text-gray-500 text-sm">
    <div className="max-w-7xl mx-auto px-4">
      <p>Data provided by KRX, Naver Finance, FnGuide. Processed by AI.</p>
      <p className="mt-2 text-xs">Disclaimer: This is AI-translated information. Not investment advice. Prices delayed by 15 mins.</p>
    </div>
  </footer>
);

const MarketTicker = () => {
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const result = await fetchAPI(API_ENDPOINTS.MARKET_LIVE);
        
        if (result.status === 'success') {
          setMarketData(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch market data:', error);
        console.log('API URL:', API_BASE_URL_DISPLAY);
      } finally {
        setLoading(false);
      }
    };

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !marketData) {
    return (
      <div className="bg-slate-800 text-white text-xs py-2 text-center">
        <span className="text-gray-400">Loading market data...</span>
      </div>
    );
  }

  const { indices, exchange, stocks } = marketData;
  
  const getChangeSymbol = (status) => {
    return status === 'up' ? '▲' : status === 'down' ? '▼' : '';
  };

  const getColorClass = (status) => {
    return status === 'up' ? 'text-green-400' : status === 'down' ? 'text-red-400' : 'text-gray-300';
  };

  return (
    <div className="bg-slate-800 text-white text-xs py-2 overflow-hidden whitespace-nowrap">
      <div className="inline-flex gap-8 animate-pulse">
        <span className="flex items-center gap-1">
          KOSPI{' '}
          <span className={getColorClass(indices.kospi.status)}>
            {indices.kospi.value} {getChangeSymbol(indices.kospi.status)} {indices.kospi.rate}
          </span>
        </span>

        <span className="flex items-center gap-1">
          KOSDAQ{' '}
          <span className={getColorClass(indices.kosdaq.status)}>
            {indices.kosdaq.value} {getChangeSymbol(indices.kosdaq.status)} {indices.kosdaq.rate}
          </span>
        </span>

        <span className="flex items-center gap-1">
          USD/KRW{' '}
          <span className={getColorClass(exchange.usd_krw.status)}>
            {exchange.usd_krw.value}
          </span>
        </span>

        {stocks && stocks.slice(0, 3).map((stock) => (
          <span key={stock.ticker} className="flex items-center gap-1">
            {stock.ticker}{' '}
            <span className={getColorClass(stock.status)}>
              {stock.price} {getChangeSymbol(stock.status)} {stock.rate}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
};

const CommonLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <MarketTicker />
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
      
      <Footer />
    </div>
  );
};

export default CommonLayout;