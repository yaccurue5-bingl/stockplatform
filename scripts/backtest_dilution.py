"""
scripts/backtest_dilution.py
============================
Dilution 독립 엔진 백테스트 — Supply Pressure Score 분포 분석.

목적:
  1. 모든 completed DILUTION 이벤트에 대해 "공시 당시 점수" 계산
     (today = event_date → timing_decay = 1.0, training/serving skew 제거)
  2. 점수 분포 (percentile) 로 p70/p90 임계값 산출
  3. 월별·티어별 분포 안정성 확인
  4. 현재 고정 임계값(0.15/0.10) vs Percentile 임계값 비교

출력:
  - 전체 분포 (p50/p70/p80/p90/p95)
  - 월별 평균·샘플수
  - 추천 임계값

사용법:
  python scripts/backtest_dilution.py
  python scripts/backtest_dilution.py --from 20260101 --to 20260430
  python scripts/backtest_dilution.py --export scores.csv   # 전체 데이터 CSV 저장
"""

import argparse
import csv
import math
import os
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from utils.env_loader import load_env
load_env()

# compute_base_score.py의 Dilution 엔진 재사용
from scripts.compute_base_score import (
    compute_dilution_score,
    compute_dilution_signal,
    DilutionScoreResult,
)

try:
    from supabase import create_client as _supabase_create_client
except ImportError:
    _supabase_create_client = None


# ── Supabase ──────────────────────────────────────────────────────────────────

def _get_supabase():
    if _supabase_create_client is None:
        print("[ERROR] supabase 패키지 미설치.")
        sys.exit(1)
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("[ERROR] Supabase 환경변수 누락")
        sys.exit(1)
    return _supabase_create_client(url, key)


def fetch_dilution_events(sb, from_dt: str | None, to_dt: str | None) -> list[dict]:
    """
    completed DILUTION 이벤트 전체 조회 (key_numbers 포함).
    페이지네이션으로 1000건 제한 우회.
    """
    PAGE = 1000
    all_rows: list[dict] = []
    offset = 0

    while True:
        query = (
            sb.table("disclosure_insights")
            .select(
                "id, stock_code, rcept_dt, report_nm, "
                "sentiment_score, key_numbers"
            )
            .eq("analysis_status", "completed")
            .eq("event_type", "DILUTION")
            .not_.is_("sentiment_score", "null")
        )
        if from_dt:
            query = query.gte("rcept_dt", from_dt)
        if to_dt:
            query = query.lte("rcept_dt", to_dt)

        page = (
            query
            .order("rcept_dt", desc=False)
            .range(offset, offset + PAGE - 1)
            .execute()
        )
        rows = page.data or []
        all_rows.extend(rows)
        if len(rows) < PAGE:
            break
        offset += PAGE

    return all_rows


def load_market_caps(sb) -> dict[str, int]:
    resp = sb.table("companies").select("stock_code, market_cap").not_.is_("market_cap", "null").execute()
    return {
        r["stock_code"]: int(r["market_cap"])
        for r in (resp.data or [])
        if r.get("market_cap") and int(r["market_cap"]) > 0
    }


# ── 통계 헬퍼 ─────────────────────────────────────────────────────────────────

def percentile(data: list[float], p: float) -> float:
    """p-th percentile (0~100) — linear interpolation."""
    if not data:
        return 0.0
    sorted_data = sorted(data)
    n = len(sorted_data)
    idx = (p / 100.0) * (n - 1)
    lo = int(idx)
    hi = min(lo + 1, n - 1)
    frac = idx - lo
    return sorted_data[lo] * (1 - frac) + sorted_data[hi] * frac


