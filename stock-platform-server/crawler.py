import os
import re
import datetime
import time
import requests
import json
from bs4 import BeautifulSoup
from groq import Groq 
import OpenDartReader
from supabase import create_client

try:
    import fg_index_calc 
except ImportError:
    fg_index_calc = None

# 수정: 여러 공시를 통합 분석하기 위한 프롬프트 템플릿
DISCLOSURE_PROMPT_TEMPLATE = """
# Role
You are a professional financial analyst.

# Task
Analyze the following multiple disclosures for the SAME company and create ONE integrated summary.
You must distinguish each contract if there are multiple ones.

# Input Data
Company: {corp_name}
Disclosures:
{disclosure_details}

# Constraints
1. **Headline**: Create one integrated English headline (e.g., "Triple Supply Contracts Signed").
2. **Key Takeaways (KOREAN)**: 
   - 구체적 계약 정보: "1. [상대방] [금액] [정정사유 및 핵심항목]", "2. [상대방] [금액]..." 형태로 나열.
   - 전체적인 재무적 영향 및 투자자 유의사항 요약.
3. **Sentiment**: Overall tone score from -1.0 to 1.0.
4. **JSON Format**: Output strictly in JSON.

# Output Format (JSON)
{{
  "headline": "Integrated Headline",
  "summary": ["계약1: 상세 내용", "계약2: 상세 내용", "종합 분석"],
  "sentiment_score": 0.0,
  "impact_analysis": "투자자 영향 분석"
}}
"""

IMPORTANT_KEYWORDS = [
    '공급계약', '유상증자', '무상증자', '실적발표', '영업실적', '단일판매', 
    '인수', '합병', 'M&A', '특허', '신제품', '최대주주변경', '자기주식취득', '현금배당',
    '불성실공시', '관리종목', '상장폐지', '공시번복'
]

DART_KEY = os.environ.get("DART_API_KEY")
GROQ_KEY = os.environ.get("GROQ_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

client = Groq(api_key=GROQ_KEY)
dart = OpenDartReader(DART_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_market_indices():
    # ... (기존 지수 수집 로직과 동일)
    print("--- Fetching Market Indices ---")
    try:
        urls = {"KOSPI": "https://finance.naver.com/sise/sise_index.naver?code=KOSPI", "KOSDAQ": "https://finance.naver.com/sise/sise_index.naver?code=KOSDAQ", "USD/KRW": "https://finance.naver.com/marketindex/"}
        headers = {"User-Agent": "Mozilla/5.0"}
        results = {}
        for name, url in urls.items():
            res = requests.get(url, headers=headers)
            soup = BeautifulSoup(res.text, 'html.parser')
            node = soup.select_one("#now_value") if name in ["KOSPI", "KOSDAQ"] else soup.select_one(".value")
            if node: results[name] = node.get_text(strip=True)
        for name, val in results.items():
            if val and val != "---":
                row = supabase.table("market_indices").select("history").eq("name", name).execute()
                hist = json.loads(row.data[0].get('history', '[]')) if row.data else []
                clean_val = float(val.replace(',', ''))
                hist.append(clean_val)
                if len(hist) > 10: hist = hist[-10:]
                supabase.table("market_indices").upsert({"name": name, "current_val": val, "history": json.dumps(hist)}, on_conflict="name").execute()
    except Exception as e: print(f"❌ Index Error: {e}")

def analyze_disclosure():
    print("=== K-Market Insight Data Pipeline Start ===")
    get_market_indices()
    if fg_index_calc: fg_index_calc.update_fear_greed_idx()
    
    today = datetime.datetime.now().strftime('%Y%m%d')
    try:
        df = dart.list(start=today, end=today)
    except Exception as e: print(f"❌ DART Error: {e}"); return

    if df is None or df.empty: return

    # [수정] 동일 종목 공시 그룹화 로직
    grouped = {}
    for _, row in df.iterrows():
        code = row.get('stock_code')
        if not code: continue
        if code not in grouped: grouped[code] = []
        grouped[code].append(row)

    for code, rows in grouped.items():
        # 중요 키워드 포함 공시 필터링
        targets = [r for r in rows if any(kw in r['report_nm'] for kw in IMPORTANT_KEYWORDS)]
        if not targets: continue

        corp_name = targets[0]['corp_name']
        # 이미 처리된 공시인지 확인 (대표 rcept_no 기준)
        rep_rcept_no = targets[0]['rcept_no']
        check = supabase.table("disclosure_insights").select("id").eq("rcept_no", rep_rcept_no).execute()
        if check.data: continue

        print(f"🎯 Group Analyzing: {corp_name} ({len(targets)}건)")
        
        # [수정] 여러 공시의 제목들을 하나의 텍스트로 합쳐서 전달
        disc_details = ""
        for t in targets:
            disc_details += f"- {t['report_nm']} (공시번호: {t['rcept_no']})\n"

        try:
            final_prompt = DISCLOSURE_PROMPT_TEMPLATE.format(
                corp_name=corp_name, 
                disclosure_details=disc_details
            )
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "Return strictly in JSON. Be specific about contract partners and amounts."},
                    {"role": "user", "content": final_prompt}
                ],
                response_format={"type": "json_object"}
            )
            ai_res = json.loads(response.choices[0].message.content)
            
            sentiment = "POSITIVE" if ai_res.get('sentiment_score', 0) > 0.1 else \
                        "NEGATIVE" if ai_res.get('sentiment_score', 0) < -0.1 else "NEUTRAL"

            # DB 저장 (여러 건을 하나로 통합하여 저장)
            report_title = targets[0]['report_nm'] + (f" 외 {len(targets)-1}건" if len(targets) > 1 else "")
            
            supabase.table("disclosure_insights").upsert({
                "corp_name": corp_name, 
                "stock_code": code,
                "report_nm": report_title, 
                "ai_summary": "\n".join(ai_res.get('summary', [])),
                "sentiment": sentiment, 
                "rcept_no": rep_rcept_no,
                "created_at": datetime.datetime.now().isoformat()
            }).execute()
        except Exception as e:
            print(f"❌ AI Error for {corp_name}: {e}")

if __name__ == "__main__":
    analyze_disclosure()