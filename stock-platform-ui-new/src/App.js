import React, { useState, useEffect } from 'react';
//import './App.css'; // 기존 스타일 임포트
// 1. 새로 생성한 인증 서비스 모듈 임포트
import { 
  handleRedirectResult, 
  onAuthChange 
} from './services/firebase-auth-service';
// 2. AuthButtons 컴포넌트 임포트 (로그인/로그아웃 UI)
import AuthButtons from './components/AuthButtons'; 

function App() {
  // 인증 상태를 전역적으로 관리하고 싶다면 여기서 State를 사용합니다.
  // AuthButtons 컴포넌트 내에서도 상태를 관리하므로, 여기서는 옵션입니다.
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // ----------------------------------------------------
    // 1. 애플리케이션 시작 시: GitHub 리디렉션 결과 처리 (한 번만 실행)
    // ----------------------------------------------------
    handleRedirectResult()
      .then(result => {
        if (result && result.user) {
          console.log("리디렉션 로그인 처리 완료:", result.user.uid);
          // UI 업데이트를 위해 user state 설정
          setUser(result.user); 
        }
        // 리디렉션 처리 후, 상태 감지 리스너를 설정
        setupAuthListener();
      })
      .catch(error => {
        console.error("리디렉션 처리 중 오류 발생:", error);
        setupAuthListener(); // 오류 발생해도 리스너는 설정해야 함
      });

    // ----------------------------------------------------
    // 2. 인증 상태 변화 감지 리스너 설정
    // ----------------------------------------------------
    const setupAuthListener = () => {
      const unsubscribe = onAuthChange((currentUser) => {
        // Firebase Auth 상태(로그인/로그아웃/토큰 새로고침)가 바뀔 때마다 실행
        setUser(currentUser);
        setLoading(false); // 로딩 상태 해제
        
        if (currentUser) {
          console.log(`전역 인증 상태 감지: ${currentUser.displayName || currentUser.email} 로그인됨`);
        } else {
          console.log("전역 인증 상태 감지: 로그아웃됨");
        }
      });

      // 컴포넌트 언마운트 시 리스너 해제 함수 반환
      return unsubscribe;
    };
    
    // cleanup 함수: effect가 다시 실행되거나 컴포넌트가 사라질 때 리스너를 정리
    return setupAuthListener(); 
    
  }, []); // 빈 배열: 컴포넌트가 마운트될 때 한 번만 실행

  if (loading) {
    return (
      <div className="App">
        <h1>인증 상태 확인 중...</h1>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Stock Platform UI</h1>
        {/* 현재 로그인된 사용자 정보 표시 (디버깅용) */}
        {user ? (
          <p>현재 사용자: <strong>{user.displayName || user.email}</strong></p>
        ) : (
          <p>로그아웃 상태입니다.</p>
        )}
      </header>
      
      {/* 3. 로그인/로그아웃 버튼 UI 컴포넌트 렌더링 */}
      <main>
        <AuthButtons />
      </main>
    </div>
  );
}

export default App;