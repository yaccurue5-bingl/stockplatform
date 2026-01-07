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
    # 헤더를 더 구체적으로 설정하여 차단 방지
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        # sise 페이지가 아닌 메인 finance 페이지가 더 안정적일 수 있음
        res = requests.get("https://finance.naver.com/", headers=headers, timeout=10)
        soup = BeautifulSoup(res.text, 'html.parser')
        
        # 지수별 데이터 추출 (셀렉터 보강)
        targets = [
            {"name": "KOSPI", "selector": "div.heading_area > a.num_area > span.num"},
            {"name": "KOSDAQ", "selector": "#kakaoContent > div > div.section_quot > div.box_quot.quot_kosdaq > a.num_area > span.num"}
        ]
        
        # 만약 위 셀렉터로 안될 경우를 대비해 기존 market_data.py 방식도 백업으로 유지
        indices = {
            "KOSPI": soup.select_one("#KOSPI_now"),
            "KOSDAQ": soup.select_one("#KOSDAQ_now")
        }
        
        payload = []
        for symbol, element in indices.items():
            if element:
                price = element.text.replace(',', '')
                # 변화율 찾기
                rate_el = soup.select_one(f"#{symbol}_rate")
                rate = float(rate_el.text.strip().replace('%', '')) if rate_el else 0.0
                
                payload.append({
                    "symbol": symbol,
                    "name": symbol,
                    "price": price,
                    "change_rate": rate,
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
    # 헤더를 더 구체적으로 설정하여 차단 방지
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        # sise 페이지가 아닌 메인 finance 페이지가 더 안정적일 수 있음
        res = requests.get("https://finance.naver.com/", headers=headers, timeout=10)
        soup = BeautifulSoup(res.text, 'html.parser')
        
        # 지수별 데이터 추출 (셀렉터 보강)
        targets = [
            {"name": "KOSPI", "selector": "div.heading_area > a.num_area > span.num"},
            {"name": "KOSDAQ", "selector": "#kakaoContent > div > div.section_quot > div.box_quot.quot_kosdaq > a.num_area > span.num"}
        ]
        
        # 만약 위 셀렉터로 안될 경우를 대비해 기존 market_data.py 방식도 백업으로 유지
        indices = {
            "KOSPI": soup.select_one("#KOSPI_now"),
            "KOSDAQ": soup.select_one("#KOSDAQ_now")
        }
        
        payload = []
        for symbol, element in indices.items():
            if element:
                price = element.text.replace(',', '')
                # 변화율 찾기
                rate_el = soup.select_one(f"#{symbol}_rate")
                rate = float(rate_el.text.strip().replace('%', '')) if rate_el else 0.0
                
                payload.append({
                    "symbol": symbol,
                    "name": symbol,
                    "price": price,
                    "change_rate": rate,
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