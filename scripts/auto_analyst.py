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

# ── Groq 분석 불필요 공시 유형 (100% no-signal, 비용 절감) ────────────────────
# 4월 실증 분석 기준: 태그 발생률 0~0.5%, Groq 분석 시 signal 없음이 확정적
# 소급 보고 / ELS·DLS 계열: 희석 이벤트 분석에서 avg_ret 왜곡 원인으로 확인
_SKIP_EXACT: frozenset[str] = frozenset({
    # ① 지분/의결권 변동 — 정형화된 신고, signal 없음
    "주식등의대량보유상황보고서(일반)",
    "주식등의대량보유상황보고서(약식)",
    "임원ㆍ주요주주특정증권등소유상황보고서",
    "최대주주등소유주식변동신고서",
    "소속부변경",
    "주주명부폐쇄기간또는기준일설정",
    "주권매매거래정지(주식의 병합, 분할 등 전자등록 변경, 말소)",
    "[기재정정]주식매수선택권부여에관한신고",
    "결산실적공시예고(안내공시)",
    "주주총회소집결의(임시주주총회)",
    "주주총회소집결의",
    "타인에대한채무보증결정",
    "전환청구권행사",
    "자기주식처분결과보고서",
    # ② ELS/DLS 파생결합 — 주식 희석 아님
    "일괄신고추가서류(파생결합사채-주가연계파생결합사채)",
    "일괄신고추가서류(파생결합증권-주가연계증권)",
    "일괄신고추가서류",
})

# prefix 패턴: TRIM 후 startswith 확인 (변형 이름 다수 존재)
_SKIP_PREFIXES: tuple[str, ...] = (
    # ③ 소급 보고 — 발행 결과 공시 (이미 주가 반응 완료, signal 없음)
    "증권발행결과",
    "[기재정정]증권발행결과",
    # ④ ELS/DLS 기타 파생결합 변형
    "일괄신고추가서류(기타파생결합사채)",
    "[기재정정]일괄신고추가서류(기타파생결합사채)",
    "일괄신고서(기타파생결합사채)",
    "[기재정정]일괄신고서(기타파생결합사채)",
    # ⑤ 채무증권 발행조건확정 — 소급성 강함, 주식 희석 없음
    "[발행조건확정]증권신고서(채무증권)",
)


def _should_skip_report(report_nm: str) -> bool:
    """report_nm이 Groq 분석 불필요 공시인지 판단."""
    nm = report_nm.strip()
    if nm in _SKIP_EXACT:
        return True
    return any(nm.startswith(p) for p in _SKIP_PREFIXES)


# 하위호환: 기존 코드가 SKIP_REPORT_NM_TYPES 를 참조하는 경우를 위한 alias
SKIP_REPORT_NM_TYPES = _SKIP_EXACT

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
        tag = compute_signal_tag(
            bs, lps,
            event_type=event_type,
            sentiment_score=sentiment_score,
        )

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
     * '임원의변동' -> 'Executive Personnel Change'
     * '대표이사의변동' -> 'CEO / Representative Director Change'
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
  "event_type": "EARNINGS | CONTRACT | DILUTION | BUYBACK | MNA | LEGAL | CAPEX | EXECUTIVE_CHANGE | OTHER",
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
- LEGAL             : 소송, 규제 조치, 과징금, 수사
- CAPEX             : 설비투자, 공장 신증설, R&D 투자
- EXECUTIVE_CHANGE  : 대표이사·CEO·C-Level(CFO/COO/CTO 등) 선임·취임·사임·해임
                      (사외이사·감사만의 변동은 이 공시가 도달하지 않음)
- OTHER             : 위 어느 항목에도 해당하지 않는 공시

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
- Specify total investment amount and timeline.
- State whether this is capacity expansion (증설), new facility (공장 신설), or line addition (라인 증설).
- Positive signals (투자 확대, 증설, capacity increase): assess demand growth potential and return on investment.
- Negative signals (투자 연기, 축소, 취소): flag as bearish — indicates demand weakness or cash constraint.
- Calculate investment as % of recent annual revenue or total assets if available.
- Note funding source: internal cash vs external financing.
""",
            "EXECUTIVE_CHANGE": """
