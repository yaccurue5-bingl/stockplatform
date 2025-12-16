// stock-platform-ui-new/src/services/firebase-auth-service.js

// 1. Firebase SDK 필수 모듈 임포트
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GithubAuthProvider, 
  signInWithPopup, 
  signInWithRedirect, 
  getRedirectResult, 
  onAuthStateChanged, // 사용자 상태 변화 감지 모듈
  signOut 
} from 'firebase/auth';
import { getAnalytics } from "firebase/analytics";

// 2. Firebase 프로젝트 설정 (유효한 키로 교체 완료)
const firebaseConfig = {
  apiKey: "AIzaSyCBZBEF0f1UH7Z5Pugh-O7ZNh7QL-BLCYk",
  authDomain: "stockplatform-fe563.firebaseapp.com",
  projectId: "stockplatform-fe563",
  storageBucket: "stockplatform-fe563.appspot.com",
  messagingSenderId: "214435441234",
  appId: "1:214435441234:web:890b265ba78c45c71e4d8b",
  measurementId: "G-7Q2EXW4X3Q"
};

// 3. Firebase 앱 및 인증 인스턴스 초기화 (앱 시작 시 한 번만 수행)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const analytics = getAnalytics(app);

// 4. GitHub 인증 프로바이더 생성
const githubProvider = new GithubAuthProvider();

// 에러 핸들링 함수 (이전 코드에 있던 내용)
function handleAuthError(error) {
  // 인증 실패 시 오류 처리 로직
  console.error("인증 처리 중 오류 발생:", error.code, error.message);
  // 필요하다면 추가적인 사용자 피드백 로직 구현
  return null;
}

/**
 * 사용자 상태 변화 감지 리스너 설정 (App.js에서 사용)
 * @param {function} callback - 사용자 상태가 변경될 때 실행될 콜백 함수
 * @returns {function} 리스너 해제 함수 (unsubscribe)
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * GitHub 팝업을 통한 로그인
 */
export async function signInWithGitHubPopup() {
  try {
    const result = await signInWithPopup(auth, githubProvider);
    // 로그인 성공
    const credential = GithubAuthProvider.credentialFromResult(result);
    const token = credential.accessToken;
    const user = result.user;

    console.log("GitHub 팝업 로그인 성공!", user.uid);
    return { user, token };

  } catch (error) {
    return handleAuthError(error);
  }
}

/**
 * 리디렉션 로그인 결과 처리 (App.js에서 사용)
 * @returns {Promise<object|null>} 사용자 객체 및 토큰 정보, 또는 null
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
    // 리디렉션 결과가 없는 경우
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