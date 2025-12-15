import React, { useState, useEffect } from 'react';
import { 
  signInWithGitHubPopup, 
  signOutUser,
  onAuthChange // 인증 상태 리스너 import
} from '../services/firebase-auth-service'; // 경로 확인 필요

function AuthButtons() {
  // 1. 사용자 상태를 저장할 State 정의
  const [currentUser, setCurrentUser] = useState(null);

  // 2. 컴포넌트 마운트 시 인증 상태 변화를 감지하는 리스너 설정
  useEffect(() => {
    // onAuthChange는 인증 상태가 바뀔 때마다 실행되는 콜백 함수를 반환하며,
    // 리스너 해제 함수를 반환합니다.
    const unsubscribe = onAuthChange((user) => {
      setCurrentUser(user);
    });

    // 컴포넌트 언마운트 시 리스너 해제
    return () => unsubscribe(); 
  }, []);

  // 3. GitHub 팝업 로그인 핸들러
  const handleSignIn = () => {
    signInWithGitHubPopup();
  };

  // 4. 로그아웃 핸들러
  const handleSignOut = () => {
    signOutUser();
  };

  // 5. 렌더링
  if (currentUser) {
    // 로그인 상태: 사용자 이름과 로그아웃 버튼 표시
    return (
      <div style={{ padding: '10px', border: '1px solid #ccc' }}>
        <p>환영합니다, {currentUser.displayName || currentUser.email}님!</p>
        <button onClick={handleSignOut}>
          GitHub 로그아웃
        </button>
      </div>
    );
  } else {
    // 로그아웃 상태: 로그인 버튼 표시
    return (
      <div style={{ padding: '10px', border: '1px solid #ccc' }}>
        <p>서비스 이용을 위해 로그인해 주세요.</p>
        <button onClick={handleSignIn} style={{ marginRight: '10px' }}>
          GitHub로 로그인 (팝업)
        </button>
        {/* 리디렉션 방식이 필요하다면 여기에 추가: 
        <button onClick={signInWithGitHubRedirect}>GitHub로 로그인 (리디렉션)</button>
        */}
      </div>
    );
  }
}

export default AuthButtons;