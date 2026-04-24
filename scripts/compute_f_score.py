"""
compute_f_score.py
==================
financials 테이블의 raw 데이터 → F_score (0~100) 계산 → DB 저장

【F_score 계산 방식】
  구성 지표 (각 percentile 0~100):
    수익성  ROE          = net_profit / total_equity        (높을수록 good)
    수익성  영업이익률    = op_profit  / revenue             (높을수록 good)
    성장성  매출 YoY     = (rev_t - rev_t-1) / |rev_t-1|   (높을수록 good)
    성장성  영업이익 YoY = (op_t  - op_t-1)  / |op_t-1|   (높을수록 good)
    안정성  부채비율      = total_liabilities / total_equity (낮을수록 good → 역순)

  F_score = 유효 지표 percentile 평균 (0~100)

【필터】
  금융업(is_financial_sector=True): 매출/영업이익 비교 의미 없음 → ROE/부채비율만 사용
  극단값 클리핑:  ROE [-5, +5], op_margin [-2, +2], yoy [-3, +3], debt [0, 20]
  최소 종목 수:   percentile 계산에 20개 미만이면 skip

【사용법】
  python scripts/compute_f_score.py              # 최신 연도 기준
  python scripts/compute_f_score.py --year 2025  # 특정 연도
  python scripts/compute_f_score.py --dry-run    # 결과 출력만, DB 저장 안함

【실행 주기】
  fetch_financial_bulk.py 실행 후 바로 실행
  분기별 1회 (사업보고서 제출 완료 시점 기준)
"""

import os
import sys
import math
import logging
import argparse
import time
from datetime import datetime
from statistics import median

from supabase import create_client, Client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BATCH_SIZE   = 100

# ── 극단값 클리핑 범위 ─────────────────────────────────────────────────────────
CLIP = {
    "roe":            (-5.0,  5.0),
    "op_margin":      (-2.0,  2.0),
    "rev_yoy":        (-3.0,  3.0),
    "op_profit_yoy":  (-3.0,  3.0),
    "debt_ratio":     ( 0.0, 20.0),
}

# ── 헬퍼 ─────────────────────────────────────────────────────────────────────

def _clip(val: float | None, lo: float, hi: float) -> float | None:
    if val is None or math.isnan(val) or math.isinf(val):
        return None
    return max(lo, min(hi, val))


def _percentile_rank(value: float, sorted_vals: list[float]) -> float:
    """value의 백분위 순위 (0~100). sorted_vals는 오름차순 정렬."""
    n = len(sorted_vals)
    if n == 0:
        return 50.0
    count_below = sum(1 for v in sorted_vals if v < value)
    count_equal = sum(1 for v in sorted_vals if v == value)
    return (count_below + 0.5 * count_equal) / n * 100


def _safe_div(num, den) -> float | None:
    if num is None or den is None or den == 0:
        return None
    result = num / den
    if math.isnan(result) or math.isinf(result):
        return None
    return result


