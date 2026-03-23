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

You are a professional Global financial analyst specializing in Korean DART disclosures. 
Your task is to provide a numeric-heavy, objective analysis in English.

STRICT RULES:
1. **LANGUAGE**: All output values must be in English. 
   - Convert Korean units: (e.g., "원" -> "KRW", "주" -> "Shares", "억원" -> "100M KRW").
   - Translation examples: "매출액" -> "Revenue", "영업이익" -> "Operating Profit".
2. **UNIVERSAL DATA MINER**: 
   - Scan the entire text to extract all available financial figures (KRW, %, Date, Shares).
   - Priority keywords: [Acquisition/Disposal amount, Dividend(yield), Revenue/Profit variance, Issuance price, Funding size].
   - If the text looks like a broken table, reconstruct the context to find the correct value-unit pair.
3. **[key_numbers] SECTION**: 
   - List at least 3-5 most critical financial figures found in the content.
   - Format: "• [Item Name]: [Value][Unit] (Comparison/Date/Note)"
   - Never leave this empty. If no numbers, use title information.
4. **COMPACT SUMMARY**: 
   - 'ai_summary' must be within 500 characters in English. 
   - Strictly follow: [Context] -> [Key Figures] -> [Investment Opinion/Risk].
   - Eliminate filler phrases like "Content not available".
5. **[report_nm] TRANSLATION GUIDE**:
   - Translate the Korean 'report_nm' into a professional English financial title.
   - Use the following standard terminology for common disclosure types:
     * '주요사항보고서' -> 'Material Fact Report'
     * '기재정정' -> '[Amendment]' (Place at the very beginning)
     * '자기주식처분결정' -> 'Decision on Treasury Stock Disposal'
     * '자기주식취득결정' -> 'Decision on Treasury Stock Acquisition'
     * '유상증자결정' -> 'Decision on Paid-in Capital Increase'
     * '전환사채권발행결정' -> 'Decision on Issuance of Convertible Bonds'
     * '신주인수권부사채권발행결정' -> 'Decision on Issuance of Bonds with Warrants'
     * '현금·현물배당결정' -> 'Decision on Cash and Property Dividend'
     * '주식등의대량보유상황보고서' -> 'Large Shareholding Report'
     * '임원ㆍ주요주주특정증권등소유상황보고서' -> 'Report on Shareholding Status of Executives and Major Shareholders'
     * '사업보고서 / 분기보고서 / 반기보고서' -> 'Annual Report / Quarterly Report / Half-yearly Report'
     * '결산실적공시' -> 'Earnings Release'
   - For other titles, ensure professional financial phrasing (e.g., use 'Acquisition' instead of 'Buying', 'Disposal' instead of 'Selling').

Return JSON format:
{
  "report_nm": "Translate the Korean report_nm into a professional English financial title",
  "headline": "Core summary in English (under 50 chars)",
  "key_numbers": [
    "• Key figure 1 (with unit)",
    "• Key figure 2 (with unit)",
    "• Key figure 3 (with unit)"
  ],
  "event_type": "EARNINGS | CONTRACT | DILUTION | BUYBACK | MNA | LEGAL | CAPEX | OTHER",
  "financial_impact": "POSITIVE or NEGATIVE or NEUTRAL",
  "short_term_impact_score": 1-5,
  "sentiment_score": <float -1.0 to +1.0>,
  "ai_summary": "Numeric-centric investment analysis in English (for ai_summary column)",
  "risk_factors": "Key risk factors in English"
}

EVENT TYPE GUIDE (event_type) — pick exactly one:
- EARNINGS : 실적 발표, 사업/분기/반기 보고서, 결산 공시
- CONTRACT : 수주, 대규모 계약, MOU, 공급계약
- DILUTION : 유상증자, CB(전환사채), BW(신주인수권부사채) 발행
- BUYBACK  : 자기주식 취득 또는 소각 결정
- MNA      : 합병, 인수, 분할, 지분 취득
- LEGAL    : 소송, 규제 조치, 과징금, 수사
- CAPEX    : 설비투자, 공장 신증설, R&D 투자
- OTHER    : 위 어느 항목에도 해당하지 않는 공시

SENTIMENT SCORE GUIDE (sentiment_score):
- A continuous float between -1.0 (strongly bearish) and +1.0 (strongly bullish).
- Reflects the overall investment sentiment of the disclosure, accounting for magnitude, context, and risk.
- Examples:
  • Strong earnings beat, major contract win → +0.7 ~ +1.0
  • Moderate positive (small buyback, minor contract) → +0.2 ~ +0.5
  • Neutral/ambiguous (routine report, restructuring) → -0.1 ~ +0.1
  • Dilution (CB/BW issuance), legal issues → -0.4 ~ -0.7
  • Severe scandal, massive loss, fraud → -0.8 ~ -1.0
