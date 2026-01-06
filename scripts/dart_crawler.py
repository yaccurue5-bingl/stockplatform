import os
import requests
from datetime import datetime
from supabase import create_client, Client
from groq import Groq
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 설정 (환경변수)
url = "https://rxcwqsolfrjhomeusyza.supabase.co"
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

def analyze_with_groq(report_nm):
    try:
        completion = groq_client.chat.completions.create(
            model="mixtral-8x7b-32768",
            messages=[
                {"role": "system", "content": "주식 전문가로서 공시 제목을 한국어 한 문장으로 요약하고 중요도를 High/Medium/Low 중 하나로 선택해줘."},
                {"role": "user", "content": f"제목: {report_nm}"}
            ]
        )
        return completion.choices[0].message.content
    except:
        return "AI 분석 일시적 오류"

def run_crawler():
    today = datetime.now().strftime('%Y%m%d')
    dart_key = os.environ.get("DART_API_KEY")
    api_url = f"https://opendart.fss.or.kr/api/list.json?crtfc_key={dart_key}&bgnde={today}&endde={today}&page_count=100"

    print(f"📡 DART 데이터 수집 시작: {today}")
    res = requests.get(api_url, verify=False)
    data = res.json()

    if data.get("status") == "000":
        for item in data.get("list", []):
            ai_text = analyze_with_groq(item.get("report_nm"))
            
            # 새 구조인 disclosure_insights 테이블에 저장
            payload = {
                "corp_name": item.get("corp_name"),
                "stock_code": item.get("stock_code"),
                "report_nm": item.get("report_nm"),
                "ai_summary": ai_text,
                "rcept_no": item.get("rcept_no")
            }
            # rcept_no 기준으로 중복 방지(upsert)
            supabase.table("disclosure_insights").upsert(payload, on_conflict="rcept_no").execute()
        print(f"✅ {len(data.get('list'))}건 처리 완료")

if __name__ == "__main__":
    run_crawler()