import os
import requests
from supabase import create_client, Client
from datetime import datetime

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def get_market_indices():
    print("🚀 Daum 금융 API 지수 수집 시작...")
    
    # 다음 금융 지수 API (KOSPI, KOSDAQ)
    indices_to_fetch = [
        {"code": "KOSPI", "symbol": "KOSPI"},
        {"code": "KOSDAQ", "symbol": "KOSDAQ"}
    ]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Referer": "https://finance.daum.net/"
    }
    
    indices_payload = []
    
    for item in indices_to_fetch:
        try:
            # 다음 금융 실시간 지수 상세 API
            api_url = f"https://finance.daum.net/api/indices/{item['code']}"
            response = requests.get(api_url, headers=headers, timeout=10)
            data = response.json()
            
            price = data.get('tradePrice')
            change_rate = data.get('changeRate') * 100 # 소수점을 퍼센트로 변환
            
            indices_payload.append({
                "symbol": item['symbol'],
                "name": item['symbol'],
                "price": f"{price:,.2f}",
                "change_rate": round(change_rate, 2),
                "updated_at": datetime.now().isoformat()
            })
            print(f"📊 {item['symbol']} 수집 성공: {price}")
        except Exception as e:
            print(f"🚨 {item['symbol']} 수집 실패: {e}")

    if indices_payload:
        supabase.table("market_indices").upsert(indices_payload, on_conflict="symbol").execute()
        print("✅ 지수 업데이트 완료")

if __name__ == "__main__":
    get_market_indices()