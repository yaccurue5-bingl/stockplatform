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
    print("--- Fetching Market Indices from Naver Finance ---")
    try:
        url = "https://finance.naver.com/"
        headers = {"User-Agent": "Mozilla/5.0"}
        res = requests.get(url, headers=headers)
        res.raise_for_status()
        soup = BeautifulSoup(res.text, 'html.parser')

        kospi_val = soup.select_one("#KOSPI_now").text if soup.select_one("#KOSPI_now") else "---"
        kosdaq_val = soup.select_one("#KOSDAQ_now").text if soup.select_one("#KOSDAQ_now") else "---"
        exchange_node = soup.select_one(".group_sub .on .num") or soup.select_one("#exchangeList .value")
        usd_krw_val = exchange_node.text if exchange_node else "---"

        indices = [
            {"name": "KOSPI", "current_val": kospi_val},
            {"name": "KOSDAQ", "current_val": kosdaq_val},
            {"name": "USD/KRW", "current_val": usd_krw_val}
        ]

        for data in indices:
            # on_conflict="name"으로 중복 시 업데이트 수행
            supabase.table("market_indices").upsert(data, on_conflict="name").execute()
        print("✅ Market indices updated.")
    except Exception as e:
        print(f"❌ Index Error: {e}")

def analyze_disclosure():
    print("=== K-Market Insight Data Pipeline Start ===")
    
    # 1. 지수 수집 우선 실행 (공시 에러와 무관하게 작동하도록 상단 배치)
    get_market_indices()
    
    # 2. 공시 수집 (15분 주기 체크)
    curr_min = datetime.datetime.now().minute
    if not any(abs(curr_min - t) <= 3 for t in [0, 15, 30, 45]):
        print("Skipping DART - Not on 15min cycle.")
        return

    print("--- Fetching DART Disclosures ---")
    today = datetime.datetime.now().strftime('%Y%m%d')
    start_date = (datetime.datetime.now() - datetime.timedelta(days=2)).strftime('%Y%m%d')
    
    try:
        # pblntf_ty 대신 kind 사용으로 에러 방지
        list_data = dart.list(start=start_date, end=today, kind='A') 
    except Exception as e:
        print(f"❌ DART Fetch Error: {e}")
        return

    if list_data is None or list_data.empty:
        print("No new disclosures.")
        return

    # 최신 5개만 처리하여 API 할당량 보존
    for idx, row in list_data.head(5).iterrows():
        rcept_no = row.get('rcept_no')
        try:
            # 중복 체크: 이미 처리된 공시는 건너뜀
            check = supabase.table("disclosure_insights").select("id").eq("rcept_no", rcept_no).execute()
            if check.data: continue

            time.sleep(3) # DART 및 AI 요청 간격 조절
            
            # AI 분석 및 저장
            prompt = f"회사명: {row['corp_name']}, 공시제목: {row['report_nm']}. 이 내용을 투자자 관점에서 한글로 핵심 요약해줘."
            response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
            
            if response and response.text:
                data = {
                    "corp_name": row['corp_name'],
                    "stock_code": row['stock_code'],
                    "report_nm": row['report_nm'],
                    "ai_summary": response.text,
                    "rcept_no": rcept_no,
                    "sentiment": "NEUTRAL",
                    "created_at": datetime.datetime.now().isoformat()
                }
                supabase.table("disclosure_insights").upsert(data).execute()
                print(f"✅ Saved: {row['corp_name']}")
        except Exception as e:
            if "429" in str(e):
                print("⚠️ AI Quota exhausted. Stopping loop.")
                break
            print(f"❌ Error for {row['corp_name']}: {e}")

if __name__ == "__main__":
    analyze_disclosure()