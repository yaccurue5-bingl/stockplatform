import pandas as pd
from pykrx import stock
from supabase import create_client, Client
from datetime import datetime
import time

# 1. Supabase 설정
url: str = "https://rxcwqsolfrjhomeusyza.supabase.co"
key: str = "***REMOVED***"
supabase: Client = create_client(url, key)

def get_all_stock_data():
    # 1. 오늘 날짜 설정 (롤백 완료)
    today = datetime.now().strftime("%Y%m%d")
    print(f"🚀 {today} 기준 상장사 기초 데이터 수집 시작...")
    
    try:
        # 2. 전 종목 시가총액 정보 가져오기
        df_cap = stock.get_market_cap_by_ticker(today, market="ALL")
        
        # 데이터가 없을 경우 에러 메시지 출력 후 종료
        if df_cap.empty:
            print(f"🚨 {today}에 해당하는 데이터가 아직 거래소에 생성되지 않았습니다.")
            print("💡 장 시작(09:00) 후 약 5~10분 뒤에 다시 시도해 주세요.")
            return

        # 3. KOSPI, KOSDAQ 종목 리스트 합치기
        kospi_list = stock.get_market_ticker_list(today, market="KOSPI")
        kosdaq_list = stock.get_market_ticker_list(today, market="KOSDAQ")
        tickers = kospi_list + kosdaq_list
        
        all_data = []
        
        for ticker in tickers:
            try:
                name = stock.get_market_ticker_name(ticker)
                # 시가총액 추출
                m_cap = int(df_cap.loc[ticker, "시가총액"]) if ticker in df_cap.index else 0
                
                # 데이터 구성 (사용자 SQL 컬럼명 매칭)
                data = {
                    "stock_code": ticker,
                    "corp_name": name,
                    "market_cap": m_cap,
                    "updated_at": datetime.now().isoformat()
                }
                all_data.append(data)
                
            except Exception:
                continue

        # 4. Supabase Upsert (100개씩 분할 전송)
        print(f"📦 총 {len(all_data)}개 기업 데이터를 전송합니다...")
        for i in range(0, len(all_data), 100):
            batch = all_data[i:i+100]
            try:
                supabase.table("companies").upsert(batch).execute()
                print(f"✅ {min(i+100, len(all_data))} / {len(all_data)} 완료...")
            except Exception as e:
                print(f"⚠️ 전송 오류: {e}")
            time.sleep(0.1)

        print(f"🎉 {today} 상장사 기초 데이터 동기화 완료!")

    except Exception as e:
        print(f"🚨 치명적 에러 발생: {e}")

if __name__ == "__main__":
    get_all_stock_data()