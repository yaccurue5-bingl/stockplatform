import React, { useState, useEffect } from 'react'; // 1. useEffect, useState 임포트 추가
import { Menu, User, LogOut, globe } from 'lucide-react';
import { supabase } from '../supabaseClient'; // 2. supabase 객체 임포트 추가
import AuthButtons from './AuthButtons';

// MarketTicker 컴포넌트
const MarketTicker = () => {
  const [marketData, setMarketData] = useState(null); // 3. useState 정의 확인
  const [loading, setLoading] = useState(true); // 4. setLoading 정의 확인

  useEffect(() => {
    // 초기 데이터 로드 함수
    const fetchMarketData = async () => {
      try {
        const { data, error } = await supabase
          .from('market_live')
          .select('data') // data 컬럼의 JSON을 가져옴
          .single();
        
        if (data && !error) {
          setMarketData(data.data); // data.data로 접근
        }
      } catch (error) {
        console.error('Supabase 데이터 로드 실패:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMarketData();
    
    // 실시간 구독 설정
    const channel = supabase
      .channel('market-updates')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'market_live' }, 
        (payload) => {
          // 실시간 업데이트 시에도 data 컬럼 참조
          if (payload.new && payload.new.data) {
            setMarketData(payload.new.data);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // 의존성 배열 확인

  if (loading || !marketData) return <div className="bg-slate-800 h-10 animate-pulse" />;

  const getColorClass = (status) => status === 'up' ? 'text-green-500' : 'text-red-500';
  const getChangeSymbol = (status) => status === 'up' ? '▲' : '▼';

  return (
    <div className="bg-slate-800 text-white py-2 overflow-hidden border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-8 text-xs font-medium whitespace-nowrap overflow-x-auto no-scrollbar">
        <span className="flex items-center gap-1">
          KOSPI <span className={getColorClass(marketData.indices.kospi.status)}>
            {marketData.indices.kospi.value} {getChangeSymbol(marketData.indices.kospi.status)} {marketData.indices.kospi.rate}
          </span>
        </span>
        <span className="flex items-center gap-1">
          KOSDAQ <span className={getColorClass(marketData.indices.kosdaq.status)}>
            {marketData.indices.kosdaq.value} {getChangeSymbol(marketData.indices.kosdaq.status)} {marketData.indices.kosdaq.rate}
          </span>
        </span>
        <span className="flex items-center gap-1">
          USD/KRW <span className={getColorClass(marketData.exchange.usd_krw.status)}>
            {marketData.exchange.usd_krw.value}
          </span>
        </span>
      </div>
    </div>
  );
};

// Header 컴포넌트
const Header = () => (
  <header className="bg-slate-900 text-white sticky top-0 z-50 shadow-md">
    <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
      <div className="flex items-center gap-2 font-bold text-xl text-blue-400">
        <Globe className="w-6 h-6" />
        <span>K-Market Insight</span>
      </div>
      <div className="flex items-center gap-4">
        <AuthButtons />
      </div>
    </div>
  </header>
);

// Footer 컴포넌트
const Footer = () => (
  <footer className="bg-white border-t border-gray-200 py-8 mt-auto">
    <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">
      <p>© 2025 K-Market Insight. All rights reserved.</p>
    </div>
  </footer>
);

// 메인 레이아웃 컴포넌트
const CommonLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <MarketTicker />
      <Header />
      <main className="flex-1 max-w-7xl mx-auto px-4 py-8 w-full">
        {children}
      </main>
      <Footer />
    </div>
  );
};

export default CommonLayout; // 5. default export 확인