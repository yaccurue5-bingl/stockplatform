import os
import OpenDartReader
import google.generativeai as genai

# 1. 설정 (인증키 가져오기)
DART_KEY = os.environ.get("DART_API_KEY")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")

# AI 설정
genai.configure(api_key=GEMINI_KEY)
model = genai.GenerativeModel('gemini-1.5-flash') # 빠르고 저렴한 모델

dart = OpenDartReader(DART_KEY)

def analyze_disclosure():
    # 오늘자 코스피 상장사 공시 목록 가져오기
    # (테스트를 위해 시작일을 최근으로 설정해봐)
    list_data = dart.list(start='2023-12-15', kind='A') 
    
    # 우리가 주목할 '유료급' 키워드
    target_keywords = ["주식소각", "유형자산", "최대주주", "배당", "공급계약"]

    for _, row in list_data.iterrows():
        report_nm = row['report_nm']
        corp_name = row['corp_name']
        rcept_no = row['rcept_no']

        # 키워드가 포함된 중요한 공시인가?
        if any(k in report_nm for k in target_keywords):
            print(f"🔍 분석 중: {corp_name} - {report_nm}")
            
            # 공시 본문 텍스트 가져오기
            try:
                content = dart.document(rcept_no)
                # AI에게 전달할 프롬프트 (외국인 타겟이므로 영문 요약 포함 요청)
                prompt = f"""
                아래 한국 기업의 공시 내용을 읽고, 외국인 투자자를 위한 핵심 요약을 작성해줘.
                1. 한 문장의 국문 요약
                2. 한 문장의 영문 요약 (Key Takeaway)
                3. 투자 중요도 (High/Medium/Low)
                
                공시 제목: {report_nm}
                공시 본문: {content[:5000]} # 너무 길면 잘라서 전달
                """
                
                response = model.generate_content(prompt)
                ai_summary = response.text
                
                print(f"🤖 AI 분석 결과:\n{ai_summary}")
                print("-" * 50)
                
                # TODO: 여기서 ai_summary를 Supabase에 저장하면 끝!
                
            except Exception as e:
                print(f"분석 실패 ({corp_name}): {e}")

if __name__ == "__main__":
    analyze_disclosure()