// 1. Firebase SDK 필수 모듈 임포트
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GithubAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  onAuthStateChanged, // 사용자 상태 변화 감지 모듈 추가 (권장)
  signOut 
} from 'firebase/auth';

// 2. Firebase 프로젝트 설정 (실제 키로 대체해야 함)
const firebaseConfig = {
  apiKey: "AIzaSyCrM8YtHhwdkO0rVJP8LKZ_imurmCVietg",
  authDomain: "stockflatform.firebaseapp.com",
  projectId: "stockflatform",
  storageBucket: "stockflatform.firebasestorage.app",
  messagingSenderId: "532315273972",
  appId: "1:532315273972:web:0d1e4098e914b7f3077ca1",
  measurementId: "G-HEK4GXWV6W"
};

// 3. Firebase 앱 및 인증 인스턴스 초기화 (앱 시작 시 한 번만 수행)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// 4. GitHub 인증 프로바이더 생성 및 스코프 설정
const githubProvider = new GithubAuthProvider();

// 선택 사항: 특정 GitHub 권한(스코프) 요청
// githubProvider.addScope('repo'); // 예: 저장소 접근 권한 요청

/**
 * 에러 처리 헬퍼 함수
 * @param {Error} error - Firebase 인증 에러 객체
 */
const handleAuthError = (error) => {
  const errorCode = error.code;
  const errorMessage = error.message;
  
  console.error("GitHub 인증 실패:", errorCode, errorMessage);
  alert(`GitHub 로그인 오류: ${errorMessage}`);
  
  // 필요한 경우 추가적인 에러 정보 로깅
  const email = error.customData ? error.customData.email : null;
  const credential = GithubAuthProvider.credentialFromError(error);
  if (email) console.error("사용된 이메일:", email);
  if (credential) console.error("자격 증명:", credential);
  
  // 오류 객체를 반환하여 호출 측에서 추가 처리 가능
  return { errorCode, errorMessage };
};

// ----------------------------------------------------
// 5. 핵심 인증 기능 구현
// ----------------------------------------------------

/**
 * GitHub 팝업을 통한 로그인
 * @returns {Promise<object>} 사용자 객체 및 토큰 정보 또는 에러 정보
 */
export async function signInWithGitHubPopup() {
  try {
    const result = await signInWithPopup(auth, githubProvider);
    
    // 성공 시 정보 추출
    const credential = GithubAuthProvider.credentialFromResult(result);
    const token = credential.accessToken; // GitHub 액세스 토큰
    const user = result.user; // Firebase User 객체
    
    console.log("GitHub 로그인 성공!", user.uid);
    return { user, token };
    
  } catch (error) {
    return handleAuthError(error);
  }
}

/**
 * GitHub 리디렉션을 통한 로그인 시작
 */
export function signInWithGitHubRedirect() {
  signInWithRedirect(auth, githubProvider);
}

/**
 * 리디렉션 로그인 결과 처리 (앱 시작 시 한 번 호출)
 * @returns {Promise<object|null>} 사용자 객체 및 토큰 정보, 또는 null (리디렉션 결과가 없을 때)
 */
export async function handleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    
    if (result) {
      // 리디렉션 로그인 성공
      const credential = GithubAuthProvider.credentialFromResult(result);
      const token = credential.accessToken;
      const user = result.user;
      
      console.log("GitHub 리디렉션 로그인 성공!", user.uid);
      return { user, token };
    }
    // 리디렉션 결과가 없는 경우 (일반적인 페이지 로드)
    return null; 
    
  } catch (error) {
    return handleAuthError(error);
  }
}

/**
 * 로그아웃 함수
 */
export async function signOutUser() {
  try {
    await signOut(auth);
    console.log("로그아웃 성공");
  } catch (error) {
    console.error("로그아웃 실패:", error);
  }
}

/**
 * 사용자 인증 상태 변화를 실시간으로 관찰
 * @param {function(user: object|null)} callback - 사용자 객체가 변경될 때마다 호출되는 콜백 함수
 * @returns {function()} 리스너를 해제하는 함수
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

// ----------------------------------------------------
// 6. 앱에서 사용하기 위해 필요한 인스턴스 및 함수만 export
// ----------------------------------------------------
export { auth };