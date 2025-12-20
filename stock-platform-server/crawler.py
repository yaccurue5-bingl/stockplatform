import os
import datetime
import OpenDartReader
from google import genai
from supabase import create_client

# 1. 환경 변수 설정
DART_KEY = os.environ.get("DART_API_KEY")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# 2. 클라이언트 초기화
# 새로운 SDK는 'models/' 없이 'gemini-1.5-flash'만 써야 404를 피할 수 있어.
client = genai.Client(api_key=GEMINI_KEY)
dart = OpenDartReader(DART_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def analyze_disclosure():
    end_date = datetime.datetime.now().strftime('%Y%m%d')
    start_date = (datetime.datetime.now() - datetime.timedelta(days=7)).strftime('%Y%m%d')
    
    print(f"🚀 삼성전자 공시 수집 시작 ({start_date} ~ {end_date})")
    
    try:
        list_data = dart.list(corp='005930', start=start_date, end=end_date) 
    except Exception as e:
        print(f"❌ DART 수집 오류: {e}")
        return

    if list_data is None or len(list_data) == 0:
        print("ℹ️ 해당 기간 공시가 없습니다.")
        return

    # 최신 공시 1개로 테스트 (성공하면 범위를 늘려봐)
    for _, row in list_data.head(1).iterrows():
        report_nm = row['report_nm']
        corp_name = row['corp_name']
        rcept_no = row['rcept_no']
        
        print(f"🎯 AI 분석 시도 중: {report_nm}")
        
        # response 변수를 미리 None으로 초기화해서 NameError 방지
        ai_response = None 
        
        try:
            content = dart.document(rcept_no)
            prompt = f"다음 공시 내용을 요약해줘: {report_nm} \n내용: {content[:3000]}"
            
            # v1beta 이슈를 피하기 위해 가장 기본 모델명 사용
            ai_response = client.models.generate_content(
                model="gemini-1.5-flash",
                contents=prompt
            )
            
            # 안전하게 데이터 추출
            if ai_response and ai_response.text:
                summary_text = ai_response.text
                data = {
                    "corp_name": corp_name,
                    "report_nm": report_nm,
                    "ai_summary": summary_text,
                    "rcept_no": rcept_no
                }
                supabase.table("disclosure_insights").upsert(data).execute()
                print(f"✅ {corp_name} 저장 완료!")
            else:
                print("⚠️ AI 응답이 비어있습니다.")
                
        except Exception as e:
            # 여기서 에러가 나도 ai_response를 체크하는 다음 코드가 없으므로 NameError 안 남
            print(f"❌ 분석 중 오류 발생: {e}")

if __name__ == "__main__":
    analyze_disclosure()