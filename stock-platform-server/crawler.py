import os
import datetime
import time # 할당량 조절을 위한 시간 지연 추가
from google import genai
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

    # 판다스 에러 방지용 체크
    if list_data is None or list_data.empty:
        print("ℹ️ 최근 7일간 공시가 없습니다.")
        return

    print(f"✅ {len(list_data)}건 발견\n")

    for idx, row in list_data.iterrows(): # 모든 공시 처리 (또는 .head(N) 사용)
        report_nm = row.get('report_nm', '')
        corp_name = row.get('corp_name', '')
        rcept_no = row.get('rcept_no', '')
        
        print(f"[{idx+1}] {report_nm[:40]}")
        
        # 429 RESOURCE_EXHAUSTED 에러 방지를 위한 딜레이 추가
        # 무료 티어 사용 시 요청 간격을 최소 2~5초 이상 두는 것이 안전합니다.
        time.sleep(4) 
        
        try:
            # 공시 원문 추출
            content = dart.document(rcept_no)
            if not content: continue
            
            prompt_text = f"다음 주식 공시 내용을 한국어로 핵심 요약해줘:\n제목: {report_nm}\n내용: {content[:2000]}"
            
            print("  AI 분석 중...")
            # ✅ 최신 모델 gemini-2.5-flash 적용 
            # gemini-1.5-flash 계열은 2025년 9월 29일에 종료되었습니다.
            response = client.models.generate_content(
                model="gemini-2.5-flash",
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
            if "429" in str(e):
                print(f"  ⚠️ 할당량 초과(429). 잠시 중단합니다.")
                break # 할당량이 완전히 바닥나면 루프 중단
            print(f"  ❌ 오류 발생: {e}")

    print("\n🎉 모든 작업 완료")

if __name__ == "__main__":
    analyze_disclosure()