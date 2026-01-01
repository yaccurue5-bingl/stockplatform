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

# 통합 분석 및 상세 추출 프롬프트
DISCLOSURE_PROMPT_TEMPLATE = """
# Role: Professional Financial Analyst
# Language: Respond ONLY in KOREAN. (중요: 답변에 외국어를 절대 섞지 마세요.)

# Task
제공된 공시 원문을 분석하여 통합 보고서를 작성하세요.
특히 '계약 상대방'과 '계약 금액'을 텍스트에서 정확히 찾아 리스트업하세요.

# Input Data
Company: {corp_name}
Disclosure Details:
{disclosure_details}

# Constraints
1. **Headline**: 영어로 된 통합 헤드라인 작성.
2. **Key Takeaways (KOREAN)**: 
   - 각 계약별 상세 리스트: "1. [상대방] [금액] 계약, [정정/핵심 내용]"
   - 실제 회사명과 금액을 명시하세요.
3. **Sentiment**: -1.0 ~ 1.0 점수.
4. **JSON Format**: Output strictly in JSON.
"""

IMPORTANT_KEYWORDS = ['공급계약', '유상증자', '무상증자', '실적발표', '단일판매', '인수', '합병', 'M&A', '최대주주변경']

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
                
                # [수정] NoneType 및 JSON 파싱 에러 방어 로직
                raw_history = []
                if row.data and row.data[0].get('history') is not None:
                    raw_history = row.data[0]['history']
                
                if isinstance(raw_history, str):
                    hist = json.loads(raw_history)
                else:
                    hist = raw_history
                
                clean_val = float(val.replace(',', ''))
                hist.append(clean_val)
                if len(hist) > 10: hist = hist[-10:]
                
                supabase.table("market_indices").upsert({
                    "name": name, "current_val": val, "history": hist
                }, on_conflict="name").execute()
    except Exception as e:
        print(f"❌ Index Error: {e}")

def analyze_disclosure():
    print("=== K-Market Insight Data Pipeline Start ===")
    get_market_indices()
    if fg_index_calc: fg_index_calc.update_fear_greed_idx()
    
    today = datetime.datetime.now().strftime('%Y%m%d')
    try:
        df = dart.list(start=today, end=today)
    except Exception as e:
        print(f"❌ DART Error: {e}"); return

    if df is None or df.empty: return

    grouped = {}
    for _, row in df.iterrows():
        code = row.get('stock_code')
        if not code: continue
        if code not in grouped: grouped[code] = []
        grouped[code].append(row)

    for code, rows in grouped.items():
        targets = [r for r in rows if any(kw in r['report_nm'] for kw in IMPORTANT_KEYWORDS)]
        if not targets: continue

        corp_name = targets[0]['corp_name']
        rep_rcept_no = targets[0]['rcept_no']

        check = supabase.table("disclosure_insights").select("id").eq("rcept_no", rep_rcept_no).execute()
        if check.data: continue

        print(f"🎯 통합 분석: {corp_name} ({len(targets)}건)")
        
        full_text = ""
        for t in targets:
            try:
                doc = dart.document(t['rcept_no'])
                clean = re.sub('<[^<]+?>', '', doc)
                full_text += f"\n[제목: {t['report_nm']}]\n{clean[:2000]}\n"
            except:
                full_text += f"\n[제목: {t['report_nm']}] 원문 추출 실패\n"

        try:
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "너는 한국 금융 전문가야. 한국어로만 답변해."},
                    {"role": "user", "content": DISCLOSURE_PROMPT_TEMPLATE.format(corp_name=corp_name, disclosure_details=full_text)}
                ],
                response_format={"type": "json_object"}
            )
            ai_res = json.loads(response.choices[0].message.content)
            
            report_title = targets[0]['report_nm'] + (f" 외 {len(targets)-1}건" if len(targets) > 1 else "")
            
            supabase.table("disclosure_insights").upsert({
                "corp_name": corp_name, "stock_code": code,
                "report_nm": report_title, "ai_summary": "\n".join(ai_res.get('summary', [])),
                "sentiment": "POSITIVE" if ai_res.get('sentiment_score', 0) > 0.1 else "NEUTRAL",
                "rcept_no": rep_rcept_no, "created_at": datetime.datetime.now().isoformat()
            }).execute()
        except Exception as e:
            print(f"❌ AI Error: {e}")

if __name__ == "__main__":
    analyze_disclosure()