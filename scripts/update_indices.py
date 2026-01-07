import os
import requests
from supabase import create_client, Client
from datetime import datetime

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def get_market_indices():
    print("🚀 Daum 금융 API 지수 수집 시작...")
    
    # KOSPI, KOSDAQ 코드 정의
    targets = [
        {"code": "KOSPI", "symbol": "KOSPI"},
        {"code": "KOSDAQ", "symbol": "KOSDAQ"}
    ]
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://finance.daum.net/"
    }
    
    indices_payload = []

    for item in targets:
        try:
            api_url = f"https://finance.daum.net/api/indices/{item['code']}"
            response = requests.get(api_url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                price = data.get('tradePrice')
                # 다음 API는 변화율을 0.0123 형태로 주므로 100을 곱함
                change_rate = data.get('changeRate', 0) * 100
                
                indices_payload.append({
                    "symbol": item['symbol'],
                    "name": item['symbol'],
                    "price": f"{price:,.2f}",
                    "change_rate": round(float(change_rate), 2),
                    "updated_at": datetime.now().isoformat()
                })
                print(f"📊 {item['symbol']} 수집 성공: {price}")
            else:
                print(f"❌ {item['symbol']} 응답 에러: {response.status_code}")
        except Exception as e:
            print(f"🚨 {item['symbol']} 처리 오류: {e}")

    if indices_payload:
        supabase.table("market_indices").upsert(indices_payload, on_conflict="symbol").execute()
        print("✅ 지수 업데이트 완료")

if __name__ == "__main__":
    get_market_indices()