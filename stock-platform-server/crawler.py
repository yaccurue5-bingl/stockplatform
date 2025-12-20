import os
import OpenDartReader
import google.generativeai as genai
from supabase import create_client
import datetime

# 1. 설정 및 인증키 (환경변수)
DART_KEY = os.environ.get("DART_API_KEY")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# AI 설정
genai.configure(api_key=GEMINI_KEY)
model = genai.GenerativeModel('gemini-1.5-flash')

# API 클라이언트 초기화
dart = OpenDartReader(DART_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def analyze_disclosure():
    # 삼성전자 테스트를 위해 검색 기간을 3개월로 설정 (DART 허용 최대치)
    end_date = datetime.datetime.now().strftime('%Y%m%d')
    start_date = (datetime.datetime.now() - datetime.timedelta(days=90)).strftime('%Y%m%d')
    
    print(f"🚀 [삼성전자 테스트] {start_date} ~ {end_date} 기간 공시 수집 시작")
    
    try:
        # corp='삼성전자' 또는 '005930'을 넣으면 해당 기업만 가져와
        list_data = dart.list(corp='005930', start=start_date, end=end_date) 
    except Exception as e:
        print(f"❌ DART 수집 중 오류 발생: {e}")
        return

    if list_data is None or len(list_data) == 0:
        print("ℹ️ 삼성전자의 해당 기간 공시가 없습니다.")
        return

    print(f"✅ 삼성전자 공시 {len(list_data)}건 발견. 분석을 시작할게!")

    # 테스트를 위해 모든 공시를 다 분석하거나, 특정 키워드를 포함한 것만 골라낼 수 있어.
    # 여기서는 모든 공시 중 상위 3개만 테스트로 분석해볼게.
    for _, row in list_data.head(3).iterrows():
        report_nm = row['report_nm']
        corp_name = row['corp_name']
        rcept_no = row['rcept_no']
        
        print(f"🎯 분석 중: {corp_name} - {report_nm}")
        
        ai_summary = "" 
        try:
            content = dart.document(rcept_no)
            prompt = f"""
            Read this Samsung Electronics (South Korea) disclosure and summarize for foreign investors:
            1. One sentence Korean summary.
            2. One sentence English summary (Key Takeaway).
            3. Importance (High/Medium/Low).
            
            Title: {report_nm}
            Content: {content[:5000]}
            """
            
            response = model.generate_content(prompt)
            ai_summary = response.text
            
            # DB 저장
            data = {
                "corp_name": corp_name,
                "report_nm": report_nm,
                "ai_summary": ai_summary,
                "rcept_no": rcept_no
            }
            
            supabase.table("disclosure_insights").upsert(data).execute()
            print(f"✅ {corp_name} 데이터 저장 완료!")
            
        except Exception as e:
            print(f"⚠️ 분석 중 오류 발생: {e}")

if __name__ == "__main__":
    analyze_disclosure()