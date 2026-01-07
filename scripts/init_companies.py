import os
import requests
from supabase import create_client, Client
from datetime import datetime

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def run():
    print("🏢 Daum 금융 시가총액 데이터 수집 시작...")
    
    # 다음 금융 주식 리스트 API (KOSPI 상위 100개)
    api_url = "https://finance.daum.net/api/quotes/sectors?sectorCode=001&limit=100&sort=marketCap&order=desc"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Referer": "https://finance.daum.net/"
    }

    try:
        response = requests.get(api_url, headers=headers, timeout=10)
        data = response.json()
        
        items = data.get('data', [])
        all_companies = []
        
        for item in items:
            all_companies.append({
                "stock_code": item.get('symbolCode')[1:], # 'A005930' -> '005930'
                "corp_name": item.get('name'),
                "market_cap": int(item.get('marketCap', 0)),
                "updated_at": datetime.now().isoformat()
            })
            
        if all_companies:
            supabase.table("companies").upsert(all_companies, on_conflict="stock_code").execute()
            print(f"✅ {len(all_companies)}개 기업 정보 업데이트 성공")
        else:
            print("⚠️ 데이터가 비어 있습니다.")

    except Exception as e:
        print(f"🚨 기업 정보 수집 에러: {e}")

if __name__ == "__main__":
    run()