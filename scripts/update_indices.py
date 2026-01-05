import pandas as pd
from pykrx import stock
from supabase import create_client, Client
from datetime import datetime
import time

# 1. Supabase 설정
url: str = "https://rxcwqsolfrjhomeusyza.supabase.co"
key: str = "***REMOVED***"
supabase: Client = create_client(url, key)

def get_market_indices():
    today = datetime.now().strftime("%Y%m%d")
    print(f"🚀 {today} Market Indices Sync Started...")

    indices_data = []

    # 코스피(1028), 코스닥(2031) 지수 가져오기
    try:
        # KOSPI
        df_kospi = stock.get_market_ohlcv_by_date(today, today, "1028")
        if not df_kospi.empty:
            indices_data.append({
                "symbol": "KOSPI",
                "name": "KOSPI",
                "price": f"{df_kospi['종가'].iloc[-1]:,.2f}",
                "change_rate": float(df_kospi['등락률'].iloc[-1]),
                "updated_at": datetime.now().isoformat()
            })

        # KOSDAQ
        df_kosdaq = stock.get_market_ohlcv_by_date(today, today, "2031")
        if not df_kosdaq.empty:
            indices_data.append({
                "symbol": "KOSDAQ",
                "name": "KOSDAQ",
                "price": f"{df_kosdaq['종가'].iloc[-1]:,.2f}",
                "change_rate": float(df_kosdaq['등락률'].iloc[-1]),
                "updated_at": datetime.now().isoformat()
            })

        # USD/KRW (환율은 별도 API가 필요하나, 우선 구조 유지를 위해 고정치나 이전값 유지)
        # 환율 업데이트 로직을 추가하고 싶다면 yfinance 등을 추가 설치해야 합니다.
        
        if indices_data:
            print(f"📦 Updating {len(indices_data)} indices to Supabase...")
            supabase.table("market_indices").upsert(indices_data).execute()
            print("✅ Market Indices Update Complete!")
        else:
            print("⚠️ No data found for today yet. (Market might be closed)")

    except Exception as e:
        print(f"🚨 Error updating indices: {e}")

if __name__ == "__main__":
    get_market_indices()