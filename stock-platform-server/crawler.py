import os
import datetime
import OpenDartReader
from google import genai
from supabase import create_client

# 1. 환경 변수 로드
DART_KEY = os.environ.get("DART_API_KEY")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# 2. 클라이언트 초기화 (최신 google-genai SDK 사용)
client = genai.Client(api_key=GEMINI_KEY)
dart = OpenDartReader(DART_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def analyze_disclosure():
    # 삼성전자(005930) 테스트를 위해 최근 90일 공시 수집 (DART 제한 준수)
    end_date = datetime.datetime.now().strftime('%Y%m%d')
    start_date = (datetime.datetime.now() - datetime.timedelta(days=90)).strftime('%Y%m%d')
    
    print(f"🚀 [삼성전자 테스트] {start_date} ~ {end_date} 기간 수집 시작")
    
    try:
        list_data = dart.list(corp='005930', start=start_date, end=end_date) 
    except Exception as e:
        print(f"❌ DART 수집 오류: {e}")
        return

    if list_data is None or len(list_data) == 0:
        print("ℹ️ 해당 기간 공시가 없습니다.")
        return

    print(f"✅ 삼성전자 공시 {len(list_data)}건 발견. 분석 시작!")

    # 최신 공시 3개만 테스트로 분석
    for _, row in list_data.head(3).iterrows():
        report_nm = row['report_nm']
        corp_name = row['corp_name']
        rcept_no = row['rcept_no']
        
        print(f"🎯 분석 중: {corp_name} - {report_nm}")
        
        # 루프 내부에서 변수 초기화 (NameError 방지)
        current_ai_summary = ""
        
        try:
            content = dart.document(rcept_no)
            prompt = f"""
            Summarize this Samsung Electronics disclosure for foreign investors:
            1. One sentence Korean summary.
            2. One sentence English summary.
            3. Importance (High/Medium/Low).
            
            Title: {report_nm}
            Content: {content[:5000]}
            """
            
            # 최신 SDK 방식 호출
            response = client.models.generate_content(
                model="gemini-1.5-flash",
                contents=prompt
            )
            current_ai_summary = response.text
            
            if current_ai_summary:
                data = {
                    "corp_name": corp_name,
                    "report_nm": report_nm,
                    "ai_summary": current_ai_summary,
                    "rcept_no": rcept_no
                }
                
                # Supabase 저장
                supabase.table("disclosure_insights").upsert(data).execute()
                print(f"✅ {corp_name} 저장 완료!")
                
        except Exception as e:
            print(f"⚠️ {corp_name} 처리 중 개별 오류 발생 (건너뜀): {e}")

# 메인 실행부에서 함수만 호출 (직접 변수 참조 금지)
if __name__ == "__main__":
    analyze_disclosure()