import os
import datetime
import OpenDartReader
from google import genai
from supabase import create_client

# 환경 변수 설정
DART_KEY = os.environ.get("DART_API_KEY")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# 환경 변수 검증
if not all([DART_KEY, GEMINI_KEY, SUPABASE_URL, SUPABASE_KEY]):
    raise ValueError("필수 환경 변수가 설정되지 않았습니다.")

# 클라이언트 초기화
client = genai.Client(api_key=GEMINI_KEY)
dart = OpenDartReader(DART_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# 사용 가능한 모델 확인 (테스트용)
def list_available_models():
    """사용 가능한 Gemini 모델 목록 출력"""
    try:
        models = client.models.list()
        print("=== 사용 가능한 모델 목록 ===")
        for model in models:
            print(f"- {model.name}")
        return models
    except Exception as e:
        print(f"모델 목록 조회 실패: {e}")
        return []

def analyze_disclosure():
    """삼성전자 최근 90일 공시 분석"""
    
    # 먼저 사용 가능한 모델 확인 (테스트용 - 나중에 제거)
    list_available_models()
    
    end_date = datetime.datetime.now().strftime('%Y%m%d')
    start_date = (datetime.datetime.now() - datetime.timedelta(days=90)).strftime('%Y%m%d')
    
    print(f"🚀 [삼성전자] {start_date}~{end_date} 수집 시작")
    
    try:
        list_data = dart.list(corp='005930', start=start_date, end=end_date)
    except Exception as e:
        print(f"❌ DART 오류: {e}")
        return

    if list_data is None or len(list_data) == 0:
        print("ℹ️ 공시 없음")
        return

    print(f"✅ {len(list_data)}건 발견")

    # 최신 1개만 테스트
    for idx, row in list_data.head(1).iterrows():
        report_nm = row.get('report_nm', 'Unknown')
        corp_name = row.get('corp_name', 'Unknown')
        rcept_no = row.get('rcept_no', '')
        
        if not rcept_no:
            continue
        
        print(f"🎯 분석 중: {report_nm}")
        
        # 여러 모델 시도 루프를 지우고 아래 코드로 교체해!
try:
    print(f"🎯 AI 분석 시작: gemini-1.5-flash")
    
    # 새로운 SDK에서는 'models/'를 절대 붙이지 말고 아이디만 적어야 해!
    response = client.models.generate_content(
        model="gemini-1.5-flash", 
        contents=prompt
    )
    
    if response and response.text:
        ai_summary = response.text
        print("✅ AI 분석 완료!")
    else:
        print("⚠️ AI 응답이 비어있습니다.")

except Exception as e:
    print(f"❌ AI 분석 실패: {e}")
            
    if response and hasattr(response, 'text') and response.text:
                data = {
                    "corp_name": corp_name,
                    "report_nm": report_nm,
                    "ai_summary": response.text,
                    "rcept_no": rcept_no
                }
                supabase.table("disclosure_insights").upsert(data).execute()
                print(f"✅ 저장 완료")
    else:
                print(f"⚠️ AI 응답 없음")
                
except Exception as e:
            print(f"⚠️ 오류: {e}")

            print("🎉 완료")

if __name__ == "__main__":
    analyze_disclosure()