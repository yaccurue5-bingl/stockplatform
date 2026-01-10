import requests
import os
from datetime import datetime
from supabase import create_client

# 1. 환경 변수 설정 (GitHub Secrets 또는 로컬 .env)
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
KRX_API_KEY = os.getenv("KRX_API_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def fetch_krx(url):
    """KRX API 공통 호출 함수 (헤더에 인증키 포함)"""
    headers = {"AUTH_KEY": KRX_API_KEY}
    try:
        res = requests.get(url, headers=headers)
        if res.status_code == 200:
            return res.json().get('OutBlock_1', [])
        return []
    except Exception as e:
        print(f"API 호출 오류: {e}")
        return []

def run_krx_update():
    # 2. 호출할 API 목록 (유가증권/코스닥 각각 기본정보와 시세정보)
    api_configs = [
        {"url": "https://data-dbg.krx.co.kr/svc/apis/sto/stk_isu_base_info", "type": "base"},
        {"url": "https://data-dbg.krx.co.kr/svc/apis/sto/ksq_isu_base_info", "type": "base"},
        {"url": "https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd", "type": "price"},
        {"url": "https://data-dbg.krx.co.kr/svc/apis/sto/ksq_bydd_trd", "type": "price"}
    ]
    
    # 데이터를 종목코드(ISU_SRT_CD) 기준으로 합치기 위한 저장소
    merged_data = {}

    print(f"🚀 KRX 데이터 수집 시작 ({datetime.now()})")

    for config in api_configs:
        items = fetch_krx(config['url'])
        for item in items:
            code = item.get('ISU_SRT_CD') # 단축코드
            if not code: continue
            
            if code not in merged_data:
                merged_data[code] = {"stock_code": code}
            
            # 숫자 클리닝 함수 (콤마 제거 및 정수 변환)
            def to_int(v): return int(str(v).replace(',', '')) if v and v != '-' else 0

            if config['type'] == "base":
                # 종목 기본 정보 업데이트
                merged_data[code].update({
                    "full_code": item.get('ISU_CD'),
                    "corp_name": item.get('ISU_NM'),
                    "corp_abbr": item.get('ISU_ABBRV'),
                    "market_type": item.get('MKT_NM'),
                    "sector": item.get('IND_TP_NM')
                })
            else:
                # 시세 정보 업데이트 (시가총액, 거래량 등)
                merged_data[code].update({
                    "close_price": to_int(item.get('TDD_CLSPRC')),
                    "market_cap": to_int(item.get('MKTCAP')),
                    "volume": to_int(item.get('ACC_TRDVOL')),
                    "trade_value": to_int(item.get('ACC_TRDVAL')),
                    "updated_at": datetime.now().isoformat()
                })

    # 3. Supabase Upsert 실행 (100개씩 묶어서 처리하여 성능 최적화)
    final_list = list(merged_data.values())
    print(f"📦 총 {len(final_list)}개 종목의 병합 데이터 완료. DB 반영 중...")
    
    for i in range(0, len(final_list), 100):
        chunk = final_list[i:i+100]
        try:
            # 동일한 stock_code가 있으면 업데이트, 없으면 삽입
            supabase.table("companies").upsert(chunk).execute()
        except Exception as e:
            print(f"❌ Upsert 오류 (Chunk {i}): {e}")

    print("✅ 모든 데이터가 성공적으로 동기화되었습니다.")

if __name__ == "__main__":
    run_krx_update()