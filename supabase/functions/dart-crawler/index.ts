import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const DART_API_KEY = Deno.env.get('DART_API_KEY')!;
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- 1. 네이버 지수 크롤링 및 DB 업데이트 로직 ---
async function updateMarketIndices() {
  const targets = [
    { name: 'KOSPI', url: 'https://finance.naver.com/sise/sise_index.naver?code=KOSPI' },
    { name: 'KOSDAQ', url: 'https://finance.naver.com/sise/sise_index.naver?code=KOSDAQ' },
    { name: 'NASDAQ', url: 'https://finance.naver.com/world/sise.naver?symbol=NAS@IXIC' }
  ];

  console.log("📊 지수 업데이트 프로세스 시작...");

  for (const target of targets) {
    try {
      const res = await fetch(target.url, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const html = await res.text();
      
      // 다양한 네이버 금융 페이지 구조에 대응하는 정규식
      const match = html.match(/now_value">([^<]+)</) || 
                    html.match(/last_value">([^<]+)</) ||
                    html.match(/id="now_value">([^<]+)</);
      
      if (match) {
        const currentVal = match[1].replace(/,/g, '');
        console.log(`✅ ${target.name}: ${currentVal}`);
        
        const { data: existing } = await supabase.from('market_indices').select('history').eq('name', target.name).single();
        let history = existing?.history ? (typeof existing.history === 'string' ? JSON.parse(existing.history) : existing.history) : [];
        
        history.push(parseFloat(currentVal));
        if (history.length > 20) history.shift();

        await supabase.from('market_indices').upsert({
          name: target.name,
          current_val: currentVal,
          history: JSON.stringify(history),
          updated_at: new Date().toISOString()
        });
      } else {
        console.warn(`⚠️ ${target.name} 값을 찾을 수 없습니다.`);
      }
    } catch (e: any) {
      console.error(`❌ ${target.name} 크롤링 실패:`, e.message);
    }
  }
}

// --- 2. 메인 실행 로직 ---
serve(async (req: Request) => {
  try {
    // [STEP A] 지수 업데이트 (DART 결과와 상관없이 무조건 실행)
    await updateMarketIndices();

    // [STEP B] DART 공시 분석 로직
    console.log("🔍 DART 공시 분석 시작...");
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const listUrl = `https://opendart.fss.or.kr/api/list.json?crtfc_key=${DART_API_KEY}&bgnde=${today}&endde=${today}&page_count=100`;
    
    const listRes = await fetch(listUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    const listData = await listRes.json();

    // 데이터가 없는 경우(013) 정상 종료 처리
    if (listData.status === '013') {
      console.log("ℹ️ 오늘은 공시 데이터가 없습니다. (주말 또는 휴일)");
      return new Response("Indices Updated, No Disclosures Today", { status: 200 });
    }

    if (listData.status !== '000') {
      console.error(`DART API 오류: ${listData.message}`);
      return new Response(`DART API Error: ${listData.message}`, { status: 200 }); // 지수는 업데이트했으므로 200 반환
    }

    // 공시 필터링 및 AI 분석 로직
    const IMPORTANT_KEYWORDS = ['공급계약', '유상증자', '무상증자', '실적발표', '단일판매', '인수', '합병'];
    const filteredList = listData.list.filter((item: any) => 
      IMPORTANT_KEYWORDS.some(kw => item.report_nm.includes(kw))
    );

    if (filteredList.length === 0) {
      console.log("ℹ️ 분석할 중요 공시가 없습니다.");
      return new Response("Indices Updated, No Important Disclosures", { status: 200 });
    }

    const grouped = filteredList.reduce((acc: any, cur: any) => {
      acc[cur.stock_code] = acc[cur.stock_code] || [];
      acc[cur.stock_code].push(cur);
      return acc;
    }, {});

    for (const stockCode in grouped) {
      const reports = grouped[stockCode];
      const corpName = reports[0].corp_name;
      const repRceptNo = reports[0].rcept_no;

      const { data: existing } = await supabase.from('disclosure_insights').select('id').eq('rcept_no', repRceptNo).single();
      if (existing) continue;

      let combinedText = "";
      for (const r of reports) {
        const docUrl = `http://opendart.fss.or.kr/api/document.xml?crtfc_key=${DART_API_KEY}&rcept_no=${r.rcept_no}`;
        const docRes = await fetch(docUrl);
        const docXml = await docRes.text();
        const cleanText = docXml.replace(/<[^>]*>?/gm, '').substring(0, 1500);
        combinedText += `\n[제목: ${r.report_nm}]\n${cleanText}\n`;
      }

      const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "너는 한국 주식 전문 분석가야. 제공된 공시를 분석해서 'summary' (문자열 배열)와 'sentiment_score' (-1~1)를 포함한 JSON으로 답변해." },
            { role: "user", content: `기업명: ${corpName}\n공시내용: ${combinedText}` }
          ],
          response_format: { type: "json_object" }
        })
      });

      const aiData = await aiResponse.json();
      const insight = JSON.parse(aiData.choices[0].message.content);

      await supabase.from('disclosure_insights').upsert({
        corp_name: corpName,
        stock_code: stockCode,
        report_nm: reports.length > 1 ? `${reports[0].report_nm} 외 ${reports.length-1}건` : reports[0].report_nm,
        ai_summary: insight.summary?.join('\n') || '',
        sentiment: insight.sentiment_score > 0.1 ? 'POSITIVE' : (insight.sentiment_score < -0.1 ? 'NEGATIVE' : 'NEUTRAL'),
        rcept_no: repRceptNo,
        created_at: new Date().toISOString()
      });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return new Response("Success: Indices and Disclosures Updated", { status: 200 });
  } catch (err: any) {
    console.error("Critical Error:", err.message);
    return new Response(err.message, { status: 500 });
  }
});