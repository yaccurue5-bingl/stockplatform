// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

// process.env를 사용하여 .env 파일의 값을 읽어옵니다.
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

// 변수가 정상적으로 로드되었는지 확인하는 디버깅 로그
console.log("주소 로드 확인:", supabaseUrl);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("환경 변수 로드 실패! .env 파일 위치를 프로젝트 폴더 안으로 옮겼는지 확인하세요.");
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);