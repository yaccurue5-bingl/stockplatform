nimport { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// 1. CORS 헤더 설정 (가이드 준수)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  // CORS 프리플라이트 요청 처리
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. 가이드 방식대로 환경변수에서 DART 키 호출
    const DART_API_KEY = Deno.env.get('DART_API_KEY');
    
    if (!DART_API_KEY) {
      throw new Error("DART_API_KEY가 설정되지 않았습니다. 'supabase secrets set'을 확인하세요.");
    }

    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const url = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${DART_API_KEY}&bgnde=${today}&endde=${today}&page_count=100`;

    console.log(`DART API 호출 시작: ${url}`);

    // 3. HandshakeFailure 방지를 위한 정밀한 Fetch 설정
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        // 브라우저처럼 보이게 하여 보안 거절 방지
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DART API 응답 에러: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify({ 
      status: "success", 
      count: data.list?.length || 0,
      data: data.list 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("에러 발생:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
})