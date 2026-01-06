import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 1. SSL/TLS 호환성을 위한 클라이언트 생성 (핵심 수정 사항)
  // Deno의 기본 fetch 대신 보안 설정을 조절할 수 있는 클라이언트를 사용합니다.
  const httpClient = Deno.createHttpClient({
    allowHost: true, // 호스트 검증 완화
  });

  try {
    const DART_API_KEY = Deno.env.get('DART_API_KEY');
    
    if (!DART_API_KEY) {
      throw new Error("DART_API_KEY가 설정되지 않았습니다. 'supabase secrets set'을 확인하세요.");
    }

    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const url = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${DART_API_KEY}&bgnde=${today}&endde=${today}&page_count=100`;

    console.log(`DART API 호출 시작: ${url}`);

    // 2. fetch 호출 시 위에서 만든 httpClient 적용
    const response = await fetch(url, {
      method: 'GET',
      client: httpClient, // 이 부분이 HandshakeFailure 해결의 포인트입니다.
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      }, 
    }as any);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DART API 응답 에러: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // 사용 후 클라이언트 닫기
    httpClient.close();

    return new Response(JSON.stringify({ 
      status: "success", 
      count: data.list?.length || 0,
      data: data.list 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    // 에러 발생 시에도 클라이언트 닫기
    try { httpClient.close(); } catch {}
    
    console.error("에러 발생:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
})