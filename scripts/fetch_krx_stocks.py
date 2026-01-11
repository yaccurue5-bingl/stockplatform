import requests
import os
from datetime import datetime, timedelta
from supabase import create_client
import time
import xml.etree.ElementTree as ET

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

def get_previous_business_day():
    """
    직전 영업일 계산
    - 금요일 데이터는 차주 월요일 오후 1시에 제공
    - 기준일자로부터 영업일 하루 뒤 업데이트
    """
    today = datetime.now()
    weekday = today.weekday()
    
    # 월요일 오후 1시 이전 → 지난주 목요일 데이터
    if weekday == 0 and today.hour < 13:
        days_back = 4  # 목요일
    # 월요일 오후 1시 이후 → 지난주 금요일 데이터
    elif weekday == 0:
        days_back = 3  # 금요일
    # 토요일 → 금요일 데이터 (월요일에 업데이트됨)
    elif weekday == 5:
        days_back = 1  # 금요일
    # 일요일 → 금요일 데이터
    elif weekday == 6:
        days_back = 2  # 금요일
    # 화~금요일 → 전날 데이터 (오후 1시 기준)
    else:
        days_back = 1 if today.hour >= 13 else 2
    
    business_day = today - timedelta(days=days_back)
    return business_day.strftime('%Y%m%d')

