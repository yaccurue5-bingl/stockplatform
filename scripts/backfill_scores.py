"""
scripts/backfill_scores.py
===========================
auto_analyst.py 의 backfill 로직을 분리한 독립 스크립트.

목적:
  - analysis_status = 'completed' 이지만 sentiment_score 가 null 인 항목 재분석
  - 신규 공시가 아닌 "기존 데이터 소급 AI 분석" 전용
  - 장 마감 후(EOD) 또는 백테스트 시 1회성으로 실행

실시간 auto_analyst.py 와의 차이:
  auto_analyst.py  : pending → AI → completed   (장 중 실시간, 신규 공시)
  backfill_scores.py: completed (no sentiment) → AI 재분석  (야간 배치, 소급)

사용법:
  python scripts/backfill_scores.py                  # 기본 100건
  python scripts/backfill_scores.py --limit 500      # 500건 처리
  python scripts/backfill_scores.py --dry-run        # 분석 결과만 출력, DB 저장 안 함
  python scripts/backfill_scores.py --all            # 전체 미처리 (limit 없음)
"""

import os
import sys
import json
import time
import argparse
import logging
from datetime import datetime
from pathlib import Path

try:
    from groq import Groq
except ImportError:
    Groq = None

try:
    from supabase import create_client
except ImportError:
    create_client = None

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from utils.env_loader import load_env
load_env()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("backfill_scores")

# ── 설정 ──────────────────────────────────────────────────────────────────────

DEFAULT_LIMIT   = 100
API_SLEEP_SEC   = 3.0   # Groq rate limit 대비
BATCH_FETCH_SIZE = 200  # Supabase 조회 배치


# ── Groq AI 분석 (auto_analyst 동일 프롬프트) ─────────────────────────────────

SYSTEM_PROMPT = """
You are a professional Global financial analyst specializing in Korean DART disclosures.
Your task is to provide a numeric-heavy, objective analysis in English.

STRICT RULES:
1. **LANGUAGE**: All output values must be in English.
2. **[key_numbers] SECTION**: List at least 3-5 most critical financial figures.
3. **COMPACT SUMMARY**: 'ai_summary' must be within 500 characters in English.
4. **[report_nm] TRANSLATION**: Translate Korean report_nm into professional English.

Return JSON format:
{
  "report_nm": "professional English title",
  "headline": "Core summary (under 50 chars)",
  "key_numbers": ["• Figure 1", "• Figure 2", "• Figure 3"],
  "event_type": "ONE_TIME or STRUCTURAL or NEUTRAL",
  "financial_impact": "POSITIVE or NEGATIVE or NEUTRAL",
  "short_term_impact_score": 1-5,
  "sentiment_score": <float -1.0 to +1.0>,
  "ai_summary": "analysis in English (under 500 chars)",
  "risk_factors": "Key risk factors"
}

SENTIMENT SCORE GUIDE:
- +0.7~+1.0 : Strong earnings beat, major contract
- +0.2~+0.5 : Minor positive
- -0.1~+0.1 : Neutral
- -0.4~-0.7 : CB/BW issuance, legal issues
- -0.8~-1.0 : Fraud, massive loss
Must be a JSON number, NOT a string.
"""


