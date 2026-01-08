import os
import requests
from supabase import create_client, Client
from datetime import datetime
import re

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def get_naver_index_data(code):
    """
    네이버 금융 API를 통해 실시간 지수 데이터 가져오기
    code: 
    - KOSPI: 0001
    - KOSDAQ: 1001
    - USD/KRW: FX_USDKRW
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://finance.naver.com/'
    }
    
    try:
        if code.startswith('FX_'):
            # 환율 API
            api_url = f"https://m.stock.naver.com/front-api/v1/external/exchanges/{code}/basic"
        else:
            # 주식 지수 API
            api_url = f"https://m.stock.naver.com/front-api/v1/external/index/{code}/basic"
        
        response = requests.get(api_url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            return data
        else:
            print(f"⚠️ API 응답 실패: {code} (HTTP {response.status_code})")
            return None
            
    except Exception as e:
        print(f"🚨 API 호출 에러 ({code}): {e}")
        return None

def parse_index_data(data, symbol, name):
    """지수 데이터 파싱"""
    try:
        if symbol == 'USDKRW':
            # 환율 데이터 파싱
            price = str(data.get('closePrice', 0))
            change_value = str(data.get('compareToPreviousClosePrice', 0))
            change_rate = float(data.get('fluctuationsRatio', 0))
        else:
            # 지수 데이터 파싱
            price = str(data.get('closePrice', 0))
            change_value = str(data.get('compareToPreviousClosePrice', 0))
            change_rate = float(data.get('fluctuationsRatio', 0))
        
        return {
            "symbol": symbol,
            "name": name,
            "price": price,
            "change_value": change_value,
            "change_rate": round(change_rate, 2),
            "updated_at": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"🚨 데이터 파싱 에러 ({symbol}): {e}")
        return None

def get_market_indices():
    print("🚀 네이버 금융 API 기반 지수 수집 시작...")
    
    # 수집 대상 정의
    targets = [
        {"code": "0001", "symbol": "KOSPI", "name": "코스피"},
        {"code": "1001", "symbol": "KOSDAQ", "name": "코스닥"},
        {"code": "FX_USDKRW", "symbol": "USDKRW", "name": "달러/원"}
    ]
    
    payload = []
    
    for target in targets:
        print(f"📊 {target['name']} 수집 중...")
        
        data = get_naver_index_data(target['code'])
        
        if data:
            parsed = parse_index_data(data, target['symbol'], target['name'])
            if parsed:
                payload.append(parsed)
                print(f"✅ {target['name']}: {parsed['price']} ({parsed['change_value']}, {parsed['change_rate']}%)")
        else:
            print(f"❌ {target['name']} 수집 실패")
    
    # DB 저장
    if payload:
        try:
            supabase.table("market_indices").upsert(payload, on_conflict="symbol").execute()
            print(f"🎉 총 {len(payload)}개 지수 업데이트 완료")
        except Exception as e:
            print(f"🚨 DB 저장 실패: {e}")
    else:
        print("⚠️ 저장할 데이터가 없습니다.")

if __name__ == "__main__":
    get_market_indices()