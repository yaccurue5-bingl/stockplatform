import os
import datetime
import time
from google import genai
import OpenDartReader
from supabase import create_client

# 환경 변수 설정
DART_KEY = os.environ.get("DART_API_KEY")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# 클라이언트 초기화
client = genai.Client(api_key=GEMINI_KEY)
dart = OpenDartReader(DART_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def analyze_disclosure():
    print("=== K-Market Insight Data Pipeline Start ===")
    
    end_date = datetime.datetime.now().strftime('%Y%m%d')
    start_date = (datetime.datetime.now() - datetime.timedelta(days=7)).strftime('%Y%m%d')
    
    # 1. 공시 목록 가져오기 (실제 운영 시 여러 종목 리스트를 순회하도록 확장 가능)
    try:
        list_data = dart.list(start=start_date, end=end_date, pblntf_ty='A') # 정기공시 중심
    except Exception as e:
        print(f"❌ DART Error: {e}")
        return

    if list_data is None or list_data.empty:
        print("ℹ️ No recent filings found.")
        return

    for idx, row in list_data.iterrows():
        report_nm = row.get('report_nm', '')
        corp_name = row.get('corp_name', '')
        stock_code = row.get('stock_code', '')
        rcept_no = row.get('rcept_no', '')
        
        # 429 에러 방지용 딜레이 [cite: 199]
        time.sleep(5) 
        
        try:
            content = dart.document(rcept_no)
            if not content: continue
            
            # AI 프롬프트 최적화: 영문 요약 및 감성 분석 포함 [cite: 192, 235]
            prompt_text = f"""
            Analyze the following Korean stock disclosure for foreign investors:
            Title: {report_nm}
            Content: {content[:3000]}
            
            Provide the output in JSON format:
            1. 'summary': A concise 3-bullet point summary in English.
            2. 'sentiment': One of [POSITIVE, NEGATIVE, NEUTRAL].
            3. 'category': One of [Shareholder Return, CAPEX, Earnings, M&A, Others].
            4. 'importance': One of [High, Medium, Low].
            """
            
            print(f"  AI Analyzing: {corp_name} - {report_nm[:20]}...")
            response = client.models.generate_content(
                model="gemini-2.0-flash", # 최신 안정화 모델 권장
                contents=prompt_text
            )
            
            if response and response.text:
                # 간단한 파싱 로직 (실제 운영 시 json.loads 권장)
                ai_result = response.text 
                
                data = {
                    "corp_name": corp_name,
                    "stock_code": stock_code,
                    "report_nm": report_nm,
                    "ai_summary": ai_result, # JSON 형태의 영문 요약 저장
                    "rcept_no": rcept_no,
                    "sentiment": "NEUTRAL", # 실제 구현 시 AI 결과에서 파싱 필요
                    "category": "Others",
                    "created_at": datetime.datetime.now().isoformat()
                }
                
                supabase.table("disclosure_insights").upsert(data).execute()
                print(f"  ✅ Saved: {corp_name}")
                
        except Exception as e:
            print(f"  ❌ Error: {e}")

    print("\n🎉 Pipeline Completed")

if __name__ == "__main__":
    analyze_disclosure()