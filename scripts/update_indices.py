import pandas as pd
from pykrx import stock
from supabase import create_client, Client
from datetime import datetime

# Supabase 설정
url: str = "https://rxcwqsolfrjhomeusyza.supabase.co"
key: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4Y3dxc29sZnJqaG9tZXVzeXphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTkxNzMyMCwiZXhwIjoyMDgxNDkzMzIwfQ.q8qepH1kS6Smjjo8WyGVE7KM7ksKP6QGmU5_9mPv20o"
supabase: Client = create_client(url, key)

def get_market_indices():
    today = datetime.now().strftime("%Y%m%d")
    print(f"🚀 {today} Market Indices Sync Started...")

    indices_data = []

    try:
        # KOSPI (1028)
        df_kospi = stock.get_market_ohlcv_by_date(today, today, "1028")
        if not df_kospi.empty:
            indices_data.append({
                "symbol": "KOSPI",
                "name": "KOSPI",
                "price": f"{df_kospi['종가'].iloc[-1]:,.2f}",
                "change_rate": float(df_kospi['등락률'].iloc[-1]),
                "updated_at": datetime.now().isoformat()
            })

        # KOSDAQ (2031)
        df_kosdaq = stock.get_market_ohlcv_by_date(today, today, "2031")
        if not df_kosdaq.empty:
            indices_data.append({
                "symbol": "KOSDAQ",
                "name": "KOSDAQ",
                "price": f"{df_kosdaq['종가'].iloc[-1]:,.2f}",
                "change_rate": float(df_kosdaq['등락률'].iloc[-1]),
                "updated_at": datetime.now().isoformat()
            })
        
        if indices_data:
            supabase.table("market_indices").upsert(indices_data).execute()
            print("✅ Market Indices Update Complete!")

    except Exception as e:
        print(f"🚨 Error updating indices: {e}")

if __name__ == "__main__":
    get_market_indices()