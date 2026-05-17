"""
scripts/recompute_reclassified.py
==================================
재분류된 레코드(event_type 변경)의 final_score / signal_tag 재계산.

대상:
  - event_type='DIVIDEND' + rcept_dt 20250226~20260511 (Phase 2 DIVIDEND 248건)
  - event_type='CAPEX'    + rcept_dt 20250226~20260511 (Phase 2 CAPEX 40건)

사용법:
  python scripts/recompute_reclassified.py            # 실제 업데이트
  python scripts/recompute_reclassified.py --dry-run  # DB 저장 없이 결과 출력
"""

import os, sys, argparse, logging
from pathlib import Path
from datetime import datetime

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

try:
    from utils.env_loader import load_env
    load_env()
except Exception:
    from dotenv import load_dotenv
    for p in [_ROOT / ".env.local", _ROOT / ".env"]:
        if p.exists():
            load_dotenv(p); break

from supabase import create_client
from compute_base_score import (
    compute_s, compute_i, compute_e, compute_e_zscore,
    compute_base_score, compute_reliability,
    compute_final_score, compute_signal_tag,
    load_event_stats, load_market_caps, get_cap_bucket,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("recompute_reclassified")

SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# Phase 2 reclassification date range
DT_FROM = "20250226"
DT_TO   = "20260511"

FETCH_COLS = (
    "id,stock_code,event_type,report_nm,sentiment_score,short_term_impact_score,"
    "key_numbers,rcept_dt,base_score,final_score,signal_tag"
)


def fetch_reclassified() -> list[dict]:
    """DIVIDEND/CAPEX 재분류 대상 레코드 조회 (event_type + rcept_dt 범위 필터)."""
    rows: list[dict] = []
    for event_type in ("DIVIDEND", "CAPEX"):
        offset = 0
        type_count = 0
        while True:
            resp = (
                sb.table("disclosure_insights")
                .select(FETCH_COLS)
                .eq("analysis_status", "completed")
                .eq("event_type", event_type)
                .gte("rcept_dt", DT_FROM)
                .lte("rcept_dt", DT_TO)
                .range(offset, offset + 999)
                .execute()
            )
            batch = resp.data or []
            rows.extend(batch)
            type_count += len(batch)
            if len(batch) < 1000:
                break
            offset += 1000
        log.info(f"  {event_type}: {type_count}건")
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="DB 저장 없이 출력만")
    args = parser.parse_args()

    log.info(f"DIVIDEND/CAPEX 재분류 레코드 스코어 재계산 (rcept_dt {DT_FROM}~{DT_TO})")

    log.info("event_stats + 시총 데이터 로드 중...")
    event_stats = load_event_stats(sb)
    cap_map = load_market_caps(sb)
    log.info(f"  event_stats: {len(event_stats)}개 유형, 시총: {len(cap_map)}개 종목")

    log.info("대상 레코드 조회 중...")
    rows = fetch_reclassified()
    log.info(f"총 {len(rows)}건 로드 완료")

    if not rows:
        log.info("재계산 대상 없음")
        return

    updated = failed = unchanged = 0

    for row in rows:
        try:
            et   = (row.get("event_type") or "OTHER").upper()
            ss   = row.get("sentiment_score")
            sti  = row.get("short_term_impact_score")
            kn   = row.get("key_numbers") or []
            code = row.get("stock_code") or ""

            # E 컴포넌트: 시총 버킷 Z-score 기반
            ev_info  = event_stats.get(et, {})
            bucket   = get_cap_bucket(cap_map.get(code))
            z_score  = ev_info.get(f"z_{bucket.lower()}")
            n_bucket = ev_info.get(f"n_{bucket.lower()}", 0)

            s  = compute_s(ss)
            i_ = compute_i(sti)
            if z_score is not None:
                e = compute_e_zscore(z_score, n_bucket)
            else:
                e = compute_e(ev_info.get("avg_5d_return"), ev_info.get("sample_size"))

            raw, base  = compute_base_score(s, i_, e)
            reliability = compute_reliability(kn)
            final = compute_final_score(base, None, reliability)  # LPS 수집 중단

            tag = compute_signal_tag(base, None, event_type=et, sentiment_score=ss)

            old_final = row.get("final_score")
            old_tag   = row.get("signal_tag")

            score_same = (
                old_final is not None
                and abs(float(old_final) - final) < 0.01
                and tag == old_tag
            )
            if score_same:
                unchanged += 1
                continue

            rn_short = (row.get("report_nm") or "")[:35]
            log.info(
                f"  [{et}] {rn_short} {row['id'][:8]}.. "
                f"score {old_final}→{final:.1f}  tag '{old_tag}'→'{tag}'"
            )

            if not args.dry_run:
                sb.table("disclosure_insights").update({
                    "base_score_raw": raw,
                    "base_score":     base,
                    "final_score":    final,
                    "signal_tag":     tag,
                }).eq("id", row["id"]).execute()
            updated += 1

        except Exception as exc:
            log.error(f"  오류 [{row.get('id', '?')}]: {exc}")
            failed += 1

    log.info("=" * 60)
    log.info(
        f"완료: 변경 {updated}건 / 변경없음 {unchanged}건 / 실패 {failed}건"
        + (" [DRY-RUN]" if args.dry_run else "")
    )


if __name__ == "__main__":
    main()
