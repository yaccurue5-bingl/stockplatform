import os
import datetime
import OpenDartReader
from google import genai
from supabase import create_client

DART_KEY = os.environ.get("DART_API_KEY")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

if not all([DART_KEY, GEMINI_KEY, SUPABASE_URL, SUPABASE_KEY]):
    raise ValueError("환경 변수 누락")

client = genai.Client(api_key=GEMINI_KEY)
dart = OpenDartReader(DART_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def analyze_disclosure():
    end_date = datetime.datetime.now().strftime('%Y%m%d')
    start_date = (datetime.datetime.now() - datetime.timedelta(days=7)).strftime('%Y%m%d')
    
    print(f"수집 시작 ({start_date}~{end_date})")
    
    try:
        list_data = dart.list(corp='005930', start=start_date, end=end_date)
    except Exception as e:
        print(f"DART 오류: {e}")
        return

    if list_data is None or len(list_data) == 0:
        print("공시 없음")
        return

    print(f"{len(list_data)}건 발견")

    for idx, row in list_data.head(3).iterrows():
        report_nm = row.get('report_nm', 'Unknown')
        corp_name = row.get('corp_name', 'Unknown')
        rcept_no = row.get('rcept_no', '')
        
        if not rcept_no:
            continue
        
        print(f"[{idx+1}/3] {report_nm[:40]}")
        
        try:
            content = dart.document(rcept_no)
            if not content:
                print("  내용없음")
                continue
            
            # 여기서 prompt 정의
            prompt_text = f"요약: {report_nm}\n{content[:2000]}"
            
            # 여러 모델 시도
            response = None
            models = ["gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-pro"]
            
            for model in models:
                try:
                    print(f"  시도: {model}")
                    # 여기서 prompt_text 사용
                    response = client.models.generate_content(
                        model=model,
                        contents=prompt_text
                    )
                    if response and hasattr(response, 'text') and response.text:
                        print(f"  성공: {model}")
                        break
                except Exception as e:
                    print(f"  실패: {str(e)[:50]}")
                    continue
            
            # response 체크
            if response and hasattr(response, 'text') and response.text:
                supabase.table("disclosure_insights").upsert({
                    "corp_name": corp_name,
                    "report_nm": report_nm,
                    "ai_summary": response.text,
                    "rcept_no": rcept_no
                }).execute()
                print("  저장완료")
            else:
                print("  AI실패")
                
        except Exception as e:
            print(f"  오류: {e}")
            continue

    print("완료")

if __name__ == "__main__":
    try:
        analyze_disclosure()
    except Exception as e:
        print(f"치명적 오류: {e}")
        raise