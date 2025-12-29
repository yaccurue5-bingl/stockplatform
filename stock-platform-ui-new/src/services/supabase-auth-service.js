// src/services/supabase-auth-service.js
import { supabase } from '../supabaseClient';

export {supabase};
// 인증 상태 변화 감지 (onAuthChange 대체)
export function onAuthChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null);
  });
  return () => subscription.unsubscribe();
}

// GitHub 로그인 (팝업 방식)
export async function signInWithGitHub() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: 'https://k-marketinsight.com'
    }
  });
  if (error) alert("GitHub 로그인 오류: " + error.message);
  return data;
}

// 로그아웃
export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) console.error("로그아웃 오류:", error.message);
}