import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 기본 클라이언트 (브라우저/서버 공용)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);