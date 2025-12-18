import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CommonLayout from './components/CommonLayout';
import Dashboard from './components/Dashboard';
import StockDetailPage from './components/StockDetailPage';

// Supabase 서비스로 교체
import { onAuthChange } from './services/supabase-auth-service'; 

function App() {
  const [loading, setLoading] = useState(true);
  //const [user, setUser] = useState(null);

  useEffect(() => {
    // Supabase 인증 상태 감지 및 초기 세션 확인
    const unsubscribe = onAuthChange((currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      if (currentUser) {
        console.log(`인증됨: ${currentUser.email}`);
      } else {
        console.log("로그아웃 상태");
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">인증 상태 확인 중...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <CommonLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/stock/:ticker" element={<StockDetailPage />} />
        </Routes>
      </CommonLayout>
    </Router>
  );
}

export default App;