import os
import requests
import time
from supabase import create_client, Client
from datetime import datetime

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def run():
    print("🏢 Daum 금융 기반 기업 정보 동기화 시작...")
    
    # 공시 데이터에서 종목 코드 추출
    res = supabase.table("disclosure_insights").select("stock_code").execute()
    stock_codes = list(set([item['stock_code'] for item in res.data if item.get('stock_code')]))
    
    if not stock_codes:
        print("⚠️ 업데이트할 종목 코드가 없습니다.")
        return

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://finance.daum.net/"
    }

    all_companies = []
    for code in stock_codes:
        try:
            # 다음 금융 API는 종목코드 앞에 A를 붙여야 함
            api_url = f"https://finance.daum.net/api/quotes/A{code}"
            response = requests.get(api_url, headers=headers, timeout=10)
            
            # 500 에러나 404 에러 시 해당 종목만 스킵
            if response.status_code != 200:
                print(f"⚠️ {code} 종목 건너뜀 (HTTP {response.status_code})")
                continue

            data = response.json()
            if data and 'name' in data:
                all_companies.append({
                    "stock_code": code,
                    "corp_name": data.get('name'),
                    "market_cap": int(data.get('marketCap', 0)),
                    "updated_at": datetime.now().isoformat()
                })
                print(f"✅ {data.get('name')}({code}) 수집 완료")
            
            # 500 에러 방지를 위해 요청 간 간격 조절
            time.sleep(1.0) 

        except Exception as e:
            print(f"🚨 {code} 수집 중 에러 발생: {e}")
            continue

    if all_companies:
        supabase.table("companies").upsert(all_companies, on_conflict="stock_code").execute()
        print(f"🎉 {len(all_companies)}개 기업 정보 동기화 완료")

if __name__ == "__main__":
    run()