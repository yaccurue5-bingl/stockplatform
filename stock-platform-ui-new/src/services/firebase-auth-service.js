import { initializeApp } from 'firebase/app';
import { getAuth, GithubAuthProvider, signInWithPopup, getRedirectResult, onAuthStateChanged, signOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyCBZBEF0f1UH7Z5Pugh-07ZNh7QL-BLCYk",
  authDomain: "stockplatform-fe563.firebaseapp.com",
  projectId: "stockplatform-fe563",
  storageBucket: "stockplatform-fe563.appspot.com",
  messagingSenderId: "214435441234",
  appId: "1:214435441234:web:890b265ba78c45c71e4d8b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const githubProvider = new GithubAuthProvider();

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGitHubPopup() {
  try {
    return await signInWithPopup(auth, githubProvider);
  } catch (error) {
    alert("GitHub 로그인 오류: " + error.message);
  }
}

export async function handleRedirectResult() {
  try {
    return await getRedirectResult(auth);
  } catch (error) {
    console.error(error);
  }
}

export async function signOutUser() {
  await signOut(auth);
}