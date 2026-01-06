import os
import requests
import pandas as pd
from pykrx import stock
from supabase import create_client, Client
from datetime import datetime, timedelta

# Supabase 설정 (GitHub Secrets에서 환경 변수로 로드)
# GitHub Actions 설정(trigger.yml)에서 SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 넘겨줘야 합니다.
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("🚨 에러: SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경 변수가 설정되지 않았습니다.")
    exit(1)

supabase: Client = create_client(url, key)

def get_latest_trading_date():
    """가장 최근 영업일 구하기 (pykrx 데이터 보장용)"""
    for i in range(7):
        target_date = (datetime.now() - timedelta(days=i)).strftime("%Y%m%d")
        df = stock.get_market_ohlcv_by_date(target_date, target_date, "1028")
        if not df.empty:
            return target_date
    return datetime.now().strftime("%Y%m%d")

def get_market_indices():
    latest_date = get_latest_trading_date()
    print(f"🚀 Market Indices Sync Started... (기준 날짜: {latest_date})")

    indices_data = []

    try:
        # 1. KOSPI (1028)
        df_kospi = stock.get_market_ohlcv_by_date(latest_date, latest_date, "1028")
        if not df_kospi.empty:
            indices_data.append({
                "symbol": "KOSPI",
                "name": "KOSPI",
                "price": f"{df_kospi['종가'].iloc[-1]:,.2f}",
                "change_rate": float(df_kospi['등락률'].iloc[-1]),
                "updated_at": datetime.now().isoformat()
            })
            print(f"📊 KOSPI: {df_kospi['종가'].iloc[-1]} 수집 성공")

        # 2. KOSDAQ (2031)
        df_kosdaq = stock.get_market_ohlcv_by_date(latest_date, latest_date, "2031")
        if not df_kosdaq.empty:
            indices_data.append({
                "symbol": "KOSDAQ",
                "name": "KOSDAQ",
                "price": f"{df_kosdaq['종가'].iloc[-1]:,.2f}",
                "change_rate": float(df_kosdaq['등락률'].iloc[-1]),
                "updated_at": datetime.now().isoformat()
            })
            print(f"📊 KOSDAQ: {df_kosdaq['종가'].iloc[-1]} 수집 성공")

        # DB 업데이트
        if indices_data:
            supabase.table("market_indices").upsert(indices_data, on_conflict="symbol").execute()
            print("✅ Market Indices Update Complete!")
        else:
            print("⚠️ 수집된 데이터가 없습니다.")

    except Exception as e:
        print(f"🚨 Error updating indices: {e}")

if __name__ == "__main__":
    get_market_indices()