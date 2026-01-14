import requests
import os
from datetime import datetime, timedelta
from supabase import create_client
import time

# Supabase 설정
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# 공공데이터포털 API 키
DATA_GO_KR_KEY = os.getenv("DATA_GO_KR_API_KEY", "")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Supabase 환경 변수 누락")
    exit(1)

if not DATA_GO_KR_KEY:
    print("❌ DATA_GO_KR_API_KEY 환경 변수 누락")
    print("   https://www.data.go.kr/data/15094808/openapi.do 에서 발급받으세요")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# API 엔드포인트
API_URL = "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo"

def get_available_data_date():
    """
    데이터 조회 가능한 날짜 계산
    """
    now = datetime.now()
    current_hour = now.hour
    weekday = now.weekday()  # 0=월, 1=화, 2=수, 3=목, 4=금, 5=토, 6=일
    
    days_back = 2
    if weekday == 0:
        days_back = 4 if current_hour < 13 else 3
    elif weekday == 1:
        days_back = 4 if current_hour < 13 else 1
    elif weekday in [2, 3, 4]:
        days_back = 2 if current_hour < 13 else 1
    elif weekday == 5:
        days_back = 2
    elif weekday == 6:
        days_back = 3
    
    target_date = now - timedelta(days=days_back)
    return target_date.strftime('%Y%m%d')

def fetch_stock_data(bas_dt, page_no=1, num_of_rows=1000):
    """
    공공데이터포털 API로 주식시세 조회 (JSON 파싱 방식)
    """
    params = {
        'serviceKey': DATA_GO_KR_KEY,
        'numOfRows': num_of_rows,
        'pageNo': page_no,
        'resultType': 'json', # JSON으로 요청하도록 고정
        'basDt': bas_dt
    }
    
    try:
        response = requests.get(API_URL, params=params, timeout=30)
        
        if response.status_code != 200:
            print(f"   ❌ HTTP {response.status_code}")
            return None, 0
        
        # JSON 파싱
        data = response.json()
        
        # 결과 코드 확인 (JSON 구조에 맞게 접근)
        header = data.get('response', {}).get('header', {})
        result_code = header.get('resultCode')
        result_msg = header.get('resultMsg')
        
        if result_code != '00':
            print(f"   ❌ API 오류 코드: {result_code}")
            print(f"   메시지: {result_msg}")
            
            if result_code == '03':
                print("   💡 해당 날짜에 데이터가 없습니다.")
            return None, 0
        
        # body에서 실제 데이터 찾기
        body = data.get('response', {}).get('body', {})
        if not body:
            print("   ⚠️ body 데이터를 찾을 수 없습니다.")
            return None, 0
        
        total_count = int(body.get('totalCount', 0))
        
        # items/item 리스트 추출
        items_raw = body.get('items', {}).get('item', [])
        
        # 데이터가 1개일 경우 dict로 오므로 리스트로 변환
        if isinstance(items_raw, dict):
            items_raw = [items_raw]
            
        return items_raw, total_count
        
    except Exception as e:
        print(f"   🚨 API 호출 또는 파싱 오류: {e}")
        return None, 0

def try_fetch_recent_data(max_days_back=7):
    """
    최근 7일 이내 데이터를 찾을 때까지 시도
    """
    now = datetime.now()
    for days_back in range(2, max_days_back + 1):
        target_date = now - timedelta(days=days_back)
        bas_dt = target_date.strftime('%Y%m%d')
        if target_date.weekday() in [5, 6]: continue
        
        print(f"\n📅 {bas_dt} ({target_date.strftime('%Y-%m-%d %A')}) 조회 시도...")
        items, total_count = fetch_stock_data(bas_dt, page_no=1, num_of_rows=100)
        
        if items and len(items) > 0:
            print(f"   ✅ 데이터 발견! 총 {total_count:,}개 종목")
            return bas_dt, total_count
        else:
            print(f"   ⚠️ 데이터 없음")
    return None, 0

def transform_to_db_format(api_data):
    """
    API 응답을 DB 형식으로 변환
    """
    companies = []
    for item in api_data:
        try:
            companies.append({
                'stock_code': item.get('srtnCd', ''),
                'full_code': item.get('isinCd', ''),
                'corp_name': item.get('itmsNm', ''),
                'market_type': item.get('mrktCtg', ''),
                'close_price': int(item.get('clpr', 0)),
                'open_price': int(item.get('mkp', 0)),
                'high_price': int(item.get('hipr', 0)),
                'low_price': int(item.get('lopr', 0)),
                'volume': int(item.get('trqu', 0)),
                'trade_value': int(item.get('trPrc', 0)),
                'market_cap': int(item.get('mrktTotAmt', 0)),
                'listed_shares': int(item.get('lstgStCnt', 0)),
                'updated_at': datetime.now().isoformat()
            })
        except Exception as e:
            print(f"   ⚠️ 변환 실패 ({item.get('itmsNm', 'Unknown')}): {e}")
            continue
    return companies

def run():
    """메인 실행"""
    print(f"\n{'='*70}")
    print(f"🚀 공공데이터포털 주식시세 정보 수집 (JSON Mode)")
    print(f"{'='*70}\n")
    
    bas_dt, total_count = try_fetch_recent_data(max_days_back=7)
    
    if not bas_dt:
        print("\n❌ 최근 데이터를 찾을 수 없습니다.")
        return False
    
    all_items = []
    num_of_rows = 1000
    total_pages = (total_count // num_of_rows) + 1
    
    for page in range(1, total_pages + 1):
        items, _ = fetch_stock_data(bas_dt, page_no=page, num_of_rows=num_of_rows)
        if items:
            all_items.extend(items)
            print(f"   ✅ 페이지 {page}/{total_pages}: {len(items)}개 수집")
        time.sleep(0.6)
    
    companies = transform_to_db_format(all_items)
    
    print(f"\n💾 Supabase 저장 중 ({len(companies)}개)...\n")
    batch_size = 100
    success = 0
    
    for i in range(0, len(companies), batch_size):
        batch = companies[i:i+batch_size]
        try:
            supabase.table("companies").upsert(batch, on_conflict="stock_code").execute()
            success += len(batch)
            print(f"   ✅ Batch {(i//batch_size)+1} 저장 완료")
            time.sleep(0.3)
        except Exception as e:
            print(f"   ❌ Batch 실패: {str(e)[:100]}")
    
    print(f"\n🎉 최종 완료: {success}개 데이터 동기화")
    return success > 0

if __name__ == "__main__":
    success = run()
    exit(0 if success else 1)
