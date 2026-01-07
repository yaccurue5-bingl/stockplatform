import os
import pandas as pd
from pykrx import stock
from supabase import create_client, Client
from datetime import datetime, timedelta

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def get_latest_valid_date():
    """데이터가 존재하는 최신 날짜 탐색 (최대 10일)"""
    for i in range(10):
        target_date = (datetime.now() - timedelta(days=i)).strftime("%Y%m%d")
        # 코스피 지수 존재 여부 확인
        df = stock.get_market_ohlcv_by_date(target_date, target_date, "KOSPI")
        if not df.empty:
            return target_date
    return None

def get_market_indices():
    target_date = get_latest_valid_date()
    if not target_date:
        print("🚨 최근 10일 내 유효한 시장 데이터를 찾을 수 없습니다.")
        return

    print(f"🚀 Market Indices Sync Started... (기준 날짜: {target_date})")
    indices_data = []

    # 지수 수집 대상 (종가 기준)
    targets = [("KOSPI", "KOSPI"), ("KOSDAQ", "KOSDAQ")]
    
    for symbol, name in targets:
        df = stock.get_market_ohlcv_by_date(target_date, target_date, symbol)
        if not df.empty:
            indices_data.append({
                "symbol": symbol,
                "name": name,
                "price": f"{df['종가'].iloc[-1]:,.2f}",
                "change_rate": float(df['등락률'].iloc[-1]),
                "updated_at": datetime.now().isoformat()
            })
            print(f"📊 {name} 수집 성공: {df['종가'].iloc[-1]}")

    if indices_data:
        supabase.table("market_indices").upsert(indices_data, on_conflict="symbol").execute()
        print("✅ 지수 업데이트 완료")

if __name__ == "__main__":
    get_market_indices()