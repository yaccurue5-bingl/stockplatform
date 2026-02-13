import os
import json
import logging
import time
from datetime import datetime
from groq import Groq
from supabase import create_client, Client
from dotenv import load_dotenv

# 로깅 설정
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# 환경 변수 로드
local_env_path = r"C:\stockplatform\.env.local"
if os.path.exists(local_env_path):
    load_dotenv(local_env_path)
else:
    load_dotenv()

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
groq_client = Groq(api_key=GROQ_API_KEY)


class AIAnalyst:

    def __init__(self):

        # ✅ Core Prompt (공통 규칙)
        self.core_prompt = """
You are a professional Korean stock disclosure analyst. 
Respond in Korean. Accuracy and numeric data are your top priorities.

STRICT RULES:
1. DATA HUNTER: Extract at least 3 numeric data points (KRW, %, Date, Ratio).
2. [key_numbers] SECTION RULE: 
   - This field MUST NOT be empty. 
   - Format: "• [Item Name]: [Value][Unit] (Comparison)"
   - If NO numbers in content, write "• 본문 내 주요 수치 미기재 (제목 기반 분석)"
3. **TOKEN EFFICIENCY**: 
   - Keep "ai_summary" under 300 Korean characters.
   - Focus only on core financial impacts. Do not repeat the title.
4. Distinguish between ONE_TIME and STRUCTURAL events.
5. Respond ONLY in valid JSON format.

Return JSON format:
{
  "headline": "핵심 요약 (30자 이내)",
  "key_numbers": [
    "• 핵심수치 1 (단위 포함)",
    "• 핵심수치 2 (단위 포함)",
    "• 핵심수치 3 (단위 포함)"
  ],
  "event_type": "ONE_TIME or STRUCTURAL or NEUTRAL",
  "financial_impact": "POSITIVE or NEGATIVE or NEUTRAL",
  "short_term_impact_score": 1-5,
  "ai_summary": "수치 중심의 300자 이내 투자 분석 (ai_summary 컬럼용)",
  "risk_factors": "핵심 리스크 요소"
}
"""

        # ✅ 유형별 추가 규칙
        self.type_rules = {
            "EARNINGS": """
Additional Rules for EARNINGS:
- 반드시 YoY 및 QoQ 증감률 포함
- 영업이익과 순이익을 분리 분석
- 일회성 요인 여부 판단
- 부채비율 또는 현금흐름 변화 강조
""",
            "CONTRACT": """
Additional Rules for CONTRACT:
- 계약 금액이 최근 매출 대비 몇 %인지 계산
- 계약 기간 명시
- 신규/반복 계약 구분
- 실적 반영 시점 언급
""",
            "DILUTION": """
Additional Rules for DILUTION:
- 발행 주식 수 및 전환가 포함
- 최대 희석률 추정
- 기존 주주 가치 희석 여부 분석
- 자금 사용 목적 명확히 구분
""",
            "BUYBACK": """
Additional Rules for BUYBACK:
- 취득 금액 및 기간 명시
- 유통주식수 대비 비율 계산
- 소각 여부 구분
- 단기 수급 영향 분석
""",
            "MNA": """
Additional Rules for MNA:
- 인수/합병 금액 명시
- 자기자본 대비 비율 계산
- 지배구조 변화 여부 분석
- 재무 부담 여부 판단
""",
            "LEGAL": """
Additional Rules for LEGAL:
- 소송/제재 금액 명시
- 자본 대비 영향 분석
- 충당금 설정 가능성 판단
- 평판 리스크 언급
""",
            "CAPEX": """
Additional Rules for CAPEX:
- 투자 금액 명시
- 최근 매출 대비 비율 계산
- 회수 기간 가능성 언급
- 단기 재무 부담 여부 분석
"""
        }

    # ✅ 공시 유형 자동 분류
    def classify_disclosure(self, title: str) -> str:
        title = title.lower()

        if "분기" in title or "사업보고서" in title or "잠정" in title:
            return "EARNINGS"
        elif "단일판매" in title or "공급계약" in title:
            return "CONTRACT"
        elif "전환사채" in title or "bw" in title or "유상증자" in title:
            return "DILUTION"
        elif "자기주식" in title:
            return "BUYBACK"
        elif "합병" in title or "분할" in title or "지분" in title:
            return "MNA"
        elif "소송" in title or "횡령" in title or "배임" in title:
            return "LEGAL"
        elif "신규시설" in title or "투자" in title:
            return "CAPEX"
        else:
            return "OTHER"

    # ✅ 프롬프트 생성
    def build_prompt(self, corp_name, report_nm, content):

        disclosure_type = self.classify_disclosure(report_nm)
        type_rule = self.type_rules.get(disclosure_type, "")

        is_empty = not content or str(content).strip() == ""
        is_not_available = str(content) == "CONTENT_NOT_AVAILABLE"

        if is_empty or is_not_available:
            input_text = f"Title: {report_nm}\n(Note: Content not available. Analyze based on title.)"
        else:
            clean_content = str(content).replace('\x00', '').replace('\u0000', '')
            input_text = f"Title: {report_nm}\n\nContent:\n{clean_content}"

        final_system_prompt = self.core_prompt + "\n" + type_rule

        return final_system_prompt, f"Company: {corp_name}\n\n{input_text}"

    # ✅ 분석 실행
    def analyze_content(self, corp_name, report_nm, content):
        try:
            system_prompt, user_prompt = self.build_prompt(corp_name, report_nm, content)

            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
                max_completion_tokens=1200
            )

            return json.loads(response.choices[0].message.content)

        except Exception as e:
            logger.error(f"❌ [{corp_name}] 분석 에러: {e}")
            return None


def run():
    analyst = AIAnalyst()

    res = supabase.table("disclosure_insights") \
        .select("id, corp_name, report_nm, content, rcept_no, analysis_retry_count") \
        .eq("analysis_status", "pending") \
        .or_("analysis_retry_count.is.null,analysis_retry_count.lt.3") \
        .order("created_at", desc=True) \
        .limit(50) \
        .execute()

    if not res.data:
        logger.info("✅ 분석할 데이터가 없습니다.")
        return

    for item in res.data:

        supabase.table("disclosure_insights").update({
            "analysis_status": "processing"
        }).eq("id", item['id']).execute()

        result = analyst.analyze_content(
            item['corp_name'],
            item['report_nm'],
            item.get('content')
        )

        if result:
            update_data = {
                "headline": result.get("headline"),
                "key_numbers": result.get("key_numbers"),
                "event_type": result.get("event_type"),
                "financial_impact": result.get("financial_impact"),
                "short_term_impact_score": result.get("short_term_impact_score"),
                "ai_summary": result.get("analysis"),
                "risk_factors": result.get("risk_factors"),
                "analysis_status": "completed",
                "updated_at": datetime.now().isoformat()
            }

            supabase.table("disclosure_insights") \
                .update(update_data) \
                .eq("id", item['id']) \
                .execute()

            logger.info(f"✅ 완료: {item['corp_name']}")

        else:
            retry_count = (item.get('analysis_retry_count') or 0) + 1
            new_status = "failed" if retry_count >= 3 else "pending"

            supabase.table("disclosure_insights").update({
                "analysis_status": new_status,
                "analysis_retry_count": retry_count,
                "updated_at": datetime.now().isoformat()
            }).eq("id", item['id']).execute()

            logger.warning(f"⚠️ 실패: {item['corp_name']} (재시도: {retry_count}/3)")

        time.sleep(3.0) 


if __name__ == "__main__":
    run()
