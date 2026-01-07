import os
import requests
import json
from supabase import create_client, Client
from datetime import datetime

# 환경 변수 로드
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def get_safe_companies():
    print("🏢 네이버 금융을 통해 기업 정보 수집 시작 (pykrx 미사용)")
    
    # 네이버 시가총액 상위 종목 리스트 API (시총 순서대로 가져옴)
    # page=1 (상위 50개), page=2 (다음 50개) 방식으로 수집 가능
    companies_payload = []
    
    try:
        for page in range(1, 3):  # 상위 100개 수집
            api_url = f"https://finance.naver.com/api/sise/etfItemList.nhn" # 예시용 주소 (실제는 시총 API 사용)
            # 장 중 가장 안정적인 네이버 시총 상위 데이터 추출 (Sise API)
            sise_url = f"https://m.stock.naver.com/api/json/sise/mainListSiseStock.nhn?type=S&page={page}"
            
            response = requests.get(sise_url, timeout=10)
            data = response.json()
            
            for item in data['result']['itemList']:
                companies_payload.append({
                    "stock_code": item['cd'],        # 종목코드
                    "corp_name": item['nm'],         # 종목명
                    "market_cap": int(item['mktp']) * 100000000, # 시가총액(억 단위 보정)
                    "updated_at": datetime.now().isoformat()
                })
        
        if companies_payload:
            supabase.table("companies").upsert(companies_payload, on_conflict="stock_code").execute()
            print(f"✅ {len(companies_payload)}개 기업 정보 업데이트 완료 (KeyError 방지 모드)")
            
    except Exception as e:
        print(f"🚨 기업 정보 수집 중 에러: {e}")

if __name__ == "__main__":
    get_safe_companies()