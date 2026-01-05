import pandas as pd
from pykrx import stock
from supabase import create_client, Client
from datetime import datetime
import requests
import os

# 1. 설정 (Secrets 사용 권장하나 기존 구조 유지)
url: str = "https://rxcwqsolfrjhomeusyza.supabase.co"
key: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4Y3dxc29sZnJqaG9tZXVzeXphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTkxNzMyMCwiZXhwIjoyMDgxNDkzMzIwfQ.q8qepH1kS6Smjjo8WyGVE7KM7ksKP6QGmU5_9mPv20o"
supabase: Client = create_client(url, key)

DART_KEY = "ee85e03f1d3874bb3c1b41284d77cfbba123f34a"

def sync_market_data():
    today = datetime.now().strftime("%Y%m%d")
    print(f"🚀 {today} 데이터 동기화 시작 (Python)")

    # --- PART 1: 지수 업데이트 ---
    indices_data = []
    try:
        # KOSPI
        df_kospi = stock.get_market_ohlcv_by_date(today, today, "1028")
        if not df_kospi.empty:
            indices_data.append({
                "symbol": "KOSPI", "name": "KOSPI",
                "price": f"{df_kospi['종가'].iloc[-1]:,.2f}",
                "change_rate": float(df_kospi['등락률'].iloc[-1]),
                "updated_at": datetime.now().isoformat()
            })
        # KOSDAQ
        df_kosdaq = stock.get_market_ohlcv_by_date(today, today, "2031")
        if not df_kosdaq.empty:
            indices_data.append({
                "symbol": "KOSDAQ", "name": "KOSDAQ",
                "price": f"{df_kosdaq['종가'].iloc[-1]:,.2f}",
                "change_rate": float(df_kosdaq['등락률'].iloc[-1]),
                "updated_at": datetime.now().isoformat()
            })
        
        for data in indices_data:
            supabase.table("market_indices").upsert(data).execute()
        print("✅ 지수 업데이트 완료")
    except Exception as e:
        print(f"❌ 지수 에러: {e}")

    # --- PART 2: DART 공시 크롤링 (Python requests 활용) ---
    try:
        dart_url = f"https://opendart.fss.or.kr/api/list.json?crtfc_key={DART_KEY}&bgnde={today}&endde={today}&page_count=50"
        # Python requests는 Handshake 에러에 강하며 verify=False로 우회도 가능합니다.
        response = requests.get(dart_url, headers={'User-Agent': 'Mozilla/5.0'})
        dart_data = response.json()

        if dart_data.get('status') == '000':
            for item in dart_data.get('list', []):
                # DB 저장 (disclosure_insights 테이블 구조에 맞춤)
                insert_data = {
                    "corp_name": item['corp_name'],
                    "stock_code": item['stock_code'],
                    "report_nm": item['report_nm'],
                    "rcept_no": item['rcept_no'],
                    "created_at": datetime.now().isoformat()
                }
                supabase.table("disclosure_insights").upsert(insert_data).execute()
            print(f"✅ DART 공시 {len(dart_data['list'])}건 저장 완료")
        else:
            print(f"ℹ️ DART: 공시 없음 ({dart_data.get('message')})")
    except Exception as e:
        print(f"❌ DART 에러: {e}")

if __name__ == "__main__":
    sync_market_data()