def analyze_one(groq_client, corp_name: str, report_nm: str, content: str) -> dict | None:
    """단일 공시 Groq AI 분석. 실패 시 None 반환."""
    if not content or content == "CONTENT_NOT_AVAILABLE":
        input_text = f"Title: {report_nm}\n(Content not available. Analyze based on title.)"
    else:
        clean = str(content).replace('\x00', '').replace('\u0000', '')[:6000]
        input_text = f"Title: {report_nm}\n\nContent:\n{clean}"

    try:
        resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system",  "content": SYSTEM_PROMPT},
                {"role": "user",    "content": f"Company: {corp_name}\n\n{input_text}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,
            max_completion_tokens=1200,
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as e:
        logger.warning(f"  Groq 오류 [{corp_name}]: {e}")
        return None


def parse_sentiment_score(raw) -> float | None:
    try:
        v = float(raw) if raw is not None else None
        return max(-1.0, min(1.0, v)) if v is not None else None
    except (TypeError, ValueError):
        return None


# ── Supabase ──────────────────────────────────────────────────────────────────

def _get_supabase():
    if create_client is None:
        logger.error("supabase 패키지 미설치: pip install supabase")
        sys.exit(1)
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.error("Supabase 환경변수 누락")
        sys.exit(1)
    return create_client(url, key)


def _get_groq():
    if Groq is None:
        logger.error("groq 패키지 미설치: pip install groq")
        sys.exit(1)
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        logger.error("GROQ_API_KEY 환경변수 누락")
        sys.exit(1)
    return Groq(api_key=key)


def fetch_targets(sb, limit: int | None) -> list[dict]:
    """
    completed 이지만 sentiment_score 가 null 인 항목 조회.
    content 가 있는 항목 우선 (제목만 있는 것도 처리 가능).
    """
    query = (
        sb.table("disclosure_insights")
        .select("id, corp_name, report_nm, content, stock_code, rcept_dt")
        .eq("analysis_status", "completed")
        .is_("sentiment_score", "null")
        .order("rcept_dt", desc=True)
    )
    if limit:
        query = query.limit(limit)
    else:
        query = query.limit(10000)   # 사실상 전체

    resp = query.execute()
    return resp.data or []


def save_one(sb, row_id: str, result: dict, dry_run: bool) -> bool:
    sentiment_score = parse_sentiment_score(result.get("sentiment_score"))

    update = {
        "headline":               result.get("headline"),
        "key_numbers":            result.get("key_numbers"),
        "event_type":             result.get("event_type"),
        "financial_impact":       result.get("financial_impact"),
        "short_term_impact_score": result.get("short_term_impact_score"),
        "sentiment_score":        sentiment_score,
        "ai_summary":             result.get("ai_summary"),
        "risk_factors":           result.get("risk_factors"),
        # analysis_status 는 유지 (completed → completed, 재분석만)
        "updated_at":             datetime.now().isoformat(),
    }

    if dry_run:
        logger.info(f"    [DRY] sentiment={sentiment_score}  event={result.get('event_type')}")
        return True

    try:
        sb.table("disclosure_insights").update(update).eq("id", row_id).execute()
        return True
    except Exception as e:
        logger.error(f"    DB 저장 실패 [{row_id[:8]}...]: {e}")
        return False


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="기존 공시 AI 백필 (sentiment_score 소급 적용)")
    parser.add_argument("--limit",   type=int, default=DEFAULT_LIMIT,
                        help=f"최대 처리 건수 (기본 {DEFAULT_LIMIT}). --all 사용 시 무시")
    parser.add_argument("--all",     action="store_true",
                        help="전체 미처리 항목 모두 처리 (시간 오래 걸림)")
    parser.add_argument("--dry-run", action="store_true",
                        help="분석 결과 출력만, DB 저장 안 함")
    args = parser.parse_args()

    limit = None if args.all else args.limit

    logger.info("=" * 55)
    logger.info("  backfill_scores : AI 백필 시작")
    logger.info(f"  limit={limit or '전체'}  dry_run={args.dry_run}")
    logger.info("=" * 55)

    sb      = _get_supabase()
    groq_cl = _get_groq()

    # 1. 대상 조회
    logger.info("\n  [1/2] 대상 공시 조회 중...")
    targets = fetch_targets(sb, limit)

    if not targets:
        logger.info("  처리할 항목이 없습니다. (모두 sentiment_score 존재)")
        sys.exit(0)

    logger.info(f"  → {len(targets)}건 대상")

    # 2. 분석 + 저장
    logger.info("\n  [2/2] AI 분석 중...")
    success = failure = 0

    for i, item in enumerate(targets, 1):
        corp = item.get("corp_name") or "Unknown"
        report = item.get("report_nm") or ""
        content = item.get("content") or ""

        result = analyze_one(groq_cl, corp, report, content)

        if result:
            ok = save_one(sb, item["id"], result, args.dry_run)
            if ok:
                success += 1
                logger.info(f"  [{i}/{len(targets)}] ✅ {corp} | {result.get('event_type')} | s={result.get('sentiment_score')}")
            else:
                failure += 1
        else:
            failure += 1
            logger.warning(f"  [{i}/{len(targets)}] ⚠️  분석 실패: {corp}")

        time.sleep(API_SLEEP_SEC)

    logger.info("\n" + "=" * 55)
    logger.info(f"  완료: 성공 {success}건 / 실패 {failure}건")
    logger.info("=" * 55)
    sys.exit(0 if failure == 0 else 1)


if __name__ == "__main__":
    main()