def stats_str(data: list[float]) -> str:
    if not data:
        return "n=0"
    return (
        f"n={len(data)}  "
        f"avg={sum(data)/len(data):.4f}  "
        f"min={min(data):.4f}  max={max(data):.4f}"
    )


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Dilution Score 백테스트 분포 분석")
    parser.add_argument("--from",   dest="from_dt",  default=None, help="시작 날짜 (YYYYMMDD)")
    parser.add_argument("--to",     dest="to_dt",    default=None, help="종료 날짜 (YYYYMMDD)")
    parser.add_argument("--export", dest="csv_path", default=None, help="결과 CSV 저장 경로")
    parser.add_argument("--plus5",  action="store_true",
                        help="today = event_date + 5d 로 설정 (default: event_date)")
    args = parser.parse_args()

    print("=" * 60)
    print("Dilution Score 백테스트 분포 분석")
    today_mode = "event_date + 5d" if args.plus5 else "event_date (timing_decay=1.0)"
    print(f"  today 기준: {today_mode}")
    print("=" * 60)

    sb = _get_supabase()

    # 1. 데이터 로드
    print("\n[1/3] 데이터 로드...")
    cap_map = load_market_caps(sb)
    print(f"  → 시총 매핑: {len(cap_map)}개 종목")

    rows = fetch_dilution_events(sb, args.from_dt, args.to_dt)
    print(f"  → DILUTION 이벤트: {len(rows)}건 (completed)")

    if not rows:
        print("  데이터 없음. 종료.")
        sys.exit(0)

    # 2. 점수 계산 (backtest_mode: today = event_date)
    print("\n[2/3] 점수 계산 중...")

    records: list[dict] = []
    no_issuance  = 0   # 발행금액 파싱 불가
    below_3pct   = 0   # size_impact < 3%
    scored       = 0

    for row in rows:
        code   = row.get("stock_code") or ""
        rdt    = str(row.get("rcept_dt") or "")
        cap    = cap_map.get(code)
        report_nm = row.get("report_nm") or ""
        sentiment = row.get("sentiment_score")

        if not rdt or len(rdt) != 8:
            continue

        # today = event_date (+5d 옵션)
        try:
            event_dt = datetime.strptime(rdt, "%Y%m%d")
        except ValueError:
            continue

        from datetime import timedelta
        backtest_today = event_dt + timedelta(days=5) if args.plus5 else event_dt

        result = compute_dilution_score(
            key_numbers=row.get("key_numbers"),
            market_cap=cap,
            rcept_dt=rdt,
            report_nm=report_nm,
            today=backtest_today,
        )

        month = rdt[:6]  # YYYYMM

        if result is None:
            # 실패 원인 분류 (시총 or key_numbers 없으면 스킵)
            if not row.get("key_numbers") or not cap:
                pass  # 데이터 없음
            else:
                # 발행금액 파싱 불가 or 3% 미만 판단
                from scripts.compute_base_score import _parse_issuance_amount
                import json
                kn = row.get("key_numbers")
                kn_list = (json.loads(kn) if isinstance(kn, str) else kn) or []
                amt = _parse_issuance_amount(kn_list)
                if amt is None:
                    no_issuance += 1
                elif cap and amt / cap < 0.03:
                    below_3pct += 1
            continue

        d_signal = compute_dilution_signal(result, sentiment)
        scored += 1

        records.append({
            "id":               row["id"],
            "stock_code":       code,
            "rcept_dt":         rdt,
            "month":            month,
            "report_nm":        report_nm,
            "market_cap":       cap or 0,
            "sentiment":        float(sentiment) if sentiment is not None else 0.0,
            # Dilution 세부 컴포넌트
            "size_impact":      result.size_impact,
            "discount_factor":  result.discount_factor,
            "effective_discount": result.effective_discount,
            "timing_decay":     result.timing_decay,
            "event_strength":   result.event_strength,
            "liquidity_impact": result.liquidity_impact,
            "score":            result.score,
            # Signal
            "d_signal":         d_signal,
            # Current thresholds (고정값)
            "tag_fixed_high":   result.score > 0.15 and float(sentiment or 0) < -0.2,
            "tag_fixed_medium": result.score > 0.10,
        })

    print(f"  → 점수 산출: {scored}건")
    print(f"     발행금액 파싱 불가: {no_issuance}건")
    print(f"     3% 미만 소규모 희석: {below_3pct}건")
    print(f"     데이터 부족 (시총/key_numbers 없음): {len(rows) - scored - no_issuance - below_3pct}건")

    if not records:
        print("  점수 계산된 이벤트 없음. 종료.")
        sys.exit(0)

    # 3. 분포 분석
    print("\n[3/3] 분포 분석...")

    all_scores = [r["score"] for r in records]

    # ── 전체 분포
    p50 = percentile(all_scores, 50)
    p70 = percentile(all_scores, 70)
    p80 = percentile(all_scores, 80)
    p90 = percentile(all_scores, 90)
    p95 = percentile(all_scores, 95)

    print("\n" + "=" * 60)
    print("전체 Score 분포 (backtest_mode: today=event_date)")
    print("=" * 60)
    print(f"  {stats_str(all_scores)}")
    print(f"\n  Percentile:")
    print(f"    p50 = {p50:.4f}")
    print(f"    p70 = {p70:.4f}  ← MEDIUM 추천 임계값")
    print(f"    p80 = {p80:.4f}")
    print(f"    p90 = {p90:.4f}  ← HIGH 추천 임계값")
    print(f"    p95 = {p95:.4f}")

    # ── 현재 고정 임계값 비교
    fixed_high   = sum(1 for r in records if r["tag_fixed_high"])
    fixed_medium = sum(1 for r in records if r["tag_fixed_medium"])
    pct_high     = sum(1 for r in records if r["score"] > 0.15) / len(records) * 100
    pct_medium   = sum(1 for r in records if r["score"] > 0.10) / len(records) * 100

    print(f"\n  현재 고정 임계값 (0.15/0.10) vs Percentile:")
    print(f"    HIGH  (score>0.15 & sent<-0.2) : {fixed_high:4d}건 ({fixed_high/len(records)*100:.1f}%)")
    print(f"    MEDIUM(score>0.10)              : {fixed_medium:4d}건 ({fixed_medium/len(records)*100:.1f}%)")
    print(f"    score>0.15 비율 (sentiment 무관): {pct_high:.1f}%")
    print(f"    score>0.10 비율               : {pct_medium:.1f}%")
    print(f"\n  Percentile 임계값 적용 시:")
    print(f"    HIGH  (≥p90={p90:.4f}) : {sum(1 for s in all_scores if s >= p90):4d}건 (10.0%)")
    print(f"    MEDIUM(≥p70={p70:.4f}) : {sum(1 for s in all_scores if s >= p70):4d}건 (30.0%)")

    # ── 월별 분포
    monthly: dict[str, list[float]] = defaultdict(list)
    monthly_high: dict[str, int] = defaultdict(int)
    monthly_medium: dict[str, int] = defaultdict(int)

    for r in records:
        m = r["month"]
        monthly[m].append(r["score"])
        if r["score"] >= p90:
            monthly_high[m] += 1
        if r["score"] >= p70:
            monthly_medium[m] += 1

    print("\n" + "=" * 60)
    print("월별 분포 (안정성 확인)")
    print("=" * 60)
    print(f"  {'월':8s} {'n':>5s} {'avg':>8s} {'p70':>8s} {'p90':>8s} {'≥p90':>6s} {'≥p70':>6s}")
    print("  " + "-" * 56)
    for month in sorted(monthly.keys()):
        scores = monthly[month]
        avg = sum(scores) / len(scores)
        _p70 = percentile(scores, 70) if len(scores) >= 5 else float("nan")
        _p90 = percentile(scores, 90) if len(scores) >= 5 else float("nan")
        p70_str = f"{_p70:.4f}" if not math.isnan(_p70) else "  n/a "
        p90_str = f"{_p90:.4f}" if not math.isnan(_p90) else "  n/a "
        print(
            f"  {month:8s} {len(scores):>5d} {avg:>8.4f} {p70_str:>8s} {p90_str:>8s} "
            f"{monthly_high[month]:>6d} {monthly_medium[month]:>6d}"
        )

    # ── Tier 별 분포
    tier1_scores = [r["score"] for r in records if r["event_strength"] == 1.0]
    tier2_scores = [r["score"] for r in records if r["event_strength"] == 0.5]

    print("\n" + "=" * 60)
    print("Tier별 분포")
    print("=" * 60)
    print(f"  TIER1 (유상증자/CB/BW): {stats_str(tier1_scores)}")
    print(f"  TIER2 (기타)          : {stats_str(tier2_scores)}")

    # ── sentiment 분포 vs signal
    neg_sent = [r["score"] for r in records if r["sentiment"] < -0.2]
    pos_sent = [r["score"] for r in records if r["sentiment"] >= -0.2]
    high_neg = [r["score"] for r in records if r["score"] >= p90 and r["sentiment"] < -0.2]
    high_pos = [r["score"] for r in records if r["score"] >= p90 and r["sentiment"] >= -0.2]

    print("\n" + "=" * 60)
    print("Sentiment × Score 분포")
    print("=" * 60)
    print(f"  부정(sentiment<-0.2): {stats_str(neg_sent)}")
    print(f"  중립/긍정           : {stats_str(pos_sent)}")
    print(f"  ≥p90 & 부정         : {len(high_neg)}건")
    print(f"  ≥p90 & 중립/긍정    : {len(high_pos)}건")

    # ── 추천 임계값 결론
    print("\n" + "=" * 60)
    print("추천 임계값")
    print("=" * 60)
    print(f"  HIGH   임계값: {p90:.4f}  (p90 - 전체의 10%)")
    print(f"  MEDIUM 임계값: {p70:.4f}  (p70 - 전체의 30%)")
    print(f"\n  compute_dilution_signal() 수정 제안:")
    print(f"    if dilution.score > {p90:.4f} and ss < -0.2:  -> 'HIGH'")
    print(f"    if dilution.score > {p70:.4f}:                -> 'MEDIUM'")
    print(f"\n  Note: 주의: 임계값은 backtest 기준(timing_decay=1.0)")
    print(f"           프로덕션(당일 실행)의 timing_decay 는 ~{math.exp(-0/30.0):.3f}~{math.exp(-7/30.0):.3f}(주간)")
    print(f"           -> 당일/익일 이벤트는 거의 동일하게 적용됨")

    # ── CSV 내보내기
    if args.csv_path:
        fieldnames = [
            "id", "stock_code", "rcept_dt", "month", "report_nm", "market_cap",
            "sentiment", "size_impact", "discount_factor",
            "effective_discount", "timing_decay", "event_strength", "liquidity_impact",
            "score", "d_signal", "tag_fixed_high", "tag_fixed_medium",
        ]
        with open(args.csv_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(records)
        print(f"\n  → CSV 저장: {args.csv_path} ({len(records)}행)")

    print()


if __name__ == "__main__":
    main()