Classify EACH executive mentioned along three axes and compute a composite signal:

ROLE WEIGHT  : CEO/대표이사/사장 = 1.0 | CFO/COO/CTO/부사장/전무/상무 = 0.6 | Other = 0.2
ACTION WEIGHT: appoint/취임/선임/임명 = +1 | resign/사임/해임/퇴임 = -1 | reappoint/재선임 = 0
ORIGIN WEIGHT: external/외부영입/타사출신 = +1.2 | internal/내부승진 = +0.3 | unknown = 0

composite_score = role_weight × action_weight × origin_weight
If action=resign AND origin=unknown → apply additional penalty (-1.5)

sentiment_score guidance:
- External CEO appointment (영입)  : +0.5 ~ +0.8
- Internal CEO promotion           : +0.2 ~ +0.4
- Sudden CEO resignation           : -0.5 ~ -0.8
- C-Level reshuffle (routine)      : -0.1 ~ +0.2

In ai_summary:
- State the role, action, and origin explicitly
- Flag if the departure is sudden/unexplained
- Note if this signals strategic pivot (new external CEO = bullish signal)
"""
        }

    # ✅ 공시 유형 힌트 분류 (복수 매칭 허용 — Groq에 분석 지침 제공용)
    def classify_disclosure(self, title: str) -> list[str]:
        """
        title 키워드 기반으로 분석 지침(type_rule)에 사용할 유형 힌트 반환.
        복수 매칭 가능 (e.g. "유상증자 + 합병" → [DILUTION, MNA]).
        최종 event_type 결정은 Groq가 content 기반으로 수행.
        """
        t = title.lower()
        matched: list[str] = []

        if "전환사채" in t or "bw" in t or "cb" in t or "유상증자" in t:
            matched.append("DILUTION")
        if "단일판매" in t or "공급계약" in t or "수주" in t or "mou" in t:
            matched.append("CONTRACT")
        if "자기주식" in t:
            matched.append("BUYBACK")
        if "합병" in t or "인수" in t or "분할" in t or ("지분" in t and "취득" in t):
            matched.append("MNA")
        if "소송" in t or "횡령" in t or "배임" in t or "과징금" in t or "수사" in t:
            matched.append("LEGAL")
        if "분기" in t or "사업보고서" in t or "잠정" in t or "실적" in t or "결산" in t:
            matched.append("EARNINGS")
        if "임원의변동" in t or "대표이사의변동" in t:
            matched.append("EXECUTIVE_CHANGE")
        if any(kw in title for kw in [
            "시설투자", "설비투자", "CAPEX", "투자 결정", "신규 투자",
            "증설", "공장 신설", "라인 증설",
        ]):
            matched.append("CAPEX")

        return matched if matched else ["OTHER"]

    # ✅ 프롬프트 생성
    def build_prompt(self, corp_name, report_nm, content):
        # 복수 유형 힌트 → 해당 분석 규칙 모두 포함 (content 기반 최종 분류는 Groq 담당)
        hint_types = self.classify_disclosure(report_nm)
        type_rules_text = ""
        for ht in hint_types:
            rule = self.type_rules.get(ht, "")
            if rule:
                type_rules_text += f"\n[Analysis guidance for potential {ht}]:{rule}"

        is_empty = not content or str(content).strip() == ""
        is_not_available = str(content) == "CONTENT_NOT_AVAILABLE"

        if is_empty or is_not_available:
            input_text = f"Title: {report_nm}\n(Note: Content not available. Analyze based on title.)"
        else:
            clean_content = str(content).replace('\x00', '').replace('\u0000', '')
            input_text = f"Title: {report_nm}\n\nContent:\n{clean_content}"

        # event_type은 반드시 content 내용 기준으로 판단 (title 키워드에 종속 금지)
        type_hint_note = (
            f"\nTITLE-BASED HINT (for reference only): {', '.join(hint_types)}. "
            "IMPORTANT: set event_type based on the PRIMARY theme of the CONTENT, not the title."
        ) if hint_types != ["OTHER"] else ""

        final_system_prompt = self.core_prompt + type_rules_text + type_hint_note

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


def run(backfill: bool = False, limit: int = 200,
        date_from: str = None, date_to: str = None):
    """
    backfill=True  : 이미 completed 이지만 sentiment_score 가 없는 항목 재분석
                     (기존 DB 백테스트용)
    backfill=False : 기본 모드 - analysis_status='pending' 항목만 처리
    date_from/date_to : 'YYYYMMDD' 형식, 지정 시 rcept_dt 범위 필터
    """
    analyst = AIAnalyst()

    range_label = ""
    if date_from or date_to:
        range_label = f" [{date_from or '...'} ~ {date_to or '...'}]"

    if backfill:
        logger.info(f"🔁 [BACKFILL]{range_label} sentiment_score 없는 completed 항목 재분석 시작")
        q = supabase.table("disclosure_insights") \
            .select("id, corp_name, stock_code, rcept_dt, report_nm, content, rcept_no, analysis_retry_count") \
            .eq("analysis_status", "completed") \
            .is_("sentiment_score", "null") \
            .not_.is_("content", "null")
        if date_from:
            q = q.gte("rcept_dt", date_from)
        if date_to:
            q = q.lte("rcept_dt", date_to)
        res = q.order("rcept_dt", desc=True).limit(limit).execute()
    else:
        logger.info(f"🔍 [분석]{range_label} pending 항목 처리 시작 (limit={limit})")
        q = supabase.table("disclosure_insights") \
            .select("id, corp_name, stock_code, rcept_dt, report_nm, content, rcept_no, analysis_retry_count") \
            .eq("analysis_status", "pending") \
            .or_("analysis_retry_count.is.null,analysis_retry_count.lt.3")
        if date_from:
            q = q.gte("rcept_dt", date_from)
        if date_to:
            q = q.lte("rcept_dt", date_to)
        res = q.order("rcept_dt", desc=True).limit(limit).execute()

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

        # ── no-signal 확정 공시 유형 → Groq 호출 없이 skipped 처리 (비용 절감)
        item_report_nm = (item.get('report_nm') or '').strip()
        if _should_skip_report(item_report_nm):
            supabase.table("disclosure_insights").update({
                "analysis_status": "skipped",
                "updated_at": "now()",
            }).eq("id", item['id']).execute()
            logger.debug(f"  ⏭️  skipped (no-signal type): {item_report_nm}")
            continue

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

        time.sleep(1.0)

    processed = len(res.data)
    logger.info(f"{'[BACKFILL] ' if backfill else ''}처리 완료: {processed}건")
    return processed


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--backfill", action="store_true",
                        help="sentiment_score 없는 completed 항목 재분석 (백테스트용)")
    parser.add_argument("--limit", type=int, default=200,
                        help="배치당 처리 건수 (기본 200)")
    parser.add_argument("--from", dest="date_from", type=str, default=None,
                        help="시작 날짜 YYYYMMDD (예: 20260401)")
    parser.add_argument("--to",   dest="date_to",   type=str, default=None,
                        help="종료 날짜 YYYYMMDD (예: 20260428)")
    args = parser.parse_args()

    total = 0
    batch  = 1
    while True:
        logger.info(f"━━━ Batch #{batch} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        processed = run(
            backfill=args.backfill,
            limit=args.limit,
            date_from=args.date_from,
            date_to=args.date_to,
        )
        total += processed
        if processed == 0:
            break
        logger.info(f"[Batch #{batch}] 완료 {processed}건  /  누적 {total}건")
        batch += 1

    logger.info(f"✅ 전체 완료 — 총 처리: {total}건")
