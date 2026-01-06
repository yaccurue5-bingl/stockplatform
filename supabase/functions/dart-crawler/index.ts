import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // 1. SSL 핸드쉐이크 에러 방지를 위한 클라이언트 생성
  const httpClient = Deno.createHttpClient({
    allowHost: true,
  });

  try {
    const DART_API_KEY = Deno.env.get('DART_API_KEY');
    if (!DART_API_KEY) throw new Error("DART_API_KEY가 없습니다.");

    // 2. URL 객체를 사용하는 방식 (제공해주신 코드 스타일 반영)
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const apiUrl = new URL("https://opendart.fss.or.kr/api/list.json");
    apiUrl.searchParams.set("crtfc_key", DART_API_KEY);
    apiUrl.searchParams.set("bgnde", today);
    apiUrl.searchParams.set("endde", today);
    apiUrl.searchParams.set("page_count", "100");

    console.log(`호출 URL: ${apiUrl.toString()}`);

    // 3. fetch 실행 (as any를 사용하여 client 옵션의 빨간 줄 에러 방지)
    const response = await fetch(apiUrl.toString(), {
      method: 'GET',
      client: httpClient,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    } as any); 

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DART API 에러: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    httpClient.close(); // 사용 후 닫기

    return new Response(JSON.stringify({ status: "success", data: data.list }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    if (httpClient) try { httpClient.close(); } catch {}
    console.error("에러 발생:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
})