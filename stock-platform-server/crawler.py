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
        # 네이버 금융 메인 페이지 호출
        url = "https://finance.naver.com/"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36"
        }
        res = requests.get(url, headers=headers)
        res.raise_for_status()
        
        soup = BeautifulSoup(res.text, 'html.parser')

        # 1. KOSPI 수집
        kospi_node = soup.select_one("#KOSPI_now")
        kospi_val = kospi_node.text if kospi_node else "---"

        # 2. KOSDAQ 수집
        kosdaq_node = soup.select_one("#KOSDAQ_now")
        kosdaq_val = kosdaq_node.text if kosdaq_node else "---"

        # 3. USD/KRW (환율) 수집
        # 네이버 금융 메인 하단 혹은 시장지표 영역에서 환율 추출
        exchange_node = soup.select_one(".group_sub .on .num") # 네이버 금융 구조에 따라 변경될 수 있음
        if not exchange_node:
            # 환율 노드가 위와 다를 경우 대비 (다른 셀렉터 시도)
            exchange_node = soup.select_one("#exchangeList .value")
        
        usd_krw_val = exchange_node.text if exchange_node else "---"

        # 수집된 데이터를 리스트로 정리
        indices = [
            {"name": "KOSPI", "current_val": kospi_val},
            {"name": "KOSDAQ", "current_val": kosdaq_val},
            {"name": "USD/KRW", "current_val": usd_krw_val}
        ]

        print(f"Scraped Data: KOSPI({kospi_val}), KOSDAQ({kosdaq_val}), USD/KRW({usd_krw_val})")

        # Supabase 저장 (중복 시 업데이트)
        for data in indices:
            # on_conflict="name" 설정을 통해 이미 존재하는 지수 이름이면 값을 업데이트(Upsert)함
            supabase.table("market_indices").upsert(
                data, 
                on_conflict="name"
            ).execute()
            
        print("Market indices updated in Supabase successfully.")
        
    except Exception as e:
        print(f"Error in get_market_indices: {e}")

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
        list_data = dart.list(start=start_date, end=end_date, kind='A') 
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