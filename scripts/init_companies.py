import os
import requests
import yfinance as yf
from supabase import create_client, Client
from datetime import datetime

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def run():
    print("🏢 공시 기반 기업 정보 수집 시작...")
    
    # 1. 최근 공시 종목 추출 (커플링)
    res = supabase.table("disclosure_insights").select("stock_code, corp_name").execute()
    stock_map = {item['stock_code']: item['corp_name'] for item in res.data if item.get('stock_code')}
    
    if not stock_map:
        print("⚠️ 공시 데이터가 없습니다.")
        return

    all_companies = []
    for code, name in stock_map.items():
        try:
            # 한국 종목은 코드 뒤에 .KS(코스피) 또는 .KQ(코스닥)가 붙어야 함
            ticker_ks = yf.Ticker(f"{code}.KS")
            m_cap = ticker_ks.info.get('marketCap')
            
            if not m_cap: # 코스피에 없으면 코스닥 시도
                ticker_kq = yf.Ticker(f"{code}.KQ")
                m_cap = ticker_kq.info.get('marketCap')

            all_companies.append({
                "stock_code": code,
                "corp_name": name,
                "market_cap": m_cap if m_cap else 0,
                "updated_at": datetime.now().isoformat()
            })
            print(f"✅ {name}({code}) 시총: {m_cap}")
        except Exception as e:
            print(f"🚨 {code} 오류: {e}")

    if all_companies:
        supabase.table("companies").upsert(all_companies, on_conflict="stock_code").execute()
        print(f"🎉 {len(all_companies)}개 기업 동기화 완료")

if __name__ == "__main__":
    run()