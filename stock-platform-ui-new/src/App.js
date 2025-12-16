import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import CommonLayout from './components/CommonLayout';
import Dashboard from './components/Dashboard';
import StockDetailPage from './components/StockDetailPage';

// Firebase 인증 서비스 임포트
import { 
  handleRedirectResult, 
  onAuthChange 
} from './services/firebase-auth-service';

// 인증 버튼 컴포넌트 임포트
import AuthButtons from './components/AuthButtons';

function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Firebase 리디렉션 결과 처리
    handleRedirectResult()
      .then(result => {
        if (result && result.user) {
          console.log("리디렉션 로그인 처리 완료:", result.user.uid);
          setUser(result.user);
        }
        setupAuthListener();
      })
      .catch(error => {
        console.error("리디렉션 처리 중 오류 발생:", error);
        setupAuthListener();
      });

    // 인증 상태 변화 감지
    const setupAuthListener = () => {
      const unsubscribe = onAuthChange((currentUser) => {
        setUser(currentUser);
        setLoading(false);
        
        if (currentUser) {
          console.log(`인증됨: ${currentUser.displayName || currentUser.email}`);
        } else {
          console.log("로그아웃 상태");
        }
      });

      return unsubscribe;
    };
    
    return setupAuthListener();
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