import os
import datetime
import requests
import OpenDartReader
from supabase import create_client

# 환경 변수
DART_KEY = os.environ.get("DART_API_KEY")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# Gemini REST API 엔드포인트
GEMINI_ENDPOINT = f"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={GEMINI_KEY}"

dart = OpenDartReader(DART_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def test_gemini_api():
    """API 키 상태 확인"""
    print("=== Gemini API 테스트 ===")
    try:
        payload = {
            "contents": [{
                "parts": [{"text": "Hello"}]
            }]
        }
        response = requests.post(GEMINI_ENDPOINT, json=payload, timeout=10)
        
        if response.status_code == 200:
            print("✅ API 정상")
            return True
        else:
            print(f"❌ API 오류: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ 테스트 실패: {e}")
        return False

def call_gemini_api(prompt_text):
    """Gemini API 호출"""
    try:
        payload = {
            "contents": [{
                "parts": [{"text": prompt_text}]
            }]
        }
        
        response = requests.post(GEMINI_ENDPOINT, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            if 'candidates' in data and len(data['candidates']) > 0:
                candidate = data['candidates'][0]
                if 'content' in candidate and 'parts' in candidate['content']:
                    parts = candidate['content']['parts']
                    if len(parts) > 0 and 'text' in parts[0]:
                        return parts[0]['text']
            return None
        else:
            print(f"   API 오류: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"   호출 실패: {e}")
        return None

def analyze_disclosure():
    """공시 분석"""
    
    if not test_gemini_api():
        print("API 테스트 실패")
        return
    
    print("\n=== 공시 수집 ===")
    
    end_date = datetime.datetime.now().strftime('%Y%m%d')
    start_date = (datetime.datetime.now() - datetime.timedelta(days=7)).strftime('%Y%m%d')
    
    print(f"기간: {start_date}~{end_date}")
    
    try:
        list_data = dart.list(corp='005930', start=start_date, end=end_date)
    except Exception as e:
        print(f"DART 오류: {e}")
        return

    # ✅ 수정된 부분
    if list_data is None or list_data.empty:
        print("공시 없음")
        return

    print(f"✅ {len(list_data)}건 발견\n")

    for idx, row in list_data.head(3).iterrows():
        report_nm = row.get('report_nm', '')
        corp_name = row.get('corp_name', '')
        rcept_no = row.get('rcept_no', '')
        
        if not rcept_no:
            continue
        
        print(f"[{idx+1}] {report_nm[:40]}")
        
        try:
            content = dart.document(rcept_no)
            if not content:
                continue
            
            prompt_text = f"요약: {report_nm}\n{content[:2000]}"
            
            print("  AI 분석 중...")
            ai_summary = call_gemini_api(prompt_text)
            
            if ai_summary:
                data = {
                    "corp_name": corp_name,
                    "report_nm": report_nm,
                    "ai_summary": ai_summary,
                    "rcept_no": rcept_no,
                    "created_at": datetime.datetime.now().isoformat()
                }
                
                result = supabase.table("disclosure_insights").upsert(data).execute()
                
                if result.data:
                    print("  ✅ 저장완료")
                else:
                    print("  ⚠️ 저장실패")
            else:
                print("  ❌ AI실패")
                
        except Exception as e:
            print(f"  오류: {e}")

    print("\n🎉 완료")

if __name__ == "__main__":
    analyze_disclosure()