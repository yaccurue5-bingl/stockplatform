import os
import re
import datetime
import time
import requests
import json
from bs4 import BeautifulSoup
from groq import Groq 
import OpenDartReader
from supabase import create_client

# 1. 뉴스 브리핑 프롬프트 템플릿 (보내주신 텍스트 파일 내용 반영)
DISCLOSURE_PROMPT_TEMPLATE = """
# Role
You are a professional financial analyst for Global Investors.

# Task
Analyze the following Korean Public Disclosure and create a structured summary.
Extract facts and rewrite them clearly.

# Input Data
Disclosure Title: {disclosure_title}

# Constraints
1. **Headline**: Create a catchy English headline (under 10 words).
2. **Key Takeaways**: Summarize the 3 most important facts in KOREAN (Bullet points).
3. **Sentiment**: Analyze the tone. Score from -1.0 (Very Negative) to 1.0 (Very Positive).
4. **Impact**: Explain WHY this matters to an investor in 1 sentence (KOREAN).
5. **JSON Format**: Output strictly in JSON format.

# Output Format (JSON)
{{
  "headline": "{disclosure_title}",
  "summary": ["요약1", "요약2", "요약3"],
  "sentiment_score": 0.0,
  "impact_analysis": "투자자 영향 분석 내용",
  "keywords": ["키워드1", "키워드2"]
}}
"""

# 2. AI 분석을 실행할 중요 키워드 정의 (이 키워드가 없으면 AI 호출 안 함)
IMPORTANT_KEYWORDS = [
    '공급계약', '유상증자', '무상증자', '실적발표', '영업실적', '단일판매', 
    '인수', '합병', 'M&A', '특허', '신제품', '최대주주변경', '자기주식취득', '현금배당'
]

# 환경 변수 설정
DART_KEY = os.environ.get("DART_API_KEY")
GROQ_KEY = os.environ.get("GROQ_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# 클라이언트 초기화
client = Groq(
    api_key=os.environ.get("GROQ_API_KEY"), # GitHub Secrets에 저장된 키를 가져옴
)
dart = OpenDartReader(DART_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def get_market_indices():
    print("--- Fetching Market Indices from Naver ---")
    try:
        # KOSPI, KOSDAQ 수집 주소 분리 (더 안정적)
        urls = {
            "KOSPI": "https://finance.naver.com/sise/sise_index.naver?code=KOSPI",
            "KOSDAQ": "https://finance.naver.com/sise/sise_index.naver?code=KOSDAQ",
            "USD/KRW": "https://finance.naver.com/marketindex/"
        }
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        
        results = {}
        for name, url in urls.items():
            res = requests.get(url, headers=headers)
            soup = BeautifulSoup(res.text, 'html.parser')
            
            if name in ["KOSPI", "KOSDAQ"]:
                node = soup.select_one("#now_value")
            else: # 환율
                node = soup.select_one(".value")
            
            if node:
                results[name] = node.get_text(strip=True)

        for name, val in results.items():
            if val:
                supabase.table("market_indices").upsert({"name": name, "current_val": val}, on_conflict="name").execute()
                print(f"✅ {name} 수집 성공: {val}")
    except Exception as e:
        print(f"❌ 지수 수집 에러: {e}")

def analyze_disclosure():
    print("=== K-Market Insight Data Pipeline Start ===")
    
    # 1. 지수 수집 우선 실행 (가장 중요)
    get_market_indices()
    
    # 2. 오늘 날짜의 전체 공시 가져오기
    today = datetime.datetime.now().strftime('%Y%m%d')
    print(f"--- Fetching ALL Disclosures for {today} ---")
    
    try:
        # 특정 기업이 아닌 전체 공시 목록을 가져옴
        df = dart.list(start=today, end=today)
    except Exception as e:
        print(f"❌ DART Fetch Error: {e}")
        return

    if df is None or df.empty:
        print("No disclosures found today.")
        return

    # 3. 데이터 필터링 및 AI 분석
    # 너무 많은 호출을 방지하기 위해 상위 20개 정도만 먼저 체크 (필요시 조정)
    for idx, row in df.head(20).iterrows():
        title = row.get('report_nm', '')
        corp_name = row.get('corp_name', '')
        rcept_no = row.get('rcept_no')

        # [필터링 1] 종목 코드가 없는 공시(비상장 등) 제외
        if not row.get('stock_code'):
            continue

        # [필터링 2] 이미 처리된 공시인지 확인
        check = supabase.table("disclosure_insights").select("id").eq("rcept_no", rcept_no).execute()
        if check.data:
            continue

        # [필터링 3] 중요 키워드가 포함되었는지 확인
        is_important = any(kw in title for kw in IMPORTANT_KEYWORDS)
        
        if is_important:
            print(f"🎯 중요 공시 분석 시작: [{corp_name}] {title}")
            try:
                time.sleep(2) # Groq API 안정성을 위한 짧은 대기
                
                # 프롬프트 구성
                final_prompt = DISCLOSURE_PROMPT_TEMPLATE.format(
                    disclosure_title=title
                )

                # crawler.py 내의 AI 호출 부분 (Groq 또는 OpenAI)
                response = client.chat.completions.create( # 여기서 'client' 이름이 위와 같아야 함
                   model="llama-3.3-70b-versatile",
                   messages=[
            {"role": "system", "content": "You are a professional financial analyst. Return your answer strictly in JSON format."},
            {"role": "user", "content": prompt}
        ],
        response_format={"type": "json_object"},
        max_tokens=1024, # 토큰을 넉넉히 주어 답변이 끊기지 않게 함
        temperature=0.1  # 답변의 일관성을 위해 낮게 설정
    )

                # AI 결과 파싱
                ai_res = json.loads(completion.choices[0].message.content)
                
                # 감성 분석 텍스트 변환
                sentiment_label = "POSITIVE" if ai_res.get('sentiment_score', 0) > 0.1 else \
                                  "NEGATIVE" if ai_res.get('sentiment_score', 0) < -0.1 else "NEUTRAL"

                # DB 저장 데이터
                save_data = {
                    "corp_name": corp_name,
                    "stock_code": row.get('stock_code'),
                    "report_nm": title,
                    "ai_summary": "\n".join(ai_res.get('summary', ["요약 생성 실패"])),
                    "sentiment": sentiment_label,
                    "rcept_no": rcept_no,
                    "created_at": datetime.datetime.now().isoformat()
                }
                
                supabase.table("disclosure_insights").upsert(save_data).execute()
                print(f"✅ AI 분석 및 저장 완료: {corp_name}")

            except Exception as e:
                print(f"❌ AI Analysis Error for {corp_name}: {e}")
        else:
            # 중요하지 않은 공시는 분석 없이 건너뜀 (쿼터 절약)
            print(f"⏩ 일반 공시 패스: {title}")

if __name__ == "__main__":
    analyze_disclosure()