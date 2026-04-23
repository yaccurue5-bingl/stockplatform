"""
scripts/reprocess_db.py
=======================
기존 DB 레코드를 노이즈 필터 적용 후 재분석하는 임시 스크립트.

단계:
  Step 1 (--step noise)     : 노이즈 공시를 'skipped'로 마킹 (Groq 불필요)
  Step 2 (--step pending)   : pending + failed 레코드 AI 분석
  Step 3 (--step reanalyze) : completed 이지만 event_type 이 구분류(ONE_TIME/STRUCTURAL/NEUTRAL/null) 인 것 재분석
  all    (--step all)       : 1→2→3 순서로 전체 실행

사용법:
  python scripts/reprocess_db.py --dry-run            # 건수만 확인, DB 변경 없음
  python scripts/reprocess_db.py --step noise         # 노이즈 skipped 처리
  python scripts/reprocess_db.py --step pending       # pending/failed 분석
  python scripts/reprocess_db.py --step reanalyze     # 구분류 completed 재분석
  python scripts/reprocess_db.py --step all           # 전체 실행
  python scripts/reprocess_db.py --step all --batch-size 200  # 배치 사이즈 조정
"""

import os
import sys
import json
import time
import logging
import argparse
from datetime import datetime
from pathlib import Path

# ── 환경변수 로드 ──────────────────────────────────────────────────────────────
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from utils.env_loader import load_env
load_env()

from supabase import create_client, Client
from groq import Groq

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ── 상수 ──────────────────────────────────────────────────────────────────────

# dart_crawler.py 와 동일한 노이즈 키워드
NOISE_KEYWORDS = [
    "주주총회소집공고", "주주총회결과", "투자설명서",
    "기업설명회", "증권발행실적보고서", "의결권대리행사권유", "소액공모",
    "주주명부폐쇄기준일", "배당기준일", "명의개서정지",
    "사외이사의선임", "사외이사의해임", "사외이사의중도퇴임",
    # "임원의변동"    ← 제거: CEO/C-Level 포함 공시는 신호 — is_executive_noise()로 2차 필터
    # "대표이사의변동" ← 제거: CEO 변동은 핵심 재료
]

# 임원 변동 2차 필터 (dart_crawler.py와 동일 로직)
_EXEC_SIGNAL_KEYWORDS = [
    "대표이사", "CEO", "사장", "부사장",
    "CFO", "COO", "CTO", "CSO", "CCO",
    "전무이사", "전무", "상무이사", "상무",
]
_EXEC_CHANGE_REPORT_NMS = ("임원의변동", "대표이사의변동")

def is_executive_noise(report_nm: str, content: str = "") -> bool:
    """CEO/C-Level 없는 임원 변동 공시 → True (노이즈)"""
    if not any(nm in (report_nm or "") for nm in _EXEC_CHANGE_REPORT_NMS):
        return False
    if not content:
        return False
    return not any(kw in content for kw in _EXEC_SIGNAL_KEYWORDS)

# 종목명 필터 — 스팩/펀드/부동산리츠/비상장금융기관 등 투자 시그널 무의미 종목 제외
NOISE_CORP_KEYWORDS = [
    "전문유한회사", "부동산투자회사", "스팩", "자산운용", "자산운영", "펀드",
    "기업인수목적", "투자증권", "투자자문",
]

# 구분류 event_type 값 (재분석 대상)
OLD_EVENT_TYPES = ["ONE_TIME", "STRUCTURAL", "NEUTRAL"]

GROQ_SLEEP = 1.2   # 요청 간 대기 (초) — Pro 100 RPM, 터미널 2개 동시 기준 각 50 RPM

# ── Supabase / Groq 초기화 ─────────────────────────────────────────────────────

def _init_clients():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    groq_key = os.environ.get("GROQ_API_KEY")

    if not url or not key:
        logger.error("❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 누락")
        sys.exit(1)
    if not groq_key:
        logger.error("❌ GROQ_API_KEY 환경변수 누락")
        sys.exit(1)

    sb = create_client(url, key)
    groq = Groq(api_key=groq_key)
    return sb, groq

# ── SQL 노이즈 필터 조건 빌더 ──────────────────────────────────────────────────

def _noise_filter_sql() -> str:
    """PostgREST not().ilike() 체인 대신 직접 SQL WHERE 조건 문자열 반환."""
    conditions = " AND ".join(
        f"report_nm NOT ILIKE '%{kw}%'" for kw in NOISE_KEYWORDS
    )
    return conditions

