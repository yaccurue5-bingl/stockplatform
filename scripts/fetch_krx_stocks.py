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

def get_available_data_date():
    """
    데이터 조회 가능한 날짜 계산
    - 금융위원회 API는 기준일자로부터 영업일 하루 뒤 오후 1시 이후 업데이트
    - 금요일 데이터 → 차주 월요일 오후 1시 이후
    - 공휴일 고려 필요
    """
    now = datetime.now()
    current_hour = now.hour
    weekday = now.weekday()  # 0=월, 1=화, 2=수, 3=목, 4=금, 5=토, 6=일
    
    # 기본적으로 2영업일 전부터 시작
    days_back = 2
    
    # 월요일
    if weekday == 0:
        if current_hour < 13:
            # 월요일 오후 1시 이전 → 지난주 목요일
            days_back = 4
        else:
            # 월요일 오후 1시 이후 → 지난주 금요일
            days_back = 3
    
    # 화요일
    elif weekday == 1:
        if current_hour < 13:
            # 화요일 오후 1시 이전 → 지난주 금요일
            days_back = 4
        else:
            # 화요일 오후 1시 이후 → 월요일
            days_back = 1
    
    # 수요일~금요일
    elif weekday in [2, 3, 4]:
        if current_hour < 13:
            # 오후 1시 이전 → 2영업일 전
            days_back = 2
        else:
            # 오후 1시 이후 → 1영업일 전
            days_back = 1
    
    # 토요일
    elif weekday == 5:
        # 토요일 → 금요일 데이터는 월요일에 업데이트되므로 목요일 데이터
        days_back = 2
    
    # 일요일
    elif weekday == 6:
        # 일요일 → 금요일 데이터는 월요일에 업데이트되므로 목요일 데이터
        days_back = 3
    
    target_date = now - timedelta(days=days_back)
    return target_date.strftime('%Y%m%d')

def fetch_stock_data(bas_dt, page_no=1, num_of_rows=1000):
    """
    공공데이터포털 API로 주식시세 조회
    """
    # API 키 URL 인코딩 처리 (일부 특수문자 이슈 방지)
    params = {
        'serviceKey': DATA_GO_KR_KEY,
        'numOfRows': num_of_rows,
        'pageNo': page_no,
        'resultType': 'xml',
        'basDt': bas_dt
    }
    
    try:
        response = requests.get(API_URL, params=params, timeout=30)
        
        # 상태 코드 확인
        if response.status_code != 200:
            print(f"   ❌ HTTP {response.status_code}")
            print(f"   URL: {response.url}")
            print(f"   응답: {response.text[:500]}")
            return None, 0
        
        # XML 파싱
        root = ET.fromstring(response.content)
        
        # 결과 코드 확인
        header = root.find('.//header')
        if header is not None:
            result_code = header.findtext('resultCode')
            result_msg = header.findtext('resultMsg')
            
            if result_code and result_code != '00':
                print(f"   ❌ API 오류 코드: {result_code}")
                print(f"   메시지: {result_msg}")
                
                # 일반적인 오류 메시지 해석
                if result_code == '03':
                    print("   💡 해당 날짜에 데이터가 없습니다. (휴장일이거나 데이터 미제공)")
                elif result_code == '30':
                    print("   💡 API 키가 유효하지 않습니다.")
                elif result_code == '31':
                    print("   💡 일일 트래픽 초과입니다.")
                
                return None, 0
        
        # body에서 실제 데이터 찾기
        body = root.find('.//body')
        if body is None:
            print("   ⚠️ body 태그를 찾을 수 없습니다.")
            return None, 0
        
        # 전체 결과 수
        total_count_elem = body.find('.//totalCount')
        total_count = int(total_count_elem.text) if total_count_elem is not None else 0
        
        # items 파싱
        items = []
        items_elem = body.find('.//items')
        
        if items_elem is not None:
            for item in items_elem.findall('.//item'):
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
        
    except ET.ParseError as e:
        print(f"   🚨 XML 파싱 오류: {e}")
        print(f"   응답 내용: {response.text[:1000]}")
        return None, 0
    except Exception as e:
        print(f"   🚨 API 호출 오류: {e}")
        import traceback
        traceback.print_exc()
        return None, 0

def try_fetch_recent_data(max_days_back=7):
    """
    최근 7일 이내 데이터를 찾을 때까지 시도
    """
    now = datetime.now()
    
    for days_back in range(2, max_days_back + 1):
        target_date = now - timedelta(days=days_back)
        bas_dt = target_date.strftime('%Y%m%d')
        
        # 주말 건너뛰기
        if target_date.weekday() in [5, 6]:
            continue
        
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
                'stock_code': item['srtnCd'],
                'full_code': item['isinCd'],
                'corp_name': item['itmsNm'],
                'market_type': item['mrktCtg'],
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
            print(f"   ⚠️ 변환 실패 ({item.get('itmsNm', 'Unknown')}): {e}")
            continue
    
    return companies

def run():
    """메인 실행"""
    print(f"\n{'='*70}")
    print(f"🚀 공공데이터포털 주식시세 정보 수집")
    print(f"   시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   🔑 API Key: {DATA_GO_KR_KEY[:20]}...")
    print(f"{'='*70}\n")
    
    # 데이터 조회 가능한 날짜 찾기
    print("🔍 최근 영업일 데이터 검색 중...\n")
    bas_dt, total_count = try_fetch_recent_data(max_days_back=7)
    
    if not bas_dt:
        print("\n❌ 최근 7일 이내 데이터를 찾을 수 없습니다.")
        print("\n💡 가능한 원인:")
        print("1. API 키가 활성화되지 않았거나 만료됨")
        print("2. 장기 휴장 기간")
        print("3. API 서비스 점검 중")
        print("\n🔗 확인: https://www.data.go.kr/data/15094808/openapi.do")
        return False
    
    print(f"\n{'='*70}")
    print(f"📊 기준일자: {bas_dt}")
    print(f"📊 총 종목 수: {total_count:,}개")
    print(f"{'='*70}\n")
    
    # 전체 데이터 수집
    all_items = []
    num_of_rows = 1000
    total_pages = (total_count // num_of_rows) + 1
    
    print(f"📡 전체 데이터 수집 중 ({total_pages}페이지)...\n")
    
    for page in range(1, total_pages + 1):
        items, _ = fetch_stock_data(bas_dt, page_no=page, num_of_rows=num_of_rows)
        
        if items:
            all_items.extend(items)
            print(f"   ✅ 페이지 {page}/{total_pages}: {len(items)}개 수집")
        else:
            print(f"   ⚠️ 페이지 {page}/{total_pages} 실패")
        
        # API 요청 제한 방지 (초당 최대 2 TPS)
        time.sleep(0.6)
    
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