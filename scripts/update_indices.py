import os
import yfinance as yf
from supabase import create_client, Client
from datetime import datetime

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def get_market_indices():
    print("🚀 지수 수집 시작 (Yahoo Finance)...")
    
    targets = [("^KS11", "KOSPI"), ("^KQ11", "KOSDAQ")]
    indices_payload = []

    for ticker_symbol, name in targets:
        try:
            ticker = yf.Ticker(ticker_symbol)
            hist = ticker.history(period="2d") # 어제와 오늘 데이터
            
            if len(hist) >= 2:
                current_price = hist['Close'].iloc[-1]
                prev_price = hist['Close'].iloc[-2]
                change_rate = ((current_price - prev_price) / prev_price) * 100
                
                indices_payload.append({
                    "symbol": name,
                    "name": name,
                    "price": f"{current_price:,.2f}",
                    "change_rate": round(float(change_rate), 2),
                    "updated_at": datetime.now().isoformat()
                })
                print(f"📊 {name}: {current_price:,.2f} ({change_rate:.2f}%)")
        except Exception as e:
            print(f"🚨 {name} 실패: {e}")

    if indices_payload:
        supabase.table("market_indices").upsert(indices_payload, on_conflict="symbol").execute()
        print("✅ 지수 업데이트 완료")

if __name__ == "__main__":
    get_market_indices()