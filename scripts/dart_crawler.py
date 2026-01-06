import os
import requests
from datetime import datetime
from supabase import create_client, Client
import urllib3

# SSL 경고 무시 (DART Handshake 에러 해결용)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Supabase 설정 (기존 scripts 방식 유지)
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def get_dart_data():
    DART_API_KEY = os.environ.get("DART_API_KEY")
    if not DART_API_KEY:
        print("❌ DART_API_KEY 환경변수가 없습니다.")
        return

    # 1. 오늘 날짜 설정 (index.ts 로직 반영)
    today = datetime.now().strftime('%Y%m%d')
    api_url = "https://opendart.fss.or.kr/api/list.json"
    
    params = {
        "crtfc_key": DART_API_KEY,
        "bgnde": today,
        "endde": today,
        "page_count": "100"
    }

    try:
        print(f"📡 DART API 호출 중: {today}")
        # verify=False가 핵심 (핸드쉐이크 에러 방지)
        response = requests.get(api_url, params=params, verify=False, timeout=30)
        response.raise_for_status()
        data = response.json()

        if data.get("status") != "000":
            print(f"⚠️ DART 응답 에러: {data.get('message')}")
            return

        dart_list = data.get("list", [])
        print(f"✅ {len(dart_list)}개의 공시 데이터를 수집했습니다.")

        # 2. Supabase DB 저장 (기존 init_companies.py의 upsert 방식 활용)
        for item in dart_list:
            insert_data = {
                "corp_name": item.get("corp_name"),
                "stock_code": item.get("stock_code"),
                "report_nm": item.get("report_nm"),
                "rcept_no": item.get("rcept_no"),
                "flr_nm": item.get("flr_nm"),
                "rcept_dt": item.get("rcept_dt"),
                "updated_at": datetime.now().isoformat()
            }
            
            # rcept_no(접수번호) 기준으로 중복 방지하며 저장
            supabase.table("companies").upsert(insert_data, on_conflict="rcept_no").execute()

        print("🏁 DART 수집 및 DB 동기화 완료")

    except Exception as e:
        print(f"❌ 실행 에러: {e}")

if __name__ == "__main__":
    get_dart_data()