import os
import requests
import pandas as pd
from pykrx import stock
from supabase import create_client, Client
from datetime import datetime, timedelta

# Supabase 설정
url: str = "https://rxcwqsolfrjhomeusyza.supabase.co"
# 보안을 위해 Key는 GitHub Secrets 사용을 권장하지만, 요청하신 파일 구조를 유지합니다.
key: str = "***REMOVED***"
supabase: Client = create_client(url, key)

def get_latest_trading_date():
    """가장 최근 영업일 구하기 (pykrx 데이터 보장용)"""
    # 오늘부터 역순으로 7일간 데이터를 확인하여 가장 최근 데이터가 있는 날짜 반환
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

        # 3. 환율 정보 (네이버 금융 크롤링 - pykrx에 없는 데이터 보충)
        try:
            exchange_url = "https://finance.naver.com/marketindex/exchangeDetail.naver?marketindexCd=FX_USDKRW"
            res = requests.get(exchange_url, timeout=10)
            # 환율 정보는 간단한 파싱으로 가져올 수 있으나, 
            # 여기서는 기존 구조 유지를 위해 symbol만 추가하거나 생략 가능합니다.
            # 필요시 'USD/KRW' 데이터를 추가하세요.
            pass
        except:
            print("⚠️ 환율 정보 수집 건너뜀")

        # DB 업데이트
        if indices_data:
            # symbol을 기준으로 upsert (on_conflict="symbol")
            supabase.table("market_indices").upsert(indices_data, on_conflict="symbol").execute()
            print("✅ Market Indices Update Complete!")
        else:
            print("⚠️ 수집된 데이터가 없습니다.")

    except Exception as e:
        print(f"🚨 Error updating indices: {e}")

if __name__ == "__main__":
    get_market_indices()