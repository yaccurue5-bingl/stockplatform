import os
from pykrx import stock
from supabase import create_client, Client
from datetime import datetime, timedelta

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def run_init():
    # 데이터가 확실히 존재하는 최근 영업일 기준
    target_date = (datetime.now() - timedelta(days=1)).strftime("%Y%m%d")
    print(f"🏢 기업 정보 초기화 시작 (기준일: {target_date})")

    try:
        # 1. 전종목 시가총액/상장주식수 정보
        df_cap = stock.get_market_cap(target_date)
        # 2. 전종목 펀더멘털(PER, PBR, DIV 등) 정보
        df_fund = stock.get_market_fundamental(target_date)

        companies_payload = []
        # 상위 200개 종목 위주로 먼저 수집 (속도 및 데이터 안정성)
        for ticker in df_cap.index[:200]:
            name = stock.get_market_ticker_name(ticker)
            
            payload = {
                "stock_code": ticker,
                "corp_name": name,
                "market_cap": int(df_cap.loc[ticker, "시가총액"]),
                "operating_profit_margin": float(df_fund.loc[ticker, "PER"]) if ticker in df_fund.index else 0, # 예시로 PER 사용
                "updated_at": datetime.now().isoformat()
            }
            companies_payload.append(payload)

        if companies_payload:
            supabase.table("companies").upsert(companies_payload, on_conflict="stock_code").execute()
            print(f"✅ {len(companies_payload)}개 기업 정보 업데이트 완료")

    except Exception as e:
        print(f"🚨 기업 정보 수집 중 에러: {e}")

if __name__ == "__main__":
    run_init()