import pandas as pd
from pykrx import stock
from supabase import create_client, Client
from datetime import datetime
import time

# 1. Supabase 설정
url: str = "https://rxcwqsolfrjhomeusyza.supabase.co"
key: str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ4Y3dxc29sZnJqaG9tZXVzeXphIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTkxNzMyMCwiZXhwIjoyMDgxNDkzMzIwfQ.q8qepH1kS6Smjjo8WyGVE7KM7ksKP6QGmU5_9mPv20o"
supabase: Client = create_client(url, key)

def get_all_stock_data():
    today = datetime.now().strftime("%Y%m%d")
    print(f"🚀 {today} 기준 상장사 데이터 수집 시도 중...")
    
    try:
        # 데이터가 준비될 때까지 최대 3번 시도 (1분 간격)
        for attempt in range(3):
            df_cap = stock.get_market_cap_by_ticker(today, market="ALL")
            
            # 에러의 원인: '시가총액' 컬럼이 실제로 있는지 확인
            if not df_cap.empty and "시가총액" in df_cap.columns:
                print(f"✅ {today} 데이터 로드 성공!")
                break
            else:
                print(f"⏳ 데이터가 아직 준비되지 않았습니다. (시도 {attempt+1}/3)")
                if attempt < 2: time.sleep(60) # 1분 대기
        else:
            print("🚨 KRX에 오늘자 시가총액 데이터가 아직 올라오지 않았습니다. 잠시 후 다시 실행해 주세요.")
            return

        # 종목 리스트 합치기
        kospi_list = stock.get_market_ticker_list(today, market="KOSPI")
        kosdaq_list = stock.get_market_ticker_list(today, market="KOSDAQ")
        tickers = kospi_list + kosdaq_list
        
        all_data = []
        for ticker in tickers:
            try:
                name = stock.get_market_ticker_name(ticker)
                # 컬럼이 있는지 확인 후 안전하게 가져오기
                m_cap = int(df_cap.loc[ticker, "시가총액"]) if ticker in df_cap.index else 0
                
                all_data.append({
                    "stock_code": ticker,
                    "corp_name": name,
                    "market_cap": m_cap,
                    "updated_at": datetime.now().isoformat()
                })
            except:
                continue

        # Supabase 전송
        print(f"📦 총 {len(all_data)}개 기업 전송 시작...")
        for i in range(0, len(all_data), 100):
            batch = all_data[i:i+100]
            supabase.table("companies").upsert(batch).execute()
            print(f"✅ {min(i+100, len(all_data))}개 완료...")
            time.sleep(0.05)

        print(f"🎉 동기화 완료!")

    except Exception as e:
        print(f"🚨 실행 에러: {e}")

if __name__ == "__main__":
    get_all_stock_data()