# ── 건수 조회 ─────────────────────────────────────────────────────────────────

def show_counts(sb: Client):
    """현재 재처리 대상 건수를 출력한다."""
    print("\n" + "=" * 55)
    print("  재처리 대상 건수 (노이즈 필터 적용 후)")
    print("=" * 55)

    # 전체 / 노이즈
    r = sb.rpc("count_reprocess_targets", {}).execute() if False else None
    # rpc 없이 직접 조회
    total_r = sb.table("disclosure_insights").select("id", count="exact").execute()
    total = total_r.count or 0

    # 노이즈 건수 (각 키워드별 OR) — Supabase postgrest ilike OR 체인
    noise_query = sb.table("disclosure_insights").select("id", count="exact")
    # 공시명 OR 종목명 노이즈
    or_filter = ",".join(f"report_nm.ilike.%{kw}%" for kw in NOISE_KEYWORDS)
    corp_or_filter = ",".join(f"corp_name.ilike.%{kw}%" for kw in NOISE_CORP_KEYWORDS)
    noise_q = sb.table("disclosure_insights").select("id", count="exact").or_(or_filter)
    noise_corp_q = sb.table("disclosure_insights").select("id", count="exact").or_(corp_or_filter)
    noise_r = noise_q.execute()
    noise_corp_r = noise_corp_q.execute()
    noise = (noise_r.count or 0) + (noise_corp_r.count or 0)

    # pending (비노이즈)
    pend_q = sb.table("disclosure_insights").select("id", count="exact").eq("analysis_status", "pending")
    for kw in NOISE_KEYWORDS:
        pend_q = pend_q.not_.ilike("report_nm", f"%{kw}%")
    for kw in NOISE_CORP_KEYWORDS:
        pend_q = pend_q.not_.ilike("corp_name", f"%{kw}%")
    pend_r = pend_q.execute()
    pending = pend_r.count or 0

    # failed (비노이즈)
    fail_q = sb.table("disclosure_insights").select("id", count="exact").eq("analysis_status", "failed")
    for kw in NOISE_KEYWORDS:
        fail_q = fail_q.not_.ilike("report_nm", f"%{kw}%")
    for kw in NOISE_CORP_KEYWORDS:
        fail_q = fail_q.not_.ilike("corp_name", f"%{kw}%")
    fail_r = fail_q.execute()
    failed = fail_r.count or 0

    # completed + 구분류 event_type (비노이즈)
    old_type_filter = ",".join(f"event_type.eq.{t}" for t in OLD_EVENT_TYPES) + ",event_type.is.null"
    reana_q = (
        sb.table("disclosure_insights")
        .select("id", count="exact")
        .eq("analysis_status", "completed")
        .or_(old_type_filter)
    )
    for kw in NOISE_KEYWORDS:
        reana_q = reana_q.not_.ilike("report_nm", f"%{kw}%")
    for kw in NOISE_CORP_KEYWORDS:
        reana_q = reana_q.not_.ilike("corp_name", f"%{kw}%")
    reana_r = reana_q.execute()
    reanalyze = reana_r.count or 0

    print(f"  전체 레코드         : {total:>7,}")
    print(f"  노이즈 → skipped    : {noise:>7,}  (Groq 불필요)")
    print(f"  pending 분석 대상   : {pending:>7,}")
    print(f"  failed  재시도      : {failed:>7,}")
    print(f"  completed 재분석    : {reanalyze:>7,}  (구분류 event_type)")
    print(f"  Groq 처리 총 건수   : {pending + failed + reanalyze:>7,}")
    print("=" * 55 + "\n")

    return {
        "noise": noise,
        "pending": pending,
        "failed": failed,
        "reanalyze": reanalyze,
    }

# ── Step 1: 노이즈 → skipped 마킹 ─────────────────────────────────────────────

