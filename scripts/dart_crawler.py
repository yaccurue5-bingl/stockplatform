import os
import requests
from datetime import datetime
from supabase import create_client, Client
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

url = "https://rxcwqsolfrjhomeusyza.supabase.co"
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def run_crawler():
    today = datetime.now().strftime('%Y%m%d')
    dart_key = os.environ.get("DART_API_KEY")
    api_url = f"https://opendart.fss.or.kr/api/list.json?crtfc_key={dart_key}&bgnde={today}&endde={today}&page_count=100"

    print(f"📡 DART 데이터 수집 시작: {today}")
    res = requests.get(api_url, verify=False)
    data = res.json()

    if data.get("status") == "000":
        count = 0
        skipped = 0
        
        for item in data.get("list", []):
            stock_code = item.get("stock_code")
            
            # ✅ 종목코드가 없거나 공백이면 건너뛰기 (문제 2 해결)
            if not stock_code or stock_code.strip() == "" or stock_code == " ":
                corp_name = item.get("corp_name", "Unknown")
                print(f"⏭️ 종목코드 없음 - 건너뜀: {corp_name}")
                skipped += 1
                continue
            
            # ✅ 종목코드 정리 (공백 제거)
            stock_code = stock_code.strip()
            
            payload = {
                "rcept_no": item.get("rcept_no"),
                "corp_name": item.get("corp_name"),
                "stock_code": stock_code,
                "report_nm": item.get("report_nm"),
                "analysis_status": "pending",  # 분석 대기 상태
                "created_at": datetime.now().isoformat()
            }
            
            try:
                supabase.table("disclosure_insights").upsert(payload, on_conflict="rcept_no").execute()
                count += 1
                print(f"✅ [{count}] {item.get('corp_name')} ({stock_code}) - {item.get('report_nm')[:40]}...")
            except Exception as e:
                print(f"❌ DB 저장 실패: {e}")
                
        print(f"\n{'='*70}")
        print(f"🎉 수집 완료")
        print(f"   - 저장: {count}건")
        print(f"   - 건너뜀 (종목코드 없음): {skipped}건")
        print(f"   - 총: {count + skipped}건")
        print(f"{'='*70}\n")
    else:
        print(f"⚠️ DART API 응답 오류: {data.get('message', 'Unknown error')}")

if __name__ == "__main__":
    run_crawler()