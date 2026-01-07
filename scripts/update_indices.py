import os
import requests
from supabase import create_client, Client
from datetime import datetime

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def get_market_indices():
    print("🚀 Naver Realtime API 지수 수집 시작...")
    
    # 더 안정적인 네이버 금융 지수 URL
    api_url = "https://polling.finance.naver.com/api/realtime/domestic/index/KOSPI,KOSDAQ"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
    }
    
    try:
        response = requests.get(api_url, headers=headers, timeout=10)
        data = response.json()
        
        # 'result' 키가 없을 경우를 대비한 안전한 접근
        items = data.get('result', {}).get('areas', [{}])[0].get('datas', [])
        
        indices_payload = []
        for item in items:
            name = item.get('nm')
            symbol = "KOSPI" if "코스피" in name else "KOSDAQ"
            # 네이버 지수는 100이 곱해진 정수로 올 때가 있어 보정 필요
            price_val = float(item.get('nv')) / 100
            change_rate = float(item.get('cr'))
            
            indices_payload.append({
                "symbol": symbol,
                "name": symbol,
                "price": f"{price_val:,.2f}",
                "change_rate": change_rate,
                "updated_at": datetime.now().isoformat()
            })
            print(f"📊 {symbol} 성공: {price_val}")

        if indices_payload:
            supabase.table("market_indices").upsert(indices_payload, on_conflict="symbol").execute()
            print("✅ 지수 업데이트 완료")
            
    except Exception as e:
        print(f"🚨 지수 수집 에러: {str(e)}")

if __name__ == "__main__":
    get_market_indices()