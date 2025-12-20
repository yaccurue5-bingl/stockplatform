import os
import datetime
import OpenDartReader
from google import genai
from supabase import create_client

# 1. 환경 변수 및 클라이언트 설정
DART_KEY = os.environ.get("DART_API_KEY")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

client = genai.Client(api_key=GEMINI_KEY)
dart = OpenDartReader(DART_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def analyze_disclosure():
    # 삼성전자 테스트: 최근 90일 공시 수집
    end_date = datetime.datetime.now().strftime('%Y%m%d')
    start_date = (datetime.datetime.now() - datetime.timedelta(days=90)).strftime('%Y%m%d')
    
    print(f"🚀 [삼성전자 테스트] {start_date} ~ {end_date} 기간 수집 시작")
    
    try:
        # 005930 = 삼성전자
        list_data = dart.list(corp='005930', start=start_date, end=end_date) 
    except Exception as e:
        print(f"❌ DART 수집 오류: {e}")
        return

    if list_data is None or len(list_data) == 0:
        print("ℹ️ 해당 기간 공시가 없습니다.")
        return

    print(f"✅ 삼성전자 공시 {len(list_data)}건 발견.")

    # 최신 공시 3개만 샘플링하여 AI 분석
    for _, row in list_data.head(3).iterrows():
        report_nm = row['report_nm']
        corp_name = row['corp_name']
        rcept_no = row['rcept_no']
        
        print(f"🎯 분석 중: {report_nm}")
        
        try:
            content = dart.document(rcept_no)
            prompt = f"Summarize this disclosure for foreign investors in Korean/English: {report_nm} \nContent: {content[:5000]}"
            
            # 최신 google-genai 호출 방식
            response = client.models.generate_content(
                model="gemini-1.5-flash",
                contents=prompt
            )
            
            # 여기서 바로 저장 로직을 실행하여 NameError 방지
            if response and response.text:
                data = {
                    "corp_name": corp_name,
                    "report_nm": report_nm,
                    "ai_summary": response.text,
                    "rcept_no": rcept_no
                }
                supabase.table("disclosure_insights").upsert(data).execute()
                print(f"✅ {corp_name} 저장 완료!")
                
        except Exception as e:
            print(f"⚠️ 개별 공시 처리 오류 (건너뜀): {e}")

# 3. 메인 실행부 (여기에 조건문을 두지 말고 함수만 호출)
if __name__ == "__main__":
    analyze_disclosure()