def fetch_stock_data(bas_dt, page_no=1, num_of_rows=1000):
    """
    공공데이터포털 API로 주식시세 조회
    """
    params = {
        'serviceKey': DATA_GO_KR_KEY,
        'numOfRows': num_of_rows,
        'pageNo': page_no,
        'resultType': 'xml',
        'basDt': bas_dt  # 기준일자 (YYYYMMDD)
    }
    
    try:
        response = requests.get(API_URL, params=params, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ HTTP {response.status_code}")
            print(f"   응답: {response.text[:500]}")
            return None, 0
        
        # XML 파싱
        root = ET.fromstring(response.content)
        
        # 결과 코드 확인
        result_code = root.find('.//resultCode')
        result_msg = root.find('.//resultMsg')
        
        if result_code is not None and result_code.text != '00':
            print(f"❌ API 오류: {result_code.text} - {result_msg.text if result_msg is not None else 'Unknown'}")
            return None, 0
        
        # 전체 결과 수
        total_count_elem = root.find('.//totalCount')
        total_count = int(total_count_elem.text) if total_count_elem is not None else 0
        
        # items 파싱
        items = []
        for item in root.findall('.//item'):
            items.append({
                'basDt': item.findtext('basDt', ''),
                'srtnCd': item.findtext('srtnCd', ''),
                'isinCd': item.findtext('isinCd', ''),
                'itmsNm': item.findtext('itmsNm', ''),
                'mrktCtg': item.findtext('mrktCtg', ''),
                'clpr': item.findtext('clpr', '0'),
                'vs': item.findtext('vs', '0'),
                'fltRt': item.findtext('fltRt', '0'),
                'mkp': item.findtext('mkp', '0'),
                'hipr': item.findtext('hipr', '0'),
                'lopr': item.findtext('lopr', '0'),
                'trqu': item.findtext('trqu', '0'),
                'trPrc': item.findtext('trPrc', '0'),
                'lstgStCnt': item.findtext('lstgStCnt', '0'),
                'mrktTotAmt': item.findtext('mrktTotAmt', '0')
            })
        
        return items, total_count
        
    except Exception as e:
        print(f"🚨 API 호출 오류: {e}")
        import traceback
        traceback.print_exc()
        return None, 0

def transform_to_db_format(api_data):
    """
    API 응답을 DB 형식으로 변환
    """
    companies = []
    
    for item in api_data:
        try:
            companies.append({
                'stock_code': item['srtnCd'],  # 단축코드 (6자리)
                'full_code': item['isinCd'],   # ISIN코드 (12자리)
                'corp_name': item['itmsNm'],   # 종목명
                'market_type': item['mrktCtg'], # KOSPI/KOSDAQ/KONEX
                'close_price': int(item['clpr']) if item['clpr'] else 0,
                'open_price': int(item['mkp']) if item['mkp'] else 0,
                'high_price': int(item['hipr']) if item['hipr'] else 0,
                'low_price': int(item['lopr']) if item['lopr'] else 0,
                'volume': int(item['trqu']) if item['trqu'] else 0,
                'trade_value': int(item['trPrc']) if item['trPrc'] else 0,
                'market_cap': int(item['mrktTotAmt']) if item['mrktTotAmt'] else 0,
                'listed_shares': int(item['lstgStCnt']) if item['lstgStCnt'] else 0,
                'updated_at': datetime.now().isoformat()
            })
        except Exception as e:
            print(f"⚠️ 변환 실패: {e}")
            continue
    
    return companies

def run():
    """메인 실행"""
    print(f"\n{'='*70}")
    print(f"🚀 공공데이터포털 주식시세 정보 수집")
    print(f"   시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 직전 영업일 계산
    bas_dt = get_previous_business_day()
    print(f"   📅 기준일자: {bas_dt}")
    print(f"   🔑 API Key: {DATA_GO_KR_KEY[:20]}...")
    print(f"{'='*70}\n")
    
    # 1차 API 호출 (총 개수 확인)
    print("📊 1차 조회: 총 종목 수 확인")
    first_page, total_count = fetch_stock_data(bas_dt, page_no=1, num_of_rows=100)
    
    if first_page is None:
        print("\n❌ API 호출 실패")
        print("\n원인:")
        print("1. API 키가 잘못되었거나 활성화되지 않음")
        print("2. 오늘이 데이터 갱신 시간 이전 (평일 오후 1시 이후 확인)")
        print("3. https://www.data.go.kr/data/15094808/openapi.do 에서 키 확인")
        return False
    
    print(f"   ✅ 총 {total_count:,}개 종목 확인\n")
    
    # 전체 데이터 수집
    all_items = []
    num_of_rows = 1000  # 한 번에 1000개씩
    total_pages = (total_count // num_of_rows) + 1
    
    print(f"📡 전체 데이터 수집 중 ({total_pages}페이지)...")
    
    for page in range(1, total_pages + 1):
        items, _ = fetch_stock_data(bas_dt, page_no=page, num_of_rows=num_of_rows)
        
        if items:
            all_items.extend(items)
            print(f"   ✅ 페이지 {page}/{total_pages}: {len(items)}개 수집")
        else:
            print(f"   ⚠️ 페이지 {page} 실패")
        
        # API 요청 제한 방지 (초당 30 tps)
        time.sleep(0.5)
    
    print(f"\n📦 총 {len(all_items):,}개 종목 수집 완료\n")
    
    if not all_items:
        print("❌ 수집된 데이터 없음")
        return False
    
    # 데이터 변환
    print("🔄 데이터 변환 중...")
    companies = transform_to_db_format(all_items)
    print(f"   ✅ {len(companies):,}개 종목 변환 완료\n")
    
    # 샘플 출력
    if companies:
        sample = companies[0]
        print("📋 샘플 데이터:")
        print(f"   종목코드: {sample['stock_code']}")
        print(f"   종목명: {sample['corp_name']}")
        print(f"   시장: {sample['market_type']}")
        print(f"   종가: {sample['close_price']:,}원")
        print(f"   시가총액: {sample['market_cap']:,}백만원\n")
    
    # Supabase 저장
    print("💾 Supabase 저장 중...\n")
    batch_size = 100
    success = 0
    failed = 0
    
    for i in range(0, len(companies), batch_size):
        batch = companies[i:i+batch_size]
        batch_num = (i // batch_size) + 1
        
        try:
            supabase.table("companies").upsert(
                batch,
                on_conflict="stock_code"
            ).execute()
            
            success += len(batch)
            print(f"   ✅ Batch {batch_num}: {len(batch)}개 저장")
            time.sleep(0.3)
            
        except Exception as e:
            failed += len(batch)
            print(f"   ❌ Batch {batch_num} 실패: {str(e)[:100]}")
    
    print(f"\n{'='*70}")
    print(f"🎉 동기화 완료!")
    print(f"   - 기준일자: {bas_dt}")
    print(f"   - 성공: {success:,}개")
    print(f"   - 실패: {failed:,}개")
    print(f"   - 완료 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*70}\n")
    
    return success > 0

if __name__ == "__main__":
    success = run()
    exit(0 if success else 1)