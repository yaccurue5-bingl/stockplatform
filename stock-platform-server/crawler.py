import os
import requests
from bs4 import BeautifulSoup
from supabase import create_client
from dotenv import load_dotenv
from datetime import datetime

# .env 로드 (로컬 테스트용)
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

def get_stock_info(ticker, name):
    url = f"https://finance.naver.com/item/main.naver?code={ticker}"
    res = requests.get(url)
    soup = BeautifulSoup(res.text, 'html.parser')
    
    try:
        price = soup.select_one(".no_today .blind").text.replace(",", "")
        change_text = soup.select_one(".no_exday .blind").text.strip()
        direction = soup.select_one(".no_exday .ico")
        is_up = "상승" in direction.text if direction else True
        
        return {
            "ticker": ticker,
            "name": name,
            "current_price": int(price),
            "change_amount": int(change_text.replace(",", "")),
            "change_rate": ("+" if is_up else "-") + "1.5%", # 필요시 계산식 추가
            "chart_data": [
                {"time": "현재", "price": int(price)}
            ]
        }
    except Exception as e:
        print(f"{name} 크롤링 실패: {e}")
        return None

def run_update():
    if not SUPABASE_KEY:
        print("에러: API Key가 없습니다.")
        return

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    
    # 업데이트할 종목들
    TICKERS = {"005930": "삼성전자", "086520": "에코프로"}
    
    print(f"[{datetime.now()}] 업데이트 시작...")
    for ticker, name in TICKERS.items():
        data = get_stock_info(ticker, name)
        if data:
            supabase.table("stock_details").upsert(data, on_conflict="ticker").execute()
            print(f"{name} 완료")

if __name__ == "__main__":
    run_update() # 한 번만 실행하고 종료