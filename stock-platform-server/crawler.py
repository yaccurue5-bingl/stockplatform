import os
import datetime
from google import genai  # 최신 라이브러리 도입
import OpenDartReader
from supabase import create_client

# 환경 변수
DART_KEY = os.environ.get("DART_API_KEY")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# 클라이언트 초기화
client = genai.Client(api_key=GEMINI_KEY)
dart = OpenDartReader(DART_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def analyze_disclosure():
    """공시 분석 및 저장"""
    print("=== 공시 수집 시작 ===")
    
    end_date = datetime.datetime.now().strftime('%Y%m%d')
    start_date = (datetime.datetime.now() - datetime.timedelta(days=7)).strftime('%Y%m%d')
    
    try:
        # 삼성전자(005930) 공시 목록 가져오기
        list_data = dart.list(corp='005930', start=start_date, end=end_date)
    except Exception as e:
        print(f"❌ DART 오류: {e}")
        return

    # ✅ 판다스 에러 방지용 체크
    if list_data is None or list_data.empty:
        print("ℹ️ 최근 7일간 공시가 없습니다.")
        return

    print(f"✅ {len(list_data)}건 발견\n")

    for idx, row in list_data.head(3).iterrows():
        report_nm = row.get('report_nm', '')
        corp_name = row.get('corp_name', '')
        rcept_no = row.get('rcept_no', '')
        
        print(f"[{idx+1}] {report_nm[:40]}")
        
        try:
            # 공시 원문 추출
            content = dart.document(rcept_no)
            if not content: continue
            
            prompt_text = f"다음 주식 공시 내용을 한국어로 핵심 요약해줘:\n제목: {report_nm}\n내용: {content[:2000]}"
            
            print("  AI 분석 중...")
            # ✅ google-genai 방식 호출 (404 에러 방지)
            response = client.models.generate_content(
                model="gemini-1.5-flash-8b",
                contents=prompt_text
            )
            
            if response and response.text:
                ai_summary = response.text
                data = {
                    "corp_name": corp_name,
                    "report_nm": report_nm,
                    "ai_summary": ai_summary,
                    "rcept_no": rcept_no,
                    "created_at": datetime.datetime.now().isoformat()
                }
                
                # Supabase 저장
                supabase.table("disclosure_insights").upsert(data).execute()
                print("  ✅ 저장 완료")
            else:
                print("  ❌ AI 응답 없음")
                
        except Exception as e:
            print(f"  ❌ 오류 발생: {e}")

    print("\n🎉 모든 작업 완료")

if __name__ == "__main__":
    analyze_disclosure()