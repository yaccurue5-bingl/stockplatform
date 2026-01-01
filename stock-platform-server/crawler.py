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

# 공포 탐욕 지수 계산 파일 임포트
try:
    import fg_index_calc 
except ImportError:
    fg_index_calc = None

# 수정된 프롬프트: 통합 분석 및 구체적 항목(기업명, 금액) 추출 지시
DISCLOSURE_PROMPT_TEMPLATE = """
# Role: Professional Financial Analyst
# Language: Respond ONLY in KOREAN.

# Task
제공된 동일 기업의 여러 공시 데이터들을 분석하여 하나의 통합 요약을 작성하세요.
특히 각 공시 본문에서 '계약 상대방(실제 회사명)'과 '계약 금액'을 반드시 찾아 포함하세요. 
'company'와 같은 모호한 단어 대신 원문에 명시된 실제 이름을 기재해야 합니다.

# Input Data
Company: {corp_name}
Disclosures Data:
{disclosure_details}

# Output Format (JSON)
{{
  "headline": "통합 제목 (영문)",
  "summary": [
    "1. [계약상대방 이름]과 [금액] 규모 공급계약 체결 (상세 내용)",
    "2. [계약상대방 이름]과 [금액] 규모... ",
    "종합 분석: 이번 계약들이 기업 재무에 미치는 영향"
  ],
  "sentiment_score": 0.0,
  "impact_analysis": "투자자 영향 분석 내용"
}}
"""

IMPORTANT_KEYWORDS = ['공급계약', '유상증자', '무상증자', '실적발표', '영업실적', '단일판매', '인수', '합병', 'M&A']

DART_KEY = os.environ.get("DART_API_KEY")
GROQ_KEY = os.environ.get("GROQ_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

client = Groq(api_key=GROQ_KEY)
dart = OpenDartReader(DART_KEY)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_market_indices():
    # (기존 지수 수집 로직 유지)
    pass

def analyze_disclosure():
    print("=== K-Market Insight Data Pipeline Start ===")
    get_market_indices()
    
    today = datetime.datetime.now().strftime('%Y%m%d')
    df = dart.list(start=today, end=today)
    if df is None or df.empty: return

    # 1. 종목별로 공시 그룹화 (비츠로셀 3건 등을 하나로 묶음)
    grouped = {}
    for _, row in df.iterrows():
        code = row.get('stock_code')
        if not code: continue
        if code not in grouped: grouped[code] = []
        grouped[code].append(row)

    for code, rows in grouped.items():
        # 중요 키워드 필터링
        targets = [r for r in rows if any(kw in r['report_nm'] for kw in IMPORTANT_KEYWORDS)]
        if not targets: continue

        corp_name = targets[0]['corp_name']
        rep_rcept_no = targets[0]['rcept_no']

        # 중복 체크
        check = supabase.table("disclosure_insights").select("id").eq("rcept_no", rep_rcept_no).execute()
        if check.data: continue

        print(f"🎯 통합 분석 진행 중: {corp_name} ({len(targets)}건)")
        
        # 2. [핵심 수정] 각 공시의 원문 텍스트를 가져와서 AI에게 전달
        disc_details_text = ""
        for t in targets:
            try:
                # OpenDartReader로 공시 원문 추출
                document = dart.document(t['rcept_no'])
                # HTML 태그 제거 및 텍스트 정리 (상위 2000자 내외)
                clean_text = re.sub('<[^<]+?>', '', document)[:2000]
                disc_details_text += f"\n[공시제목: {t['report_nm']}]\n{clean_text}\n"
            except:
                disc_details_text += f"\n[공시제목: {t['report_nm']}] (원문 추출 실패)\n"

        try:
            # 3. AI 분석 요청
            final_prompt = DISCLOSURE_PROMPT_TEMPLATE.format(
                corp_name=corp_name, 
                disclosure_details=disc_details_text
            )
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "너는 한국 주식 시장 전문 분석가야. JSON 형식으로만 답변해."},
                    {"role": "user", "content": final_prompt}
                ],
                response_format={"type": "json_object"}
            )
            ai_res = json.loads(response.choices[0].message.content)
            
            # 4. DB 저장 (통합된 내용을 ai_summary에 저장)
            # 대표 제목 설정 (외 N건 형식)
            report_title = targets[0]['report_nm']
            if len(targets) > 1:
                report_title += f" 외 {len(targets)-1}건"
            
            supabase.table("disclosure_insights").upsert({
                "corp_name": corp_name, 
                "stock_code": code,
                "report_nm": report_title, 
                "ai_summary": "\n".join(ai_res.get('summary', [])), # 리스트를 줄바꿈으로 합침
                "sentiment": "POSITIVE" if ai_res.get('sentiment_score', 0) > 0.1 else "NEUTRAL",
                "rcept_no": rep_rcept_no,
                "created_at": datetime.datetime.now().isoformat()
            }).execute()
            
        except Exception as e:
            print(f"❌ AI Error for {corp_name}: {e}")

if __name__ == "__main__":
    analyze_disclosure()