import os
import datetime
import requests
import OpenDartReader
from supabase import create_client

# 환경 변수

import OpenDartReader
from google import genai
from supabase import create_client


DART_KEY = os.environ.get("DART_API_KEY")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")


# Gemini REST API 엔드포인트
GEMINI_ENDPOINT = f"https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={GEMINI_KEY}"

dart = OpenDartReader(DART_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def test_gemini_api():
    """API 키 상태 확인 (테스트용)"""
    print("=== Gemini API 키 테스트 ===")
    try:
        payload = {
            "contents": [{
                "parts": [{"text": "Hello, test message"}]
            }]
        }
        response = requests.post(GEMINI_ENDPOINT, json=payload, timeout=10)
        
        if response.status_code == 200:
            print("✅ API 엔드포인트 정상 작동")
            return True
        else:
            print(f"❌ API 오류: {response.status_code}")
            print(f"   응답: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"❌ API 테스트 실패: {e}")
        return False

def call_gemini_api(prompt_text):
    """Gemini API 호출 (REST 방식)"""
    try:
        payload = {
            "contents": [{
                "parts": [{"text": prompt_text}]
            }]
        }
        
        response = requests.post(GEMINI_ENDPOINT, json=payload, timeout=30)
        
        if response.status_code == 200:
            data = response.json()
            # 응답 구조: candidates[0].content.parts[0].text
            if 'candidates' in data and len(data['candidates']) > 0:
                candidate = data['candidates'][0]
                if 'content' in candidate and 'parts' in candidate['content']:
                    parts = candidate['content']['parts']
                    if len(parts) > 0 and 'text' in parts[0]:
                        return parts[0]['text']
            
            print(f"   ⚠️ 응답 구조 이상: {data}")
            return None
        else:
            print(f"   ❌ API 오류: {response.status_code}")
            print(f"   응답: {response.text[:200]}")
            return None
            
    except Exception as e:
        print(f"   ❌ API 호출 실패: {e}")
        return None

def analyze_disclosure():
    """삼성전자 최근 7일 공시 분석"""
    
    # 먼저 API 키 테스트
    if not test_gemini_api():
        print("⚠️ API 키 테스트 실패 - 크롤링 중단")
        return
    
    print("\n=== 공시 수집 시작 ===")
    
    end_date = datetime.datetime.now().strftime('%Y%m%d')
    start_date = (datetime.datetime.now() - datetime.timedelta(days=7)).strftime('%Y%m%d')
    
    print(f"기간: {start_date} ~ {end_date}")
    
    try:
        list_data = dart.list(corp='005930', start=start_date, end=end_date)
    except Exception as e:
        print(f"❌ DART 수집 오류: {e}")
        return

    if list_data is None or len(list_data) == 0:
        print("ℹ️ 해당 기간 공시 없음")
        return

    print(f"✅ {len(list_data)}건 발견\n")

    # 최신 3개 처리
    for idx, row in list_data.head(3).iterrows():
        report_nm = row.get('report_nm', 'Unknown')
        corp_name = row.get('corp_name', 'Unknown')
        rcept_no = row.get('rcept_no', '')
        
        if not rcept_no:
            continue
        
        print(f"[{idx+1}/3] {report_nm[:50]}")
        
        try:
            # 공시 내용 가져오기
            content = dart.document(rcept_no)
            if not content:
                print("   ⚠️ 내용 없음")
                continue
            
            # 프롬프트 생성
            prompt_text = f"""다음 한국 기업 공시를 외국인 투자자를 위해 요약해주세요.

공시명: {report_nm}
내용: {content[:2000]}

요약을 한국어와 영어로 각각 제공해주세요."""
            
            # Gemini API 호출
            print("   🤖 AI 분석 중...")
            ai_summary = call_gemini_api(prompt_text)
            
            # 결과 저장
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
                    print("   ✅ 저장 완료")
                else:
                    print("   ⚠️ DB 저장 실패")
            else:
                print("   ❌ AI 분석 실패")
                
        except Exception as e:
            print(f"   ❌ 처리 오류: {e}")
            continue

    print("\n🎉 크롤링 완료!")

if __name__ == "__main__":
    try:
        analyze_disclosure()
    except Exception as e:
        print(f"❌ 치명적 오류: {e}")
        import traceback
        traceback.print_exc()
        raise

client = genai.Client(api_key=GEMINI_KEY)
dart = OpenDartReader(DART_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def run():
    end = datetime.datetime.now().strftime('%Y%m%d')
    start = (datetime.datetime.now() - datetime.timedelta(days=7)).strftime('%Y%m%d')
    print(f"Start: {start}~{end}")
    data = dart.list(corp='005930', start=start, end=end)
    if not data or len(data) == 0:
        print("No data")
        return
    for i, r in data.head(1).iterrows():
        nm = r.get('report_nm', '')
        corp = r.get('corp_name', '')
        rcept = r.get('rcept_no', '')
        if not rcept:
            continue
        print(f"Process: {nm}")
        try:
            c = dart.document(rcept)
            if not c:
                continue
            p = f"Summarize: {nm}\n{c[:1000]}"
            res = None
            for m in ["gemini-1.5-flash-latest", "gemini-1.5-flash"]:
                try:
                    res = client.models.generate_content(model=m, contents=p)
                    if res and res.text:
                        break
                except:
                    pass
            if res and res.text:
                supabase.table("disclosure_insights").upsert({
                    "corp_name": corp,
                    "report_nm": nm,
                    "ai_summary": res.text,
                    "rcept_no": rcept
                }).execute()
                print("Saved")
        except Exception as e:
            print(f"Error: {e}")
    print("Done")

if __name__ == "__main__":
    run()

