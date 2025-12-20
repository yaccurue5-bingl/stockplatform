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

# 환경 변수 검증
if not all([DART_KEY, GEMINI_KEY, SUPABASE_URL, SUPABASE_KEY]):
    raise ValueError("❌ 필수 환경 변수가 설정되지 않았습니다.")

client = genai.Client(api_key=GEMINI_KEY)
dart = OpenDartReader(DART_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def analyze_disclosure():
    """삼성전자 최근 90일 공시 분석"""
    
    # 날짜 설정
    end_date = datetime.datetime.now().strftime('%Y%m%d')
    start_date = (datetime.datetime.now() - datetime.timedelta(days=90)).strftime('%Y%m%d')
    
    print(f"🚀 [삼성전자 테스트] {start_date} ~ {end_date} 기간 수집 시작")
    
    # DART 공시 수집
    try:
        list_data = dart.list(corp='005930', start=start_date, end=end_date)
    except Exception as e:
        print(f"❌ DART 수집 오류: {e}")
        return

    if list_data is None or len(list_data) == 0:
        print("ℹ️ 해당 기간 공시가 없습니다.")
        return

    print(f"✅ 삼성전자 공시 {len(list_data)}건 발견.")

    # 최신 공시 3개만 처리
    for idx, row in list_data.head(3).iterrows():
        report_nm = row.get('report_nm', 'Unknown')
        corp_name = row.get('corp_name', 'Unknown')
        rcept_no = row.get('rcept_no', '')
        
        if not rcept_no:
            print(f"⚠️ 접수번호 없음 - 건너뜀")
            continue
        
        print(f"🎯 [{idx + 1}/3] 분석 중: {report_nm}")
        
        # AI 요약 초기화
        ai_summary = None
        
        try:
            # 공시 내용 가져오기
            content = dart.document(rcept_no)
            
            if not content:
                print(f"⚠️ 공시 내용 없음 - 건너뜀")
                continue
            
            # AI 요약 생성
            prompt = f"""Summarize this Korean corporate disclosure for foreign investors.
Provide key points in both Korean and English.

Report: {report_nm}
Content: {content[:5000]}"""
            
            response = client.models.generate_content(
                model="gemini-1.5-flash",
                contents=prompt
            )
            
            if response and hasattr(response, 'text') and response.text:
                ai_summary = response.text
            else:
                print(f"⚠️ AI 응답 없음 - 건너뜀")
                continue
                
        except Exception as e:
            print(f"⚠️ AI 분석 오류: {e}")
            continue
        
        # DB 저장
        if ai_summary:
            try:
                data = {
                    "corp_name": corp_name,
                    "report_nm": report_nm,
                    "ai_summary": ai_summary,
                    "rcept_no": rcept_no,
                    "created_at": datetime.datetime.now().isoformat()
                }
                
                result = supabase.table("disclosure_insights").upsert(data).execute()
                
                if result.data:
                    print(f"✅ {corp_name} - {report_nm[:30]}... 저장 완료!")
                else:
                    print(f"⚠️ DB 저장 실패 (응답 없음)")
                    
            except Exception as e:
                print(f"❌ DB 저장 오류: {e}")
        else:
            print(f"⚠️ AI 요약 생성 실패 - 저장 건너뜀")

    print("🎉 크롤링 완료!")

if __name__ == "__main__":
    try:
        analyze_disclosure()
    except Exception as e:
        print(f"❌ 크롤러 실행 중 치명적 오류: {e}")
        raise  # GitHub Actions에서 오류 감지하도록 re-raise