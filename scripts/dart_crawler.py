import os
import requests
from datetime import datetime
from supabase import create_client, Client
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 설정 (환경변수)
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
        for item in data.get("list", []):
            # ✅ AI 분석은 auto_analyst.py에서 담당하도록 여기서는 제거
            # ✅ 공시 원본 데이터만 저장 (ai_summary는 NULL로 유지)
            payload = {
                "corp_name": item.get("corp_name"),
                "stock_code": item.get("stock_code"),
                "report_nm": item.get("report_nm"),
                "rcept_no": item.get("rcept_no"),
                "created_at": datetime.now().isoformat()
                # ai_summary, sentiment, sentiment_score, importance는 auto_analyst.py가 채움
            }
            
            # rcept_no 기준으로 중복 방지(upsert)
            try:
                supabase.table("disclosure_insights").upsert(payload, on_conflict="rcept_no").execute()
                print(f"✅ {item.get('corp_name')} - {item.get('report_nm')[:30]}... 저장 완료")
            except Exception as e:
                print(f"❌ DB 저장 실패: {e}")
                
        print(f"🎉 총 {len(data.get('list'))}건 수집 완료 → auto_analyst.py가 곧 분석을 시작합니다")
    else:
        print(f"⚠️ DART API 응답 오류: {data.get('message', 'Unknown error')}")

if __name__ == "__main__":
    run_crawler()