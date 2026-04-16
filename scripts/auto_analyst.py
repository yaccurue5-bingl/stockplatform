import os
import re
import json
import logging
import time
from datetime import datetime, timedelta
from groq import Groq
from supabase import create_client, Client
from dotenv import load_dotenv

# ── compute_base_score 수식 함수 임포트 (같은 scripts/ 디렉터리) ──────────────
try:
    from compute_base_score import (
        compute_s, compute_i, compute_e,
        compute_base_score as _compute_base_score,
        compute_final_score, compute_signal_tag,
        load_event_stats,
    )
    _SCORE_AVAILABLE = True
except ImportError:
    _SCORE_AVAILABLE = False

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

# ── 스코어 인라인 계산 헬퍼 ───────────────────────────────────────────────────

_event_stats_cache: dict | None = None   # 프로세스당 1회 로드


def _get_event_stats() -> dict:
    """event_stats 테이블을 프로세스 내 1회만 조회해 캐시."""
    global _event_stats_cache
    if _event_stats_cache is None:
        if _SCORE_AVAILABLE:
            _event_stats_cache = load_event_stats(supabase)
            logging.getLogger(__name__).info(
                f"[score] event_stats 로드: {len(_event_stats_cache)}개 이벤트 유형"
            )
        else:
            _event_stats_cache = {}
    return _event_stats_cache


def _fetch_lps(stock_code: str, rcept_dt: str) -> float | None:
    """
    loan_stats 에서 해당 종목·날짜의 LPS 단건 조회.
    당일 데이터가 없으면 최근 5일 이내 최신값 사용.
    """
    try:
        iso = datetime.strptime(str(rcept_dt), "%Y%m%d").date()
    except ValueError:
        return None
    dt_min = str(iso - timedelta(days=5))
    dt_max = str(iso)
    resp = (
        supabase.table("loan_stats")
        .select("lps")
        .eq("stock_code", stock_code)
        .gte("date", dt_min)
        .lte("date", dt_max)
        .not_.is_("lps", "null")
        .order("date", desc=True)
        .limit(1)
        .execute()
    )
    if resp.data:
        return float(resp.data[0]["lps"])
    return None


def _compute_scores_inline(
    item: dict,
    ai_result: dict,
    sentiment_score: float | None,
) -> dict:
    """
    AI 분석 완료 직후 base_score / final_score / signal_tag 를 계산.
    실패 시 빈 dict 반환 → compute_base_score.py Step 6 이 안전망 역할.
    """
    if not _SCORE_AVAILABLE:
        return {}
    try:
        event_type = str(ai_result.get("event_type") or "").upper()
        ev_info    = _get_event_stats().get(event_type, {})

        s   = compute_s(sentiment_score)
        i_  = compute_i(ai_result.get("short_term_impact_score"))
        e   = compute_e(ev_info.get("avg_5d_return"), ev_info.get("sample_size"))
        raw, bs = _compute_base_score(s, i_, e)

        lps = None  # 금융위원회 대차거래 데이터 수집 중단 (2026-04-20 상업용 금지)
        fs  = compute_final_score(bs, lps)
        tag = compute_signal_tag(bs, lps)

        logging.getLogger(__name__).info(
            f"  [score] bs={bs:.1f} fs={fs:.1f} lps={lps} tag={tag or '-'}"
        )
        return {
            "base_score_raw": raw,
            "base_score":     bs,
            "final_score":    fs,
            "signal_tag":     tag,
        }
    except Exception as err:
        logging.getLogger(__name__).warning(
            f"[score] 인라인 계산 실패 ({err}) — compute_base_score.py 안전망이 처리합니다"
        )
        return {}


