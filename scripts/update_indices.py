import os
import requests
import json
from supabase import create_client, Client
from datetime import datetime

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def get_live_indices():
    print("🚀 실시간 지수 데이터 수집 시작 (Naver API)")
    
    # 네이버 금융 실시간 지수 API (KOSPI: KOSPI, KOSDAQ: KOSDAQ)
    api_url = "https://polling.finance.naver.com/api/realtime/domestic/index/KOSPI,KOSDAQ"
    
    try:
        response = requests.get(api_url)
        data = response.json()
        
        indices_payload = []
        for item in data['result']['areas'][0]['datas']:
            name = item['nm'] # KOSPI, KOSDAQ
            price = item['nv'] / 100 # 현재가
            change_rate = item['cr'] # 등락률
            
            indices_payload.append({
                "symbol": name,
                "name": name,
                "price": f"{price:,.2f}",
                "change_rate": float(change_rate),
                "updated_at": datetime.now().isoformat()
            })
            print(f"📊 {name}: {price} ({change_rate}%)")

        if indices_payload:
            supabase.table("market_indices").upsert(indices_payload, on_conflict="symbol").execute()
            print("✅ 실시간 지수 업데이트 완료")
            
    except Exception as e:
        print(f"🚨 실시간 지수 수집 에러: {e}")

if __name__ == "__main__":
    get_live_indices()