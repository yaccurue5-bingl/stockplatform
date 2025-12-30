import os
import datetime
import time
import requests
from bs4 import BeautifulSoup
from google import genai
import OpenDartReader
from supabase import create_client

# 환경 변수 설정
DART_KEY = os.environ.get("DART_API_KEY")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

client = genai.Client(api_key=GEMINI_KEY)
dart = OpenDartReader(DART_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_market_indices():
    """네이버 금융에서 KOSPI, KOSDAQ, 환율 수집"""
    print("--- Fetching Market Indices from Naver ---")
    url = "https://finance.naver.com/sise/"
    res = requests.get(url)
    soup = BeautifulSoup(res.text, 'html.parser')

    indices = [
        {"id": "KOSPI", "selector": "#KOSPI_now"},
        {"id": "KOSDAQ", "selector": "#KOSDAQ_now"}
    ]
    
    for item in indices:
        val = soup.select_one(item["selector"]).text
        # 실제 운영 시 등락률도 파싱하여 저장 가능
        data = {
            "name": item["id"],
            "current_val": val,
            "updated_at": datetime.datetime.now().isoformat()
        }
        supabase.table("market_indices").upsert(data).execute()
    print("✅ Market Indices Updated")

def analyze_disclosure():
    print("=== K-Market Insight Data Pipeline Start ===")
    # 1. 지수 수집 (항상 실행)
    get_market_indices()
    
    # 2. 공시 수집 (정각, 15분, 30분, 45분 근처에서 실행되도록 범위 지정)
    current_minute = datetime.datetime.now().minute
    if any(abs(current_minute - target) <= 3 for target in [0, 15, 30, 45]):
        print("--- Fetching DART Disclosures ---")
    
    end_date = datetime.datetime.now().strftime('%Y%m%d')
    start_date = (datetime.datetime.now() - datetime.timedelta(days=7)).strftime('%Y%m%d')
    
    try:
        list_data = dart.list(start=start_date, end=end_date, pblntf_ty='A') 
    except Exception as e:
        print(f"❌ DART Error: {e}")
        return

    if list_data is None or list_data.empty: return

    for idx, row in list_data.iterrows():
        # 기존 로직 유지
        rcept_no = row.get('rcept_no', '')
        time.sleep(5) 
        
        try:
            content = dart.document(rcept_no)
            if not content: continue
            
            prompt_text = f"Analyze disclosure: {row.get('report_nm')}..." # 기존 프롬프트 생략
            response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt_text)
            
            if response and response.text:
                data = {
                    "corp_name": row.get('corp_name'),
                    "stock_code": row.get('stock_code'),
                    "report_nm": row.get('report_nm'),
                    "ai_summary": response.text,
                    "rcept_no": rcept_no,
                    "sentiment": "NEUTRAL", 
                    "created_at": datetime.datetime.now().isoformat()
                }
                supabase.table("disclosure_insights").upsert(data).execute()
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    analyze_disclosure()