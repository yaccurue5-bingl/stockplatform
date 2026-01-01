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

DISCLOSURE_PROMPT_TEMPLATE = """
# Task
Analyze the Korean Public Disclosures and create ONE integrated summary. 
Respond ONLY in KOREAN.

# Input Data
Company: {corp_name}
Disclosures:
{disclosure_details}

# Output Format (JSON)
{{
  "headline": "English Title",
  "summary": ["1. [상대방] [금액] 상세내용", "2. ...", "분석결과"],
  "sentiment_score": 0.0
}}
"""

IMPORTANT_KEYWORDS = ['공급계약', '유상증자', '무상증자', '실적발표', '단일판매', '인수', '합병', '최대주주변경']

DART_KEY = os.environ.get("DART_API_KEY")
GROQ_KEY = os.environ.get("GROQ_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

client = Groq(api_key=GROQ_KEY)
dart = OpenDartReader(DART_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_market_indices():
    print("--- Fetching Market Indices ---")
    try:
        urls = {
            "KOSPI": "https://finance.naver.com/sise/sise_index.naver?code=KOSPI",
            "KOSDAQ": "https://finance.naver.com/sise/sise_index.naver?code=KOSDAQ",
            "USD/KRW": "https://finance.naver.com/marketindex/"
        }
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
                raw_data = row.data[0].get('history', []) if row.data else []
                if raw_data is None: raw_data = []
                hist = json.loads(raw_data) if isinstance(raw_data, str) else raw_data
                
                clean_val = float(val.replace(',', ''))
                hist.append(clean_val)
                if len(hist) > 15: hist = hist[-15:] # 스파크라인을 위해 조금 더 길게 유지
                
                supabase.table("market_indices").upsert({
                    "name": name, "current_val": val, "history": hist
                }, on_conflict="name").execute()
    except Exception as e:
        print(f"❌ Index Error: {e}")

def analyze_disclosure():
    print("=== Pipeline Start ===")
    get_market_indices()
    if fg_index_calc: fg_index_calc.update_fear_greed_idx()
    
    today = datetime.datetime.now().strftime('%Y%m%d')
    try:
        df = dart.list(start=today, end=today)
    except: return

    if df is None or df.empty: return

    grouped = {}
    for _, row in df.iterrows():
        code = row.get('stock_code')
        if code:
            if code not in grouped: grouped[code] = []
            grouped[code].append(row)

    for code, rows in grouped.items():
        targets = [r for r in rows if any(kw in r['report_nm'] for kw in IMPORTANT_KEYWORDS)]
        if not targets: continue

        corp_name = targets[0]['corp_name']
        rep_rcept_no = targets[0]['rcept_no']

        check = supabase.table("disclosure_insights").select("id").eq("rcept_no", rep_rcept_no).execute()
        if check.data: continue

        full_text = ""
        for t in targets:
            try:
                doc = dart.document(t['rcept_no'])
                full_text += f"\n[{t['report_nm']}]\n{re.sub('<[^<]+?>', '', doc)[:2000]}\n"
            except: continue

        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": DISCLOSURE_PROMPT_TEMPLATE.format(corp_name=corp_name, disclosure_details=full_text)}],
                response_format={"type": "json_object"}
            )
            ai_res = json.loads(response.choices[0].message.content)
            title = targets[0]['report_nm'] + (f" 외 {len(targets)-1}건" if len(targets) > 1 else "")
            
            supabase.table("disclosure_insights").upsert({
                "corp_name": corp_name, "stock_code": code, "report_nm": title,
                "ai_summary": "\n".join(ai_res.get('summary', [])),
                "sentiment": "POSITIVE" if ai_res.get('sentiment_score', 0) > 0.1 else "NEUTRAL",
                "rcept_no": rep_rcept_no, "created_at": datetime.datetime.now().isoformat()
            }).execute()
        except Exception as e: print(f"❌ AI Error: {e}")

if __name__ == "__main__":
    analyze_disclosure()