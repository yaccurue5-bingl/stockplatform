import requests
import os
from datetime import datetime
from supabase import create_client

# 설정 환경변수
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
KRX_API_KEY = os.getenv("KRX_API_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def fetch_krx(url):
    """KRX API 공통 호출 함수"""
    headers = {"AUTH_KEY": KRX_API_KEY}
    try:
        res = requests.get(url, headers=headers)
        return res.json().get('OutBlock_1', []) if res.status_code == 200 else []
    except:
        return []

def init_companies():
    # 1. API 주소 설정 (기본정보 + 일별매매정보)
    # 코스피/코스닥 각각 호출하여 합칩니다.
    urls = [
        "https://data-dbg.krx.co.kr/svc/apis/sto/stk_isu_base_info", # 코스피 기본
        "https://data-dbg.krx.co.kr/svc/apis/sto/ksq_isu_base_info", # 코스닥 기본
        "https://data-dbg.krx.co.kr/svc/apis/sto/stk_bydd_trd",      # 코스피 시세
        "https://data-dbg.krx.co.kr/svc/apis/sto/ksq_bydd_trd"       # 코스닥 시세
    ]
    
    print("🚀 KRX 데이터 수집 시작...")
    
    # 데이터를 종목코드(ISU_SRT_CD) 기준으로 병합하기 위해 딕셔너리 사용
    company_map = {}

    for i, url in enumerate(urls):
        data = fetch_krx(url)
        for item in data:
            code = item.get('ISU_SRT_CD')
            if not code: continue
            
            if code not in company_map:
                company_map[code] = {"stock_code": code}
            
            # 숫자 클리닝 함수
            def to_int(v): return int(str(v).replace(',', '')) if v and v != '-' else 0

            # i < 2 는 기본정보, i >= 2 는 시세정보
            if i < 2:
                company_map[code].update({
                    "corp_name": item.get('ISU_NM'),
                    "market_type": item.get('MKT_NM'),
                    "sector": item.get('IND_TP_NM')
                })
            else:
                company_map[code].update({
                    "close_price": to_int(item.get('TDD_CLSPRC')),
                    "market_cap": to_int(item.get('MKTCAP')),
                    "volume": to_int(item.get('ACC_TRDVOL')),
                    "trade_value": to_int(item.get('ACC_TRDVAL')),
                    "updated_at": datetime.now().isoformat()
                })

    # 2. Supabase Upsert (리스트로 변환하여 전송)
    final_list = list(company_map.values())
    print(f"📦 총 {len(final_list)}개 종목 DB 반영 중...")
    
    # 성능을 위해 100개씩 끊어서 처리
    for i in range(0, len(final_list), 100):
        chunk = final_list[i:i+100]
        supabase.table("companies").upsert(chunk).execute()

    print("✅ 모든 종목 정보와 시세 데이터가 동기화되었습니다.")

if __name__ == "__main__":
    init_companies()