import os
import time
from pykrx import stock
from supabase import create_client, Client
from datetime import datetime, timedelta

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def get_nearest_business_day():
    # 오늘부터 최대 10일 전까지 거슬러 올라가며 데이터가 있는 날짜 탐색
    for i in range(10):
        target_date = (datetime.now() - timedelta(days=i)).strftime("%Y%m%d")
        df = stock.get_market_cap(target_date)
        if not df.empty:
            return target_date
    return None

def run():
    target_date = get_nearest_business_day()
    if not target_date:
        print("🚨 최근 10일 내에 유효한 기업 데이터가 없습니다.")
        return

    print(f"🏢 기업 정보 수집 시작 (기준일: {target_date})")
    
    try:
        # 시가총액 및 펀더멘털 데이터 가져오기
        df_cap = stock.get_market_cap(target_date)
        
        all_data = []
        # 상위 200개 종목 수집 (에러 방지를 위해 index 존재 확인)
        for ticker in df_cap.index[:200]:
            name = stock.get_market_ticker_name(ticker)
            try:
                m_cap = int(df_cap.loc[ticker, "시가총액"])
                all_data.append({
                    "stock_code": ticker,
                    "corp_name": name,
                    "market_cap": m_cap,
                    "updated_at": datetime.now().isoformat()
                })
            except KeyError:
                continue

        if all_data:
            supabase.table("companies").upsert(all_data, on_conflict="stock_code").execute()
            print(f"✅ {len(all_data)}개 기업 정보 업데이트 성공")
            
    except Exception as e:
        print(f"🚨 기업 정보 수집 중 에러: {e}")

if __name__ == "__main__":
    run()