def step_noise(sb: Client, dry_run: bool):
    logger.info("▶ Step 1: 노이즈 공시 → 'skipped' 마킹")

    or_filter = ",".join(
        [f"report_nm.ilike.%{kw}%" for kw in NOISE_KEYWORDS] +
        [f"corp_name.ilike.%{kw}%" for kw in NOISE_CORP_KEYWORDS]
    )
    # 키워드 노이즈
    targets = (
        sb.table("disclosure_insights")
        .select("id")
        .or_(or_filter)
        .not_.eq("analysis_status", "skipped")
        .execute()
    )
    ids = [r["id"] for r in (targets.data or [])]

    # stock_code 빈값 = 비상장 법인 (시장 데이터 연결 불가 → 투자 시그널 무의미)
    no_code_targets = (
        sb.table("disclosure_insights")
        .select("id")
        .eq("stock_code", "")
        .not_.eq("analysis_status", "skipped")
        .execute()
    )
    no_code_ids = [r["id"] for r in (no_code_targets.data or [])]
    ids = list(set(ids + no_code_ids))

    logger.info(f"  노이즈 대상: {len(ids)}건 (키워드:{len(ids)-len(no_code_ids)} + stock_code없음:{len(no_code_ids)})")

    if dry_run or not ids:
        return len(ids)

    # 500개씩 배치 업데이트
    chunk_size = 500
    updated = 0
    for i in range(0, len(ids), chunk_size):
        chunk = ids[i:i + chunk_size]
        sb.table("disclosure_insights").update({
            "analysis_status": "skipped",
            "updated_at": datetime.now().isoformat(),
        }).in_("id", chunk).execute()
        updated += len(chunk)
        logger.info(f"  [{updated}/{len(ids)}] skipped 처리 완료")

    logger.info(f"✅ Step 1 완료: {updated}건 → skipped")
    return updated

# ── AI 분석 헬퍼 (auto_analyst.AIAnalyst 재사용) ──────────────────────────────

def _run_analysis(analyst, sb: Client, rows: list[dict], tag: str, dry_run: bool) -> tuple[int, int]:
    """
    rows 를 Groq로 분석하고 DB 업데이트.
    반환: (성공 수, 실패 수)
    """
    ok = 0
    fail = 0

    for item in rows:
        cid = item["id"]
        corp = item.get("corp_name", "")
        report = item.get("report_nm", "")
        content = item.get("content") or ""

        # 임원 변동 2차 필터: 본문에 CEO/C-Level 없으면 skipped 처리
        if is_executive_noise(report, content):
            logger.info(f"  ⏭ 임원변동 노이즈 (CEO/C-Level 없음): {corp} — {report[:40]}")
            sb.table("disclosure_insights").update({
                "analysis_status": "skipped",
                "updated_at": datetime.now().isoformat(),
            }).eq("id", cid).execute()
            continue

        if dry_run:
            logger.info(f"  [DRY] {tag} {corp} — {report[:40]}")
            ok += 1
            continue

        # processing 마킹
        sb.table("disclosure_insights").update({
            "analysis_status": "processing"
        }).eq("id", cid).execute()

        result = analyst.analyze_content(corp, report, content)

        if result:
            raw_score = result.get("sentiment_score")
            try:
                sentiment_score = float(raw_score) if raw_score is not None else None
                if sentiment_score is not None:
                    sentiment_score = max(-1.0, min(1.0, sentiment_score))
            except (TypeError, ValueError):
                sentiment_score = None

            sb.table("disclosure_insights").update({
                "headline":                result.get("headline"),
                "key_numbers":             result.get("key_numbers"),
                "event_type":              result.get("event_type"),
                "financial_impact":        result.get("financial_impact"),
                "short_term_impact_score": result.get("short_term_impact_score"),
                "sentiment_score":         sentiment_score,
                "ai_summary":              result.get("ai_summary"),
                "risk_factors":            result.get("risk_factors"),
                "analysis_status":         "completed",
                "is_visible":              True,
                "updated_at":              datetime.now().isoformat(),
            }).eq("id", cid).execute()

            logger.info(f"  ✅ {tag} {corp}")
            ok += 1
        else:
            retry = (item.get("analysis_retry_count") or 0) + 1
            new_status = "failed" if retry >= 3 else "pending"
            sb.table("disclosure_insights").update({
                "analysis_status":       new_status,
                "analysis_retry_count":  retry,
                "updated_at":            datetime.now().isoformat(),
            }).eq("id", cid).execute()
            logger.warning(f"  ⚠️ {tag} 실패: {corp}")
            fail += 1

        time.sleep(GROQ_SLEEP)

    return ok, fail

# ── Step 2: pending + failed 분석 ─────────────────────────────────────────────

