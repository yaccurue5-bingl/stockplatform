import os
import requests
from supabase import create_client, Client
from datetime import datetime

url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(url, key)

def get_daum_data(symbol_code, symbol, name):
    """
    다음 금융 API로 데이터 가져오기
    symbol_code:
    - KOSPI: DJI@DJI
    - KOSDAQ: DJI@COMP
    - USD/KRW: FRX.USDKRW
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://finance.daum.net/'
    }
    
    try:
        if symbol == 'USDKRW':
            # 환율 API
            api_url = f"https://finance.daum.net/api/exchanges/{symbol_code}"
        else:
            # 지수 API
            api_url = f"https://finance.daum.net/api/market_index/{symbol_code}"
        
        response = requests.get(api_url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            if symbol == 'USDKRW':
                price = str(data.get('basePrice', 0))
                change_value = str(data.get('change', 0))
                change_rate = float(data.get('changeRate', 0))
            else:
                price = str(data.get('tradePrice', 0))
                change_value = str(data.get('change', 0))
                change_rate = float(data.get('changeRate', 0))
            
            return {
                "symbol": symbol,
                "name": name,
                "price": f"{float(price):,.2f}",
                "change_value": f"{float(change_value):+,.2f}",
                "change_rate": round(change_rate, 2),
                "updated_at": datetime.now().isoformat()
            }
        else:
            print(f"⚠️ API 응답 실패: {name} (HTTP {response.status_code})")
            return None
            
    except Exception as e:
        print(f"🚨 API 호출 에러 ({name}): {e}")
        return None

def get_market_indices_from_investing():
    """
    Investing.com 방식 - 가장 안정적
    """
    print("🚀 Investing.com 기반 지수 수집...")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
    
    # 한국투자증권 Open API나 Yahoo Finance 사용 가능
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
                
                current_price = quote['close'][-1]
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
        except Exception as e:
            print(f"🚨 {target['name']} 수집 실패: {e}")
    
    return payload

def get_market_indices():
    """메인 함수 - Yahoo Finance 사용 (가장 안정적)"""
    print("🚀 시장 지수 실시간 수집 시작...")
    
    payload = get_market_indices_from_investing()
    
    # DB 저장
    if payload:
        try:
            supabase.table("market_indices").upsert(payload, on_conflict="symbol").execute()
            print(f"🎉 총 {len(payload)}개 지수 업데이트 완료")
            return True
        except Exception as e:
            print(f"🚨 DB 저장 실패: {e}")
            return False
    else:
        print("⚠️ 저장할 데이터가 없습니다.")
        return False

if __name__ == "__main__":
    success = get_market_indices()
    exit(0 if success else 1)