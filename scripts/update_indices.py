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
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        res = requests.get("https://finance.naver.com/", headers=headers, timeout=10)
        soup = BeautifulSoup(res.text, 'html.parser')
        
        targets = ["KOSPI", "KOSDAQ"]
        payload = []
        
        for symbol in targets:
            # 1. 변수 초기화 (에러 방지)
            price_el = None
            rate_el = None
            
            # 2. 여러 방식의 셀렉터 시도
            price_el = soup.select_one(f"#{symbol}_now")
            rate_el = soup.select_one(f"#{symbol}_rate")
            
            if not price_el: # ID로 못 찾을 경우 클래스로 재시도
                area = soup.find("a", {"onclick": lambda x: x and f"index{symbol.lower()}" in x})
                if area:
                    price_el = area.select_one(".num")
                    rate_el = area.select_one(".num_s2")

            # 3. 데이터 추출 및 저장
            if price_el and rate_el:
                price = price_el.text.replace(',', '').strip()
                # 등락률에서 %, 상승/하락 글자 등 제거
                rate_text = rate_el.text.strip().replace('%', '').replace('상승', '').replace('하락', '').strip()
                
                payload.append({
                    "symbol": symbol,
                    "name": symbol,
                    "price": price,
                    "change_rate": float(rate_text),
                    "updated_at": datetime.now().isoformat()
                })
                print(f"✅ {symbol} 성공: {price}")
            else:
                print(f"⚠️ {symbol} 요소를 찾지 못했습니다.")

        if payload:
            supabase.table("market_indices").upsert(payload, on_conflict="symbol").execute()
            
    except Exception as e:
        print(f"🚨 지수 수집 에러: {e}")

if __name__ == "__main__":
    get_market_indices()