def step_pending(sb: Client, groq_client, batch_size: int, dry_run: bool):
    from auto_analyst import AIAnalyst
    analyst = AIAnalyst()

    logger.info("▶ Step 2: pending / failed 분석")

    total_ok = 0
    total_fail = 0
    iteration = 0

    while True:
        iteration += 1
        query = (
            sb.table("disclosure_insights")
            .select("id, corp_name, report_nm, content, analysis_retry_count")
            .in_("analysis_status", ["pending", "failed"])
            .not_.is_("content", "null")
            .neq("analysis_status", "processing")   # 다른 터미널 처리 중 건 스킵
        )
        for kw in NOISE_KEYWORDS:
            query = query.not_.ilike("report_nm", f"%{kw}%")
        for kw in NOISE_CORP_KEYWORDS:
            query = query.not_.ilike("corp_name", f"%{kw}%")
        query = query.order("rcept_dt", desc=True).limit(batch_size)
        rows = (query.execute()).data or []

        if not rows:
            break

        logger.info(f"  배치 #{iteration}: {len(rows)}건 처리 중...")
        ok, fail = _run_analysis(analyst, sb, rows, "[P]", dry_run)
        total_ok += ok
        total_fail += fail
        logger.info(f"  배치 #{iteration} 완료 — 성공 {ok} / 실패 {fail}")

        if dry_run:
            break   # dry-run 은 1회만

    logger.info(f"✅ Step 2 완료: 성공 {total_ok} / 실패 {total_fail}")
    return total_ok, total_fail

# ── Step 3: completed + 구분류 event_type 재분석 ──────────────────────────────

def step_reanalyze(sb: Client, groq_client, batch_size: int, dry_run: bool):
    from auto_analyst import AIAnalyst
    analyst = AIAnalyst()

    logger.info("▶ Step 3: 구분류 event_type completed 재분석")
    old_type_filter = ",".join(f"event_type.eq.{t}" for t in OLD_EVENT_TYPES) + ",event_type.is.null"

    total_ok = 0
    total_fail = 0
    iteration = 0

    while True:
        iteration += 1
        query = (
            sb.table("disclosure_insights")
            .select("id, corp_name, report_nm, content, analysis_retry_count")
            .eq("analysis_status", "completed")
            .or_(old_type_filter)
            .not_.is_("content", "null")
        )
        for kw in NOISE_KEYWORDS:
            query = query.not_.ilike("report_nm", f"%{kw}%")
        for kw in NOISE_CORP_KEYWORDS:
            query = query.not_.ilike("corp_name", f"%{kw}%")
        query = query.order("rcept_dt", desc=True).limit(batch_size)
        rows = (query.execute()).data or []

        if not rows:
            break

        logger.info(f"  배치 #{iteration}: {len(rows)}건 재분석 중...")
        ok, fail = _run_analysis(analyst, sb, rows, "[R]", dry_run)
        total_ok += ok
        total_fail += fail
        logger.info(f"  배치 #{iteration} 완료 — 성공 {ok} / 실패 {fail}")

        if dry_run:
            break

    logger.info(f"✅ Step 3 완료: 성공 {total_ok} / 실패 {total_fail}")
    return total_ok, total_fail

# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="기존 DB 레코드 노이즈 필터 + 재분석")
    parser.add_argument("--step", choices=["noise", "pending", "reanalyze", "all"],
                        default="all", help="실행할 단계 (기본: all)")
    parser.add_argument("--batch-size", type=int, default=500,
                        help="배치당 처리 건수 (기본: 500)")
    parser.add_argument("--dry-run", action="store_true",
                        help="DB 변경 없이 건수만 확인")
    args = parser.parse_args()

    sb, groq_client = _init_clients()

    # 항상 현황 출력
    counts = show_counts(sb)

    if args.dry_run:
        print("  ℹ️  --dry-run 모드: 실제 처리 없이 종료합니다.\n")
        sys.exit(0)

    step = args.step
    bs   = args.batch_size

    if step in ("noise", "all"):
        step_noise(sb, dry_run=False)

    if step in ("pending", "all"):
        step_pending(sb, groq_client, bs, dry_run=False)

    if step in ("reanalyze", "all"):
        step_reanalyze(sb, groq_client, bs, dry_run=False)

    print("\n🎉 reprocess_db.py 완료\n")


if __name__ == "__main__":
    main()
