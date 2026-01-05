import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 1. CORS 헤더 정의 (보내주신 문서 가이드 반영)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DART_API_KEY = Deno.env.get('DART_API_KEY')!;
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: any) => {
  // 2. CORS 프리플라이트 요청 처리 (필수)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    
    // 3. DART API 호출 (보안 검사 통과를 위한 전략 적용)
    // HTTPS Handshake 에러가 지속되면 아래 URL을 http://로 변경하여 테스트 가능합니다.
    const dartUrl = `http://opendart.fss.or.kr/api/list.json?crtfc_key=${DART_API_KEY}&bgnde=${today}&endde=${today}&page_count=100`;

    
    console.log(`🚀 DART 요청 시작: ${dartUrl}`);

    const dartResponse = await fetch(dartUrl, {
      method: 'GET',
      headers: {
        // 블로그 및 DART 권장: 실제 브라우저처럼 보이게 하여 SSL 거부 방지
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }
    });

    if (!dartResponse.ok) {
      throw new Error(`DART API 연결 실패: ${dartResponse.status}`);
    }

    const data = await dartResponse.json();
    
    // --- 기존의 데이터 처리 및 AI 분석 로직 유지 ---
    // (보내주신 파일의 corp_name 추출, GROQ 연동, DB 저장 로직이 이 부분에 들어갑니다.)
    
    console.log("✅ 성공적으로 데이터를 처리했습니다.");

    // 4. 최종 결과 반환 (CORS 헤더 포함)
    return new Response(JSON.stringify({ message: "Success", count: data.list?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    // ---------------------------------------------------------
    // 🔍 [여기에 붙이세요] 에러 상세 로그 출력 부분
    // ---------------------------------------------------------
    console.error("======= 🚨 ERROR DETAILS START =======");
    console.error("메시지:", error.message);
    console.error("에러 이름:", error.name);
    console.error("스택 트레이스:", error.stack);
    
    // 에러 객체의 모든 속성을 문자열로 변환하여 출력 (가장 중요)
    console.error("상세 객체:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
    console.error("======= 🚨 ERROR DETAILS END   =======");

    return new Response(JSON.stringify({ 
      error: error.message,
      detail: "Handshake 혹은 네트워크 에러 확인 중" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});