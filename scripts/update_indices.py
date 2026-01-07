import os
import requests
from bs4 import BeautifulSoup
from supabase import create_client, Client
from datetime import datetime

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def get_market_indices():
    print("🚀 네이버 금융 기반 지수 수집 시작...")
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
    
    try:
        res = requests.get("https://finance.naver.com/sise/", headers=headers, timeout=10)
        soup = BeautifulSoup(res.text, 'html.parser')
        
        # 네이버 금융 셀렉터 (사용자 파일 기반)
        indices_data = [
            {"id": "KOSPI", "now": "#KOSPI_now", "rate": "#KOSPI_rate"},
            {"id": "KOSDAQ", "now": "#KOSDAQ_now", "rate": "#KOSDAQ_rate"}
        ]
        
        payload = []
        for item in indices_data:
            val = soup.select_one(item["now"]).text.replace(',', '')
            rate_text = soup.select_one(item["rate"]).text.strip().replace('%', '')
            # 부호(+/-) 처리
            rate = float(rate_text)
            
            payload.append({
                "symbol": item["id"],
                "name": item["id"],
                "price": val,
                "change_rate": rate,
                "updated_at": datetime.now().isoformat()
            })
            print(f"✅ {item['id']} 수집: {val} ({rate}%)")

        if payload:
            supabase.table("market_indices").upsert(payload, on_conflict="symbol").execute()
            
    except Exception as e:
        print(f"🚨 지수 수집 중 에러 발생: {e}")

if __name__ == "__main__":
    get_market_indices()