# ── 메인 ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--year",    type=int, help="기준 연도 (기본: 가장 최근 연도)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        logger.error("❌ SUPABASE 환경변수 누락")
        sys.exit(1)

    sb: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

    # ── 연도 결정 ─────────────────────────────────────────────────────────────
    if args.year:
        target_year = args.year
    else:
        years_res = sb.table("financials").select("fiscal_year").order("fiscal_year", desc=True).limit(1).execute()
        if not years_res.data:
            logger.error("financials 데이터 없음")
            sys.exit(1)
        target_year = years_res.data[0]["fiscal_year"]

    prev_year = target_year - 1
    logger.info(f"📅 기준 연도: {target_year}  (YoY 비교: {prev_year})")

    # ── 데이터 로드 ──────────────────────────────────────────────────────────
    logger.info("📋 financials 로드 중...")
    curr_raw = sb.table("financials") \
        .select("stock_code, revenue, op_profit, net_profit, total_equity, total_liabilities, is_financial_sector") \
        .eq("fiscal_year", target_year).execute().data or []

    prev_raw = sb.table("financials") \
        .select("stock_code, revenue, op_profit") \
        .eq("fiscal_year", prev_year).execute().data or []

    prev_map: dict[str, dict] = {r["stock_code"]: r for r in prev_raw}
    logger.info(f"  당기: {len(curr_raw)}개  전기: {len(prev_map)}개")

    # ── 비율 계산 ─────────────────────────────────────────────────────────────
    logger.info("🔢 재무 비율 계산 중...")

    class StockRatios:
        def __init__(self):
            self.stock_code: str = ""
            self.is_fin: bool = False
            self.roe:           float | None = None
            self.op_margin:     float | None = None
            self.rev_yoy:       float | None = None
            self.op_profit_yoy: float | None = None
            self.debt_ratio:    float | None = None

    all_ratios: list[StockRatios] = []

    for row in curr_raw:
        sc     = row["stock_code"]
        is_fin = bool(row.get("is_financial_sector"))
        rev    = row.get("revenue")
        op     = row.get("op_profit")
        net    = row.get("net_profit")
        eq     = row.get("total_equity")
        debt   = row.get("total_liabilities")
        prev   = prev_map.get(sc, {})

        r = StockRatios()
        r.stock_code = sc
        r.is_fin     = is_fin

        r.roe        = _clip(_safe_div(net, eq),         *CLIP["roe"])
        r.debt_ratio = _clip(_safe_div(debt, eq),        *CLIP["debt_ratio"])

        if not is_fin:
            r.op_margin = _clip(_safe_div(op, rev),      *CLIP["op_margin"])
            prev_rev = prev.get("revenue")
            prev_op  = prev.get("op_profit")
            if prev_rev and rev is not None:
                r.rev_yoy = _clip(_safe_div(rev - prev_rev, abs(prev_rev)), *CLIP["rev_yoy"])
            if prev_op and op is not None:
                r.op_profit_yoy = _clip(_safe_div(op - prev_op, abs(prev_op)), *CLIP["op_profit_yoy"])

        all_ratios.append(r)

    # ── Cross-sectional percentile (전체 기준) ──────────────────────────────
    logger.info("📊 percentile 계산 중...")

    def _sorted_vals(field: str, fin_only: bool = False) -> list[float]:
        vals = []
        for r in all_ratios:
            if fin_only and not r.is_fin:
                continue
            v = getattr(r, field)
            if v is not None:
                vals.append(v)
        return sorted(vals)

    roe_sorted        = _sorted_vals("roe")
    op_margin_sorted  = _sorted_vals("op_margin")
    rev_yoy_sorted    = _sorted_vals("rev_yoy")
    op_yoy_sorted     = _sorted_vals("op_profit_yoy")
    debt_sorted       = _sorted_vals("debt_ratio")

    logger.info(f"  ROE {len(roe_sorted)}개  op_margin {len(op_margin_sorted)}개  "
                f"rev_yoy {len(rev_yoy_sorted)}개  op_yoy {len(op_yoy_sorted)}개  "
                f"debt {len(debt_sorted)}개")

    # ── F_score 계산 ─────────────────────────────────────────────────────────
    rows_to_update = []
    skipped = 0

    for r in all_ratios:
        pcts: list[float] = []

        if r.roe is not None and len(roe_sorted) >= 20:
            pcts.append(_percentile_rank(r.roe, roe_sorted))

        if not r.is_fin:
            if r.op_margin is not None and len(op_margin_sorted) >= 20:
                pcts.append(_percentile_rank(r.op_margin, op_margin_sorted))
            if r.rev_yoy is not None and len(rev_yoy_sorted) >= 20:
                pcts.append(_percentile_rank(r.rev_yoy, rev_yoy_sorted))
            if r.op_profit_yoy is not None and len(op_yoy_sorted) >= 20:
                pcts.append(_percentile_rank(r.op_profit_yoy, op_yoy_sorted))

        # 부채비율은 낮을수록 좋음 → 역순 percentile
        if r.debt_ratio is not None and len(debt_sorted) >= 20:
            pcts.append(100 - _percentile_rank(r.debt_ratio, debt_sorted))

        if not pcts:
            skipped += 1
            continue

        f_score = round(sum(pcts) / len(pcts), 1)

        # 비율 컬럼도 함께 저장
        rows_to_update.append({
            "stock_code":     r.stock_code,
            "fiscal_year":    target_year,
            "roe":            round(r.roe, 4) if r.roe is not None else None,
            "op_margin":      round(r.op_margin, 4) if r.op_margin is not None else None,
            "rev_yoy":        round(r.rev_yoy, 4) if r.rev_yoy is not None else None,
            "op_profit_yoy":  round(r.op_profit_yoy, 4) if r.op_profit_yoy is not None else None,
            "debt_ratio":     round(r.debt_ratio, 4) if r.debt_ratio is not None else None,
            "f_score":        f_score,
        })

    logger.info(f"✅ F_score 계산: {len(rows_to_update)}개  (비율 없음: {skipped}개)")

    # ── 분포 요약 출력 ───────────────────────────────────────────────────────
    scores = sorted([r["f_score"] for r in rows_to_update])
    if scores:
        n = len(scores)
        logger.info(f"\n📊 F_score 분포 (n={n})")
        logger.info(f"  Min  : {scores[0]:.1f}")
        logger.info(f"  P10  : {scores[int(n*0.10)]:.1f}")
        logger.info(f"  P25  : {scores[int(n*0.25)]:.1f}")
        logger.info(f"  P50  : {scores[int(n*0.50)]:.1f}")
        logger.info(f"  P75  : {scores[int(n*0.75)]:.1f}")
        logger.info(f"  P90  : {scores[int(n*0.90)]:.1f}")
        logger.info(f"  Max  : {scores[-1]:.1f}")
        logger.info(f"  F≥70 : {sum(1 for s in scores if s >= 70)} (Quality)")
        logger.info(f"  F≥50 : {sum(1 for s in scores if s >= 50)}")
        logger.info(f"  F<20 : {sum(1 for s in scores if s < 20)} (탈락 대상)")

    if args.dry_run:
        logger.info("\n🔍 dry-run — DB 저장 생략")
        for r in rows_to_update[:5]:
            logger.info(f"  {r['stock_code']}  f_score={r['f_score']:.1f}")
        return

    # ── Supabase upsert ─────────────────────────────────────────────────────
    logger.info("\n💾 DB 저장 중...")
    for i in range(0, len(rows_to_update), BATCH_SIZE):
        batch = rows_to_update[i: i + BATCH_SIZE]
        sb.table("financials").upsert(batch, on_conflict="stock_code,fiscal_year").execute()
        logger.info(f"  [{i + len(batch)}/{len(rows_to_update)}] 저장")
        time.sleep(0.05)

    logger.info(f"\n[DONE] {len(rows_to_update)}개 종목 f_score 저장 완료")
    logger.info("💡 이제 /api/hot-stocks 에서 F_adj 자동 반영됩니다.")


if __name__ == "__main__":
    main()
