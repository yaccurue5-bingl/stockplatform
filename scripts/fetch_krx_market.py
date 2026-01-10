import requests
import os
from datetime import datetime
from supabase import create_client
import time

# Supabase 설정
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# KRX Open API 엔드포인트
KRX_APIS = {
    "kospi_base": "https://data-dbg.krx.co.kr/svc/apis/sto/stk_isu_base_info",
    "kosdaq_base": "https://data-dbg.krx.co.kr/svc/apis/sto/ksq_isu_base_info",
    "kospi_trade": "https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd",
    "kosdaq_trade": "https://data-dbg.krx.co.kr/svc/apis/sto/ksq_bydd_trd"
}

def fetch_krx_data(url, market_name):
    """
    KRX Open API 호출
    - 인증키 불필요
    - OutBlock_1 배열로 응답
    """
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
    }
    
    try:
        print(f"📡 {market_name} 데이터 요청 중...")
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code != 200:
            print(f"❌ HTTP {response.status_code}: {response.text[:200]}")
            return []
        
        data = response.json()
        
        # KRX API 응답 구조: {"OutBlock_1": [...]}
        items = data.get('OutBlock_1', [])
        
        if not items:
            print(f"⚠️ {market_name}: 데이터 없음")
            return []
        
        print(f"✅ {market_name}: {len(items)}개 종목 수신")
        return items
        
    except Exception as e:
        print(f"🚨 {market_name} API 오류: {e}")
        return []

def clean_number(value):
    """
    콤마 제거 및 숫자 변환
    '-' 또는 빈 값은 0으로 처리
    """
    if not value or value == '-':
        return 0
    try:
        return int(str(value).replace(',', ''))
    except:
        return 0

def merge_stock_data():
    """
    KRX API 4개 엔드포인트 데이터 병합
    """
    print(f"\n{'='*70}")
    print(f"🚀 KRX Open API 전종목 데이터 수집 시작")
    print(f"   시작 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*70}\n")
    
    # 1. 기본 정보 수집
    kospi_base = fetch_krx_data(KRX_APIS['kospi_base'], 'KOSPI 기본정보')
    kosdaq_base = fetch_krx_data(KRX_APIS['kosdaq_base'], 'KOSDAQ 기본정보')
    
    time.sleep(1)  # API 부하 방지
    
    # 2. 매매 정보 수집
    kospi_trade = fetch_krx_data(KRX_APIS['kospi_trade'], 'KOSPI 매매정보')
    kosdaq_trade = fetch_krx_data(KRX_APIS['kosdaq_trade'], 'KOSDAQ 매매정보')
    
    # 3. 데이터 병합 (종목코드 기준)
    merged = {}
    
    # 기본 정보 매핑
    for item in kospi_base + kosdaq_base:
        code = item.get('ISU_SRT_CD')  # 종목코드 (6자리)
        if not code:
            continue
        
        merged[code] = {
            'stock_code': code,
            'full_code': item.get('ISU_CD', ''),  # 12자리 표준코드
            'corp_name': item.get('ISU_ABBRV', ''),  # 종목약명
            'corp_name_full': item.get('ISU_NM', ''),  # 종목명
            'market_type': item.get('MKT_NM', ''),  # KOSPI/KOSDAQ
            'sector': item.get('SECT_TP_NM', ''),  # 업종명
            'updated_at': datetime.now().isoformat()
        }
    
    # 매매 정보 추가
    for item in kospi_trade + kosdaq_trade:
        code = item.get('ISU_SRT_CD')
        
        if code in merged:
            merged[code].update({
                'close_price': clean_number(item.get('TDD_CLSPRC')),  # 종가
                'open_price': clean_number(item.get('TDD_OPNPRC')),  # 시가
                'high_price': clean_number(item.get('TDD_HGPRC')),  # 고가
                'low_price': clean_number(item.get('TDD_LWPRC')),  # 저가
                'market_cap': clean_number(item.get('MKTCAP')),  # 시가총액 (백만원)
                'volume': clean_number(item.get('ACC_TRDVOL')),  # 거래량
                'trade_value': clean_number(item.get('ACC_TRDVAL')),  # 거래대금 (백만원)
                'listed_shares': clean_number(item.get('LIST_SHRS'))  # 상장주식수
            })
    
    companies = list(merged.values())
    
    print(f"\n📦 병합 완료: 총 {len(companies)}개 종목\n")
    
    return companies

def save_to_supabase(companies):
    """
    Supabase companies 테이블에 저장
    """
    if not companies:
        print("❌ 저장할 데이터가 없습니다.")
        return False
    
    print("💾 Supabase 저장 중...\n")
    
    batch_size = 100
    success_count = 0
    fail_count = 0
    
    for i in range(0, len(companies), batch_size):
        batch = companies[i:i+batch_size]
        batch_num = (i // batch_size) + 1
        
        try:
            result = supabase.table("companies").upsert(
                batch,
                on_conflict="stock_code"
            ).execute()
            
            success_count += len(batch)
            print(f"✅ Batch {batch_num}: {len(batch)}개 저장 성공")
            
            # Supabase API 속도 제한 방지
            time.sleep(0.5)
            
        except Exception as e:
            fail_count += len(batch)
            print(f"❌ Batch {batch_num} 저장 실패: {str(e)[:100]}")
    
    print(f"\n{'='*70}")
    print(f"🎉 저장 완료!")
    print(f"   - 성공: {success_count}개")
    print(f"   - 실패: {fail_count}개")
    print(f"   - 완료 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*70}\n")
    
    return success_count > 0

def run():
    """메인 실행"""
    # 환경 변수 확인
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Supabase 환경 변수가 설정되지 않았습니다.")
        print("   SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 설정하세요.")
        return False
    
    try:
        # 1. KRX API에서 데이터 수집 및 병합
        companies = merge_stock_data()
        
        if not companies:
            print("❌ KRX API에서 데이터를 가져오지 못했습니다.")
            return False
        
        # 2. Supabase 저장
        success = save_to_supabase(companies)
        
        return success
        
    except Exception as e:
        print(f"🚨 예상치 못한 오류: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = run()
    exit(0 if success else 1)