- Must be a JSON number (e.g., 0.65, -0.42), NOT a string.
"""

        # ✅ 유형별 분석 규칙 (로직 보존을 위해 영문으로 기술 가이드)
        self.type_rules = {
            "EARNINGS": """
- Must include YoY and QoQ growth rates.
- Separate analysis for Operating Profit and Net Income.
- Identify one-off factors and changes in cash flow or debt ratio.
""",
            "CONTRACT": """
- Calculate the contract value as a % of recent annual revenue.
- Specify the contract duration and recognition period.
- Distinguish between new and recurring contracts.
""",
            "DILUTION": """
- Include number of shares and conversion price.
- Estimate maximum dilution rate.
- Analyze impact on existing shareholder value and purpose of funds.
""",
            "BUYBACK": """
- Specify acquisition amount and period.
- Calculate the ratio against total outstanding shares.
- Note whether shares will be cancelled (retired).
""",
            "MNA": """
- Specify acquisition/merger amount and its ratio to equity.
- Analyze changes in governance structure and potential financial burden.
""",
            "LEGAL": """
- Specify litigation/penalty amounts and impact on capital.
- Assess possibility of loss provisions and reputation risk.
""",
            "CAPEX": """
- Specify investment amount and ratio to recent revenue.
- Mention expected payback period and short-term liquidity impact.
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


def run(backfill: bool = False, limit: int = 50):
    """
    backfill=True  : 이미 completed 이지만 sentiment_score 가 없는 항목 재분석
                     (기존 DB 백테스트용)
    backfill=False : 기본 모드 - analysis_status='pending' 항목만 처리
    """
    analyst = AIAnalyst()

    if backfill:
        # 백필 모드: completed 이지만 sentiment_score 가 null 인 항목
        logger.info("🔁 [BACKFILL] sentiment_score 없는 completed 항목 재분석 시작")
        res = supabase.table("disclosure_insights") \
            .select("id, corp_name, report_nm, content, rcept_no, analysis_retry_count") \
            .eq("analysis_status", "completed") \
            .is_("sentiment_score", "null") \
            .not_.is_("content", "null") \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()
    else:
        res = supabase.table("disclosure_insights") \
            .select("id, corp_name, report_nm, content, rcept_no, analysis_retry_count") \
            .eq("analysis_status", "pending") \
            .or_("analysis_retry_count.is.null,analysis_retry_count.lt.3") \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()

    if not res.data:
        logger.info("✅ 분석할 데이터가 없습니다.")
        return 0

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
            # sentiment_score: float -1.0~+1.0 파싱 (AI가 문자열로 줄 수도 있으므로 방어 처리)
            raw_score = result.get("sentiment_score")
            try:
                sentiment_score = float(raw_score) if raw_score is not None else None
                if sentiment_score is not None:
                    sentiment_score = max(-1.0, min(1.0, sentiment_score))
            except (TypeError, ValueError):
                sentiment_score = None

            update_data = {
                "headline": result.get("headline"),
                "key_numbers": result.get("key_numbers"),
                "event_type": result.get("event_type"),
                "financial_impact": result.get("financial_impact"),
                "short_term_impact_score": result.get("short_term_impact_score"),
                "sentiment_score": sentiment_score,
                "ai_summary": result.get("ai_summary"),
                "risk_factors": result.get("risk_factors"),
                "analysis_status": "completed",
                "is_visible": True,
                "updated_at": datetime.now().isoformat()
            }

            supabase.table("disclosure_insights") \
                .update(update_data) \
                .eq("id", item['id']) \
                .execute()

            logger.info(f"✅ 완료: {item['corp_name']}")

        else:
            if not backfill:
                retry_count = (item.get('analysis_retry_count') or 0) + 1
                new_status = "failed" if retry_count >= 3 else "pending"
                supabase.table("disclosure_insights").update({
                    "analysis_status": new_status,
                    "analysis_retry_count": retry_count,
                    "updated_at": datetime.now().isoformat()
                }).eq("id", item['id']).execute()

            logger.warning(f"⚠️ 실패: {item['corp_name']}")

        time.sleep(3.0)

    processed = len(res.data)
    logger.info(f"{'[BACKFILL] ' if backfill else ''}처리 완료: {processed}건")
    return processed


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--backfill", action="store_true",
                        help="sentiment_score 없는 completed 항목 재분석 (백테스트용)")
    parser.add_argument("--limit", type=int, default=50,
                        help="최대 처리 건수 (기본 50)")
    args = parser.parse_args()
    run(backfill=args.backfill, limit=args.limit)