def validate_numbers(text: str) -> bool:
    """AI 결과에 숫자가 2개 이상 포함되어 있는지 검증"""
    if not text:
        return False
    numbers = re.findall(r'\d+[,\d]*\.?\d*\s*%?', text)
    return len(numbers) >= 2


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

        # DILUTION 최우선 — 희석 이벤트는 가장 강한 시그널
        if "전환사채" in title or "bw" in title or "cb" in title or "유상증자" in title:
            return "DILUTION"
        elif "단일판매" in title or "공급계약" in title:
            return "CONTRACT"
        elif "자기주식" in title:
            return "BUYBACK"
        elif "합병" in title or "분할" in title or "지분" in title:
            return "MNA"
        elif "소송" in title or "횡령" in title or "배임" in title:
            return "LEGAL"
        elif "신규시설" in title or "투자" in title:
            return "CAPEX"
        elif "분기" in title or "사업보고서" in title or "잠정" in title or "실적" in title:
            return "EARNINGS"
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
                max_completion_tokens=2400
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
            .select("id, corp_name, stock_code, rcept_dt, report_nm, content, rcept_no, analysis_retry_count") \
            .eq("analysis_status", "completed") \
            .is_("sentiment_score", "null") \
            .not_.is_("content", "null") \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()
    else:
        res = supabase.table("disclosure_insights") \
            .select("id, corp_name, stock_code, rcept_dt, report_nm, content, rcept_no, analysis_retry_count") \
            .eq("analysis_status", "pending") \
            .or_("analysis_retry_count.is.null,analysis_retry_count.lt.3") \
            .order("created_at", desc=True) \
            .limit(limit) \
            .execute()

    if not res.data:
        logger.info("✅ 분석할 데이터가 없습니다.")
        return 0

    # stock_code → corp_name_en 맵 (일괄 조회)
    stock_codes = list({d['stock_code'] for d in res.data if d.get('stock_code')})
    corp_name_en_map: dict = {}
    if stock_codes:
        try:
            en_res = supabase.table("dart_corp_codes") \
                .select("stock_code, corp_name_en") \
                .in_("stock_code", stock_codes) \
                .execute()
            for row in (en_res.data or []):
                if row.get("corp_name_en"):
                    corp_name_en_map[row["stock_code"]] = row["corp_name_en"]
        except Exception as e:
            logger.warning(f"[corp_name_en] 조회 실패 (무시): {e}")

    for item in res.data:

        supabase.table("disclosure_insights").update({
            "analysis_status": "processing"
        }).eq("id", item['id']).execute()

        # 영문 기업명 우선 사용 → AI가 한국어 번역에 토큰 낭비 방지
        corp_name_for_ai = corp_name_en_map.get(item.get('stock_code', '')) or item['corp_name']

        result = analyst.analyze_content(
            corp_name_for_ai,
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

            # AI 분석 완료 직후 스코어 인라인 계산
            scores = _compute_scores_inline(item, result, sentiment_score)

            # 숫자 검증: ai_summary + key_numbers 합쳐서 판단
            ai_summary_text = result.get("ai_summary") or ""
            key_numbers_text = " ".join(result.get("key_numbers") or [])
            has_numbers = validate_numbers(ai_summary_text + " " + key_numbers_text)
            content_available = item.get("content") and item.get("content") != "CONTENT_NOT_AVAILABLE"
            # 본문이 있는데도 숫자가 없으면 low_quality
            analysis_result_status = "completed" if (has_numbers or not content_available) else "low_quality"
            if analysis_result_status == "low_quality":
                logger.warning(f"  ⚠️ 숫자 부족 → low_quality: {item['corp_name']}")

            update_data = {
                "headline": result.get("headline"),
                "report_nm_en": result.get("report_nm") or None,  # Groq 번역 영문 공시 제목
                "key_numbers": result.get("key_numbers"),
                "event_type": result.get("event_type"),
                "financial_impact": result.get("financial_impact"),
                "short_term_impact_score": result.get("short_term_impact_score"),
                "sentiment_score": sentiment_score,
                "ai_summary": result.get("ai_summary"),
                "risk_factors": result.get("risk_factors"),
                "analysis_status": analysis_result_status,
                "is_visible": bool(item.get("stock_code", "").strip()),
                "updated_at": datetime.now().isoformat(),
                **scores,   # base_score_raw, base_score, final_score, signal_tag
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
