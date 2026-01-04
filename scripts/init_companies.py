import pandas as pd
from pykrx import stock
from supabase import create_client, Client
from datetime import datetime

# 1. Supabase 설정 (본인의 정보로 수정하세요)
url: str = "https://rxcwqsolfrjhomeusyza.supabase.co"
key: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4Y3dxc29sZnJqaG9tZXVzeXphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTkxNzMyMCwiZXhwIjoyMDgxNDkzMzIwfQ.q8qepH1kS6Smjjo8WyGVE7KM7ksKP6QGmU5_9mPv20o"
supabase: Client = create_client(url, key)

def get_all_stock_data():
    print("🚀 상장사 데이터 수집 시작...")
    today = datetime.now().strftime("%Y%m%d")
    
    # KOSPI, KOSDAQ 종목 리스트 합치기
    kospi_list = stock.get_market_ticker_list(today, market="KOSPI")
    kosdaq_list = stock.get_market_ticker_list(today, market="KOSDAQ")
    tickers = kospi_list + kosdaq_list
    
    all_data = []
    
    # 종목명, 시가총액, 외국인 소진율 한꺼번에 가져오기
    # get_market_cap_by_ticker는 시가총액, 거래량 등을 반환합니다.
    df_cap = stock.get_market_cap_by_ticker(today, market="ALL")
    
    for ticker in tickers:
        try:
            name = stock.get_market_ticker_name(ticker)
            # 업종 정보 가져오기
            # sector = stock.get_market_ohlcv(today, today, ticker) # 필요시 추가
            
            # 시가총액 및 기초 재무 항목 추출
            m_cap = df_cap.loc[ticker, "시가총액"] if ticker in df_cap.index else 0
            
            data = {
                "stock_code": ticker,
                "corp_name": name,
                "market_type": "KOSPI" if ticker in kospi_list else "KOSDAQ",
                "market_cap": int(m_cap),
                "last_updated": datetime.now().isoformat()
            }
            all_data.append(data)
        except Exception as e:
            print(f"Error processing {ticker}: {e}")

    # 2. Supabase Upsert (데이터 밀어넣기)
    # 100개씩 끊어서 업로드 (부하 방지)
    for i in range(0, len(all_data), 100):
        batch = all_data[i:i+100]
        supabase.table("companies").upsert(batch).execute()
        print(f"✅ {i+len(batch)}개 기업 정보 동기화 완료...")

if __name__ == "__main__":
    get_all_stock_data()