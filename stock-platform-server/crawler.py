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

# 1. 통합 분석 및 상세 정보 추출을 위한 프롬프트
DISCLOSURE_PROMPT_TEMPLATE = """
# Role
You are a professional financial analyst. 

# Language
Respond ONLY in KOREAN. (절대로 한국어 외의 언어(러시아어 등)를 섞지 마세요.)

# Task
Analyze the following disclosures for the SAME company and create ONE integrated summary.
You must extract the 'Target Company' and 'Contract Amount' from the provided text.

# Input Data
Company: {corp_name}
Detailed Disclosure Text:
{disclosure_details}

# Constraints
1. **Headline**: Create one integrated English headline.
2. **Key Takeaways (KOREAN)**: 
   - 각 계약별로 구체적 정보 기술: "1. [상대방 이름]과 [금액] 규모 계약, [정정사유]"
   - 실제 회사 이름과 금액을 텍스트에서 찾아 명시하세요. (모호하게 'company'라 적지 마세요.)
3. **Sentiment**: Overall tone score from -1.0 to 1.0.
4. **JSON Format**: Output strictly in JSON.

# Output Format (JSON)
{{
  "headline": "Integrated Headline",
  "summary": ["1. [상대방] [금액] 상세 내용", "2. [상대방] [금액] 상세 내용", "종합 분석"],
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
                hist = json.loads(row.data[0].get('history', '[]')) if row.data else []
                clean_val = float(val.replace(',', ''))
                hist.append(clean_val)
                if len(hist) > 10: hist = hist[-10:]
                supabase.table("market_indices").upsert({
                    "name": name, 
                    "current_val": val, 
                    "history": json.dumps(hist)
                }, on_conflict="name").execute()
    except Exception as e:
        print(f"❌ Index Error: {e}")

def analyze_disclosure():
    print("=== K-Market Insight Data Pipeline Start ===")
    get_market_indices()
    if fg_index_calc:
        fg_index_calc.update_fear_greed_idx()
    
    today = datetime.datetime.now().strftime('%Y%m%d')
    try:
        df = dart.list(start=today, end=today)
    except Exception as e:
        print(f"❌ DART Error: {e}")
        return

    if df is None or df.empty: return

    # 2번 해결: 종목별 그룹화 (비츠로셀 3건 등을 하나로 묶음)
    grouped = {}
    for _, row in df.iterrows():
        code = row.get('stock_code')
        if not code: continue
        if code not in grouped: grouped[code] = []
        grouped[code].append(row)

    for code, rows in grouped.items():
        # 중요 키워드가 포함된 공시만 필터링
        targets = [r for r in rows if any(kw in r['report_nm'] for kw in IMPORTANT_KEYWORDS)]
        if not targets: continue

        corp_name = targets[0]['corp_name']
        rep_rcept_no = targets[0]['rcept_no']

        # 중복 체크 (대표 번호 기준)
        check = supabase.table("disclosure_insights").select("id").eq("rcept_no", rep_rcept_no).execute()
        if check.data: continue

        print(f"🎯 통합 분석 중: {corp_name} ({len(targets)}건)")
        
        # 2번 해결: 공시 원문 텍스트 추출 (금액, 상대방 정보 파악용)
        full_text_context = ""
        for t in targets:
            try:
                doc = dart.document(t['rcept_no'])
                # HTML 태그 제거 및 텍스트 정제 (앞부분 2500자)
                clean_text = re.sub('<[^<]+?>', '', doc)
                clean_text = re.sub(r'\s+', ' ', clean_text).strip()[:2500]
                full_text_context += f"\n[공시제목: {t['report_nm']}]\n{clean_text}\n"
            except:
                full_text_context += f"\n[공시제목: {t['report_nm']}] (본문 추출 실패)\n"

        try:
            # 3번 해결: 한국어 답변 강제 프롬프트 적용
            final_prompt = DISCLOSURE_PROMPT_TEMPLATE.format(
                corp_name=corp_name, 
                disclosure_details=full_text_context
            )
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "너는 한국 금융 전문가야. 반드시 한국어로만 답변하고, 계약 상대방과 금액을 정확히 기재해."},
                    {"role": "user", "content": final_prompt}
                ],
                response_format={"type": "json_object"}
            )
            ai_res = json.loads(response.choices[0].message.content)
            
            sentiment = "POSITIVE" if ai_res.get('sentiment_score', 0) > 0.1 else \
                        "NEGATIVE" if ai_res.get('sentiment_score', 0) < -0.1 else "NEUTRAL"

            # 2번 해결: 통합된 제목으로 저장
            combined_title = targets[0]['report_nm']
            if len(targets) > 1:
                combined_title += f" 외 {len(targets)-1}건"

            supabase.table("disclosure_insights").upsert({
                "corp_name": corp_name, 
                "stock_code": code,
                "report_nm": combined_title, 
                "ai_summary": "\n".join(ai_res.get('summary', [])),
                "sentiment": sentiment, 
                "rcept_no": rep_rcept_no,
                "created_at": datetime.datetime.now().isoformat()
            }).execute()
            
        except Exception as e:
            print(f"❌ AI Error for {corp_name}: {e}")

if __name__ == "__main__":
    analyze_disclosure()