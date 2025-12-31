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
# 공포 탐욕 지수 계산 파일 임포트
try:
    import fg_index_calc 
except ImportError:
    fg_index_calc = None

# 1. 뉴스 브리핑 프롬프트 템플릿
DISCLOSURE_PROMPT_TEMPLATE = """
# Role
You are a professional financial analyst for Global Investors.

# Task
Analyze the following Korean Public Disclosure and create a structured summary.
Extract facts and rewrite them clearly.

# Input Data
Disclosure Title: {disclosure_title}

# Constraints
1. **Headline**: Create a catchy English headline (under 10 words).
2. **Key Takeaways**: Summarize the 3 most important facts in KOREAN (Bullet points).
3. **Sentiment**: Analyze the tone. Score from -1.0 (Very Negative) to 1.0 (Very Positive).
4. **Impact**: Explain WHY this matters to an investor in 1 sentence (KOREAN).
5. **JSON Format**: Output strictly in JSON format.

# Output Format (JSON)
{{
  "headline": "English Headline Here",
  "summary": ["요약1", "요약2", "요약3"],
  "sentiment_score": 0.0,
  "impact_analysis": "투자자 영향 분석 내용",
  "keywords": ["키워드1", "키워드2"]
}}
"""

# 2. 중요 키워드 정의 (불성실공시 등 리스크 키워드 추가)
IMPORTANT_KEYWORDS = [
    '공급계약', '유상증자', '무상증자', '실적발표', '영업실적', '단일판매', 
    '인수', '합병', 'M&A', '특허', '신제품', '최대주주변경', '자기주식취득', '현금배당',
    '불성실공시', '관리종목', '상장폐지', '공시번복'
]

# 환경 변수 설정
DART_KEY = os.environ.get("DART_API_KEY")
GROQ_KEY = os.environ.get("GROQ_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# 클라이언트 초기화
client = Groq(api_key=GROQ_KEY)
dart = OpenDartReader(DART_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_market_indices():
    print("--- Fetching Market Indices with History ---")
    try:
        urls = {
            "KOSPI": "https://finance.naver.com/sise/sise_index.naver?code=KOSPI",
            "KOSDAQ": "https://finance.naver.com/sise/sise_index.naver?code=KOSDAQ",
            "USD/KRW": "https://finance.naver.com/marketindex/"
        }
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        
        results = {}
        for name, url in urls.items():
            res = requests.get(url, headers=headers)
            soup = BeautifulSoup(res.text, 'html.parser')
            node = soup.select_one("#now_value") if name in ["KOSPI", "KOSDAQ"] else soup.select_one(".value")
            if node:
                results[name] = node.get_text(strip=True)

        for name, val in results.items():
            if val and val != "---":
                # 히스토리 업데이트 로직
                row = supabase.table("market_indices").select("history").eq("name", name).execute()
                hist = json.loads(row.data[0].get('history', '[]')) if row.data else []
                
                clean_val = float(val.replace(',', ''))
                hist.append(clean_val)
                if len(hist) > 10: hist = hist[-10:] # 최근 10개 유지

                supabase.table("market_indices").upsert({
                    "name": name, 
                    "current_val": val, 
                    "history": json.dumps(hist)
                }, on_conflict="name").execute()
                print(f"✅ {name} updated with history")
    except Exception as e:
        print(f"❌ Index Fetch Error: {e}")

def analyze_disclosure():
    print("=== K-Market Insight Data Pipeline Start ===")
    get_market_indices()
    
    # 공포 탐욕 지수 계산 호출
    if fg_index_calc:
        fg_index_calc.update_fear_greed_idx()
    
    today = datetime.datetime.now().strftime('%Y%m%d')
    try:
        df = dart.list(start=today, end=today)
    except Exception as e:
        print(f"❌ DART Error: {e}"); return

    if df is None or df.empty:
        print("No disclosures today."); return

    for idx, row in df.head(20).iterrows():
        title, corp_name, rcept_no = row.get('report_nm', ''), row.get('corp_name', ''), row.get('rcept_no')
        if not row.get('stock_code'): continue

        check = supabase.table("disclosure_insights").select("id").eq("rcept_no", rcept_no).execute()
        if check.data: continue

        if any(kw in title for kw in IMPORTANT_KEYWORDS):
            print(f"🎯 Analyzing: {corp_name}")
            try:
                final_prompt = DISCLOSURE_PROMPT_TEMPLATE.format(disclosure_title=title)
                response = client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[
                        {"role": "system", "content": "Return strictly in JSON format."},
                        {"role": "user", "content": final_prompt} # prompt 오타 수정
                    ],
                    response_format={"type": "json_object"},
                    max_tokens=1024
                )
                ai_res = json.loads(response.choices[0].message.content) # completion 오타 수정
                
                sentiment = "POSITIVE" if ai_res.get('sentiment_score', 0) > 0.1 else \
                            "NEGATIVE" if ai_res.get('sentiment_score', 0) < -0.1 else "NEUTRAL"

                supabase.table("disclosure_insights").upsert({
                    "corp_name": corp_name, "stock_code": row.get('stock_code'),
                    "report_nm": title, "ai_summary": "\n".join(ai_res.get('summary', [])),
                    "sentiment": sentiment, "rcept_no": rcept_no,
                    "created_at": datetime.datetime.now().isoformat()
                }).execute()
            except Exception as e:
                print(f"❌ AI Error for {corp_name}: {e}")