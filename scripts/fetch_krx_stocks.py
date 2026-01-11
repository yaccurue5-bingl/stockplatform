import requests
import os
from datetime import datetime, timedelta
from supabase import create_client
import time

# Supabase 설정
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

# KRX 인증키
KRX_AUTH_KEY = os.getenv("KRX_API_KEY", "74D1B99DFBF345BBA3FB4476510A4BED4C78D13A")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("❌ Supabase 환경 변수 누락")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# KRX Open API 엔드포인트
KRX_APIS = {
    "kospi_base": "https://data-dbg.krx.co.kr/svc/apis/sto/stk_isu_base_info",
    "kosdaq_base": "https://data-dbg.krx.co.kr/svc/apis/sto/ksq_isu_base_info",
    "kospi_trade": "https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd",
    "kosdaq_trade": "https://data-dbg.krx.co.kr/svc/apis/sto/ksq_bydd_trd"
}

def get_previous_business_day():
    """
    직전 영업일 계산
    - KRX는 당일 데이터 제공 안 함
    - 주말/공휴일 고려
    
    예시:
    - 금요일 실행 → 목요일 반환
    - 토요일 실행 → 금요일 반환
    - 일요일 실행 → 금요일 반환
    - 월요일 실행 → 금요일 반환
    """
    today = datetime.now()
    weekday = today.weekday()  # 0=월, 1=화, 2=수, 3=목, 4=금, 5=토, 6=일
    
    if weekday == 5:  # 토요일
        days_back = 1  # 금요일
    elif weekday == 6:  # 일요일
        days_back = 2  # 금요일
    elif weekday == 0:  # 월요일
        days_back = 3  # 금요일
    else:  # 화~금
        days_back = 1  # 전날
    
    business_day = today - timedelta(days=days_back)
    date_str = business_day.strftime('%Y%m%d')
    
    print(f"   📅 오늘: {today.strftime('%Y-%m-%d %A')}")
    print(f"   📅 직전 영업일: {business_day.strftime('%Y-%m-%d %A')} ({date_str})")
    
    return date_str

