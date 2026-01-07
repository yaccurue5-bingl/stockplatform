import os
import requests
from supabase import create_client, Client
from datetime import datetime

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def run():
    print("🏢 네이버 금융 시가총액 데이터 수집 시작...")
    
    # KOSPI 시가총액 상위 리스트 API
    # 9시~16시 사이에 매우 안정적으로 응답함
    api_url = "https://m.stock.naver.com/api/json/sise/mainListSiseStock.nhn?type=S&page=1"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
    }

    try:
        response = requests.get(api_url, headers=headers, timeout=10)
        data = response.json()
        
        # 데이터 경로가 다를 수 있으므로 안전하게 추출
        items = data.get('result', {}).get('itemList', [])
        
        all_companies = []
        for item in items[:100]:  # 상위 100개
            all_companies.append({
                "stock_code": item.get('cd'),
                "corp_name": item.get('nm'),
                "market_cap": int(item.get('mktp', 0)) * 100000000, # 억 단위를 원 단위로
                "updated_at": datetime.now().isoformat()
            })
            
        if all_companies:
            supabase.table("companies").upsert(all_companies, on_conflict="stock_code").execute()
            print(f"✅ {len(all_companies)}개 기업 정보 업데이트 성공")
        else:
            print("⚠️ 수집된 기업 데이터가 없습니다.")

    except Exception as e:
        print(f"🚨 기업 정보 수집 에러: {str(e)}")

if __name__ == "__main__":
    run()