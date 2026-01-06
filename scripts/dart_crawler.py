import os
import requests
from datetime import datetime
from supabase import create_client, Client
from groq import Groq
import urllib3

# SSL 핸드쉐이크 에러 방지
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 환경 변수 및 클라이언트 설정
SUPABASE_URL = "https://rxcwqsolfrjhomeusyza.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
DART_API_KEY = os.environ.get("DART_API_KEY")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
groq_client = Groq(api_key=GROQ_API_KEY)

def analyze_with_groq(report_nm):
    """기존 index.ts의 AI 분석 로직을 대체"""
    try:
        completion = groq_client.chat.completions.create(
            model="mixtral-8x7b-32768",
            messages=[
                {"role": "system", "content": "공시 제목을 분석하여 중요도와 요약을 제공해줘."},
                {"role": "user", "content": f"공시 제목: {report_nm}"}
            ]
        )
        return completion.choices[0].message.content
    except:
        return "AI 분석 실패"

def run_crawler():
    today = datetime.now().strftime('%Y%m%d')
    url = f"https://opendart.fss.or.kr/api/list.json?crtfc_key={DART_API_KEY}&bgnde={today}&endde={today}&page_count=100"

    print(f"📡 DART 수집 시작: {today}")
    # verify=False로 Handshake 에러 해결
    response = requests.get(url, verify=False)
    data = response.json()

    if data.get("status") == "000":
        for item in data.get("list", []):
            # AI 분석 수행 (기존 로직 유지)
            ai_insight = analyze_with_groq(item.get("report_nm"))
            
            payload = {
                "corp_name": item.get("corp_name"),
                "stock_code": item.get("stock_code"),
                "report_nm": item.get("report_nm"),
                "rcept_no": item.get("rcept_no"),
                "ai_summary": ai_insight, # 분석 결과 저장
                "updated_at": datetime.now().isoformat()
            }
            # 중복 방지 저장
            supabase.table("companies").upsert(payload, on_conflict="rcept_no").execute()
        print(f"✅ {len(data.get('list', []))}건 처리 완료")

if __name__ == "__main__":
    run_crawler()