def fetch_krx_data(url, market_name, bas_dt):
    """
    KRX Open API 호출
    bas_dt: 기준일자 (YYYYMMDD)
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'AUTH_KEY': KRX_AUTH_KEY
    }
    
    # 기준일자 파라미터 추가
    params = {
        'auth_key': KRX_AUTH_KEY,
        'basDt': bas_dt  # 🔑 직전 영업일
    }
    
    try:
        print(f"📡 {market_name} 요청 중... (기준일: {bas_dt})")
        
        # 1차 시도: 헤더 + 쿼리 파라미터
        response = requests.get(url, headers=headers, params=params, timeout=30)
        
        if response.status_code != 200:
            print(f"⚠️ HTTP {response.status_code}, 헤더만 재시도...")
            # 2차 시도: 헤더만
            response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ HTTP {response.status_code}")
            print(f"   응답: {response.text[:300]}")
            return []
        
        data = response.json()
        
        # 응답 구조 확인
        if 'OutBlock_1' not in data:
            print(f"⚠️ {market_name}: 예상치 못한 응답 구조")
            print(f"   응답 키: {list(data.keys())}")
            print(f"   전체 응답: {data}")
            return []
        
        items = data.get('OutBlock_1', [])
        
        if not items:
            print(f"⚠️ {market_name}: 데이터 없음 (영업일 확인 필요)")
            return []
        
        print(f"✅ {market_name}: {len(items)}개 종목")
        return items
        
    except requests.exceptions.Timeout:
        print(f"⏱️ {market_name}: 타임아웃 (30초)")
        return []
    except Exception as e:
        print(f"🚨 {market_name} 오류: {e}")
        import traceback
        traceback.print_exc()
        return []

def clean_number(value):
    """숫자 변환"""
    if not value or value == '-':
        return 0
    try:
        return int(str(value).replace(',', '').replace(' ', ''))
    except:
        return 0

def merge_stock_data():
    """KRX API 데이터 병합"""
    print(f"\n{'='*70}")
    print(f"🚀 KRX Open API 전종목 데이터 수집")
    print(f"   시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 직전 영업일 계산
    bas_dt = get_previous_business_day()
    print(f"   📅 기준일자: {bas_dt} (직전 영업일)")
    print(f"   🔑 인증키: {KRX_AUTH_KEY[:20]}...")
    print(f"{'='*70}\n")
    
    # 1. 기본 정보 수집
    print("📊 Step 1/4: KOSPI 기본정보")
    kospi_base = fetch_krx_data(KRX_APIS['kospi_base'], 'KOSPI 기본정보', bas_dt)
    time.sleep(1)
    
    print("\n📊 Step 2/4: KOSDAQ 기본정보")
    kosdaq_base = fetch_krx_data(KRX_APIS['kosdaq_base'], 'KOSDAQ 기본정보', bas_dt)
    time.sleep(1)
    
    # 2. 매매 정보 수집
    print("\n💹 Step 3/4: KOSPI 매매정보")
    kospi_trade = fetch_krx_data(KRX_APIS['kospi_trade'], 'KOSPI 매매정보', bas_dt)
    time.sleep(1)
    
    print("\n💹 Step 4/4: KOSDAQ 매매정보")
    kosdaq_trade = fetch_krx_data(KRX_APIS['kosdaq_trade'], 'KOSDAQ 매매정보', bas_dt)
    
    # 3. 데이터 병합
    print("\n🔄 데이터 병합 중...")
    merged = {}
    
    # 기본 정보
    for item in kospi_base + kosdaq_base:
        code = item.get('ISU_SRT_CD')
        if not code:
            continue
        
        merged[code] = {
            'stock_code': code,
            'full_code': item.get('ISU_CD', ''),
            'corp_name': item.get('ISU_ABBRV', ''),
            'corp_name_full': item.get('ISU_NM', ''),
            'market_type': item.get('MKT_NM', ''),
            'sector': item.get('SECT_TP_NM', ''),
            'updated_at': datetime.now().isoformat()
        }
    
    # 매매 정보
    for item in kospi_trade + kosdaq_trade:
        code = item.get('ISU_SRT_CD')
        if code in merged:
            merged[code].update({
                'close_price': clean_number(item.get('TDD_CLSPRC')),
                'open_price': clean_number(item.get('TDD_OPNPRC')),
                'high_price': clean_number(item.get('TDD_HGPRC')),
                'low_price': clean_number(item.get('TDD_LWPRC')),
                'market_cap': clean_number(item.get('MKTCAP')),
                'volume': clean_number(item.get('ACC_TRDVOL')),
                'trade_value': clean_number(item.get('ACC_TRDVAL')),
                'listed_shares': clean_number(item.get('LIST_SHRS'))
            })
    
    companies = list(merged.values())
    print(f"\n📦 병합 완료: 총 {len(companies)}개 종목\n")
    
    # 샘플 출력
    if companies:
        sample = companies[0]
        print("📋 샘플 데이터:")
        print(f"   종목코드: {sample.get('stock_code')}")
        print(f"   종목명: {sample.get('corp_name')}")
        print(f"   시장: {sample.get('market_type')}")
        print(f"   종가: {sample.get('close_price'):,}원")
        print(f"   시가총액: {sample.get('market_cap'):,}백만원\n")
    
    return companies

def save_to_supabase(companies):
    """Supabase 저장"""
    if not companies:
        print("❌ 저장할 데이터 없음")
        return False
    
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
            time.sleep(0.5)
            
        except Exception as e:
            failed += len(batch)
            print(f"   ❌ Batch {batch_num} 실패: {str(e)[:100]}")
    
    print(f"\n{'='*70}")
    print(f"🎉 저장 완료!")
    print(f"   - 성공: {success}개")
    print(f"   - 실패: {failed}개")
    print(f"   - 완료 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*70}\n")
    
    return success > 0

def run():
    """메인 실행"""
    try:
        companies = merge_stock_data()
        
        if not companies:
            print("\n❌ KRX API에서 데이터를 가져오지 못했습니다.")
            print("\n원인:")
            print("1. 오늘이 공휴일이거나 주말일 수 있습니다.")
            print("2. KRX API 서비스별 신청이 승인되지 않았을 수 있습니다.")
            print("3. https://openapi.krx.co.kr/ → 마이페이지 → API 이용현황 확인")
            print("\n대안: 네이버 금융 API 사용 권장")
            return False
        
        success = save_to_supabase(companies)
        return success
        
    except Exception as e:
        print(f"\n🚨 예상치 못한 오류: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = run()
    exit(0 if success else 1)