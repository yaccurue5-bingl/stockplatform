import os
import requests
from supabase import create_client, Client
from datetime import datetime
from utils.env_loader import load_env

# 환경 변수 로드 (.env.local 및 시스템 환경 변수)
load_env()

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("🚨 에러: SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.")
    exit(1)

supabase: Client = create_client(url, key)

def get_market_indices_from_yahoo():
    """
    Yahoo Finance API를 사용하여 시장 지수 및 환율 수집
    - 코스피(^KS11), 코스닥(^KQ11), 달러/원(KRW=X)
    """
    print("🚀 Yahoo Finance 기반 시장 데이터 수집 중...")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    }
    
    targets = [
        {
            "url": "https://query1.finance.yahoo.com/v8/finance/chart/^KS11?interval=1d",
            "symbol": "KOSPI",
            "name": "코스피"
        },
        {
            "url": "https://query1.finance.yahoo.com/v8/finance/chart/^KQ11?interval=1d",
            "symbol": "KOSDAQ", 
            "name": "코스닥"
        },
        {
            "url": "https://query1.finance.yahoo.com/v8/finance/chart/KRW=X?interval=1d",
            "symbol": "USDKRW",
            "name": "달러/원"
        }
    ]
    
    payload = []
    
    for target in targets:
        try:
            response = requests.get(target['url'], headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                result = data['chart']['result'][0]
                quote = result['indicators']['quote'][0]
                meta = result['meta']
                
                # 최신 종가 데이터 가져오기 (마지막 유효값)
                prices = [p for p in quote['close'] if p is not None]
                if not prices:
                    continue
                    
                current_price = prices[-1]
                prev_close = meta.get('chartPreviousClose', meta.get('previousClose', current_price))
                
                change = current_price - prev_close
                change_rate = (change / prev_close) * 100 if prev_close > 0 else 0
                
                payload.append({
                    "symbol": target['symbol'],
                    "name": target['name'],
                    "price": f"{current_price:,.2f}",
                    "change_value": f"{change:+,.2f}",
                    "change_rate": round(change_rate, 2),
                    "updated_at": datetime.now().isoformat()
                })
                
                print(f"✅ {target['name']}: {current_price:,.2f} ({change:+.2f}, {change_rate:.2f}%)")
            else:
                print(f"⚠️ {target['name']} 응답 실패 (HTTP {response.status_code})")
        except Exception as e:
            print(f"🚨 {target['name']} 수집 중 에러 발생: {e}")
    
    return payload

def update_market_indices():
    """메인 실행 함수"""
    print("📊 시장 지수 업데이트 프로세스 시작...")
    
    payload = get_market_indices_from_yahoo()
    
    if payload:
        try:
            # symbol을 기준으로 중복 시 업데이트(upsert)
            supabase.table("market_indices").upsert(payload, on_conflict="symbol").execute()
            print(f"🎉 성공: 총 {len(payload)}개 지수가 DB에 업데이트되었습니다.")
            return True
        except Exception as e:
            print(f"🚨 DB 저장 실패: {e}")
            return False
    else:
        print("⚠️ 업데이트할 데이터가 수집되지 않았습니다.")
        return False

if __name__ == "__main__":
    success = update_market_indices()
    # 정상 종료 시 0, 실패 시 1 반환 (자동화 스케줄러 대비)
    exit(0 if success else 1)