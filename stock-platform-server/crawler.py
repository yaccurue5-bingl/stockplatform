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

# 환경 변수 검증
if not all([DART_KEY, GEMINI_KEY, SUPABASE_URL, SUPABASE_KEY]):
    raise ValueError("❌ 필수 환경 변수가 설정되지 않았습니다.")

# 2. 클라이언트 초기화
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

    print(f"✅ 공시 {len(list_data)}건 발견")

    # 최신 공시 3개 처리
    for idx, row in list_data.head(3).iterrows():
        report_nm = row.get('report_nm', 'Unknown')
        corp_name = row.get('corp_name', 'Unknown')
        rcept_no = row.get('rcept_no', '')
        
        if not rcept_no:
            print(f"⚠️ [{idx+1}] 접수번호 없음 - 건너뜀")
            continue
        
        print(f"🎯 [{idx+1}/3] AI 분석 시도: {report_nm[:50]}...")
        
        try:
            # 공시 내용 가져오기
            content = dart.document(rcept_no)
            
            if not content:
                print(f"   ⚠️ 공시 내용 없음 - 건너뜀")
                continue
            
            # 프롬프트 생성
            prompt = f"다음 공시 내용을 요약해줘: {report_nm}\n내용: {content[:3000]}"
            
            # 여러 모델 이름 시도 (404 에러 방지)
            model_names = [
                "gemini-1.5-flash-latest",
                "gemini-1.5-flash", 
                "models/gemini-1.5-flash-latest",
                "gemini-1.5-pro-latest",
                "gemini-pro"
            ]
            
            ai_response = None
            success_model = None
            
            for model_name in model_names:
                try:
                    print(f"   🔄 모델 시도: {model_name}")
                    ai_response = client.models.generate_content(
                        model=model_name,
                        contents=prompt
                    )
                    
                    # 응답 검증
                    if ai_response and hasattr(ai_response, 'text') and ai_response.text:
                        success_model = model_name
                        print(f"   ✅ 성공: {model_name}")
                        break
                    else:
                        print(f"   ⚠️ 응답 없음: {model_name}")
                        
                except Exception as model_error:
                    print(f"   ❌ 실패: {model_name} - {str(model_error)[:100]}")
                    continue
            
            # AI 응답 처리 및 저장
            if ai_response and hasattr(ai_response, 'text') and ai_response.text:
                summary_text = ai_response.text
                
                data = {
                    "corp_name": corp_name,
                    "report_nm": report_nm,
                    "ai_summary": summary_text,
                    "rcept_no": rcept_no,
                    "created_at": datetime.datetime.now().isoformat()
                }
                
                result = supabase.table("disclosure_insights").upsert(data).execute()
                
                if result.data:
                    print(f"   💾 저장 완료! (모델: {success_model})")
                else:
                    print(f"   ⚠️ DB 저장 실패 (응답 없음)")
            else:
                print(f"   ❌ 모든 모델 시도 실패 - AI 요약 생성 불가")
                
        except Exception as e:
            print(f"   ❌ 처리 중 오류: {e}")
            continue

    print("🎉 크롤링 완료!")

if __name__ == "__main__":
    try:
        analyze_disclosure()
    except Exception as e:
        print(f"❌ 치명적 오류: {e}")
        import traceback
        traceback.print_exc()
        raise