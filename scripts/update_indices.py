import os
from pykrx import stock
from supabase import create_client, Client
from datetime import datetime, timedelta

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def get_latest_valid_date():
    for i in range(15): # 휴장일이 길 수 있으므로 15일까지 탐색
        target_date = (datetime.now() - timedelta(days=i)).strftime("%Y%m%d")
        try:
            # 코스피(1028) 데이터가 실제로 존재하는지 확인
            df = stock.get_market_ohlcv_by_date(target_date, target_date, "1028")
            if not df.empty and "종가" in df.columns and df['종가'].iloc[0] > 0:
                return target_date
        except:
            continue
    return None

def get_market_indices():
    latest_date = get_latest_valid_date()
    if not latest_date:
        print("🚨 유효한 시장 데이터를 찾을 수 없습니다. (최근 15일 탐색 실패)")
        return

    print(f"🚀 기준 날짜: {latest_date} 지수 업데이트 시작")
    indices_data = []
    # KOSPI: 1028, KOSDAQ: 2031
    targets = [("1028", "KOSPI"), ("2031", "KOSDAQ")]
    
    for code, name in targets:
        try:
            df = stock.get_market_ohlcv_by_date(latest_date, latest_date, code)
            if not df.empty and "종가" in df.columns:
                price_val = float(df['종가'].iloc[-1])
                change_val = float(df['등락률'].iloc[-1])
                
                indices_data.append({
                    "symbol": name,
                    "name": name,
                    "price": f"{price_val:,.2f}",
                    "change_rate": change_val,
                    "updated_at": datetime.now().isoformat()
                })
                print(f"📊 {name} 성공: {price_val}")
        except Exception as e:
            print(f"⚠️ {name} 오류: {e}")

    if indices_data:
        supabase.table("market_indices").upsert(indices_data, on_conflict="symbol").execute()
        print("✅ 지수 업데이트 완료")

if __name__ == "__main__":
    get_market_indices()