"""
scripts/compute_loan_pressure.py
=================================
loan_stats 테이블의 대차잔고 + 거래량 데이터로 LPS (Loan Pressure Score) 계산.

계산 순서:
  1. loan_delta    = L_t - L_{t-1}
  2. loan_z        = z-score(loan_delta, 20일 롤링 윈도)
  3. volume_ratio  = V_t / V_20d_avg
  4. LPS           = sigmoid(loan_z) * 70 + sigmoid(log(volume_ratio)) * 30  → 0~100

사전 조건:
  - fetch_loan_data.py  : loan_stats.loan_balance 채워져 있어야 함
  - fetch_market_data.py: loan_stats.volume 채워져 있어야 함

사용법:
  python scripts/compute_loan_pressure.py                # 미계산 전체
  python scripts/compute_loan_pressure.py --date 20260319  # 특정일만 재계산
  python scripts/compute_loan_pressure.py --market KOSPI   # 시장 필터 (companies 조인)
  python scripts/compute_loan_pressure.py --dry-run        # 계산 결과만 출력 (DB 저장 안함)
"""

import os
import sys
import math
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

try:
    from supabase import create_client as _supabase_create_client
except ImportError:
    _supabase_create_client = None

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from utils.env_loader import load_env
load_env()

# ── 설정 ──────────────────────────────────────────────────────────────────────

LOOKBACK_DAYS  = 20    # 롤링 윈도 (일)
BATCH_SIZE     = 200   # Supabase upsert 배치 크기
FETCH_DAYS     = 60    # 롤링 계산에 필요한 과거 데이터 조회 범위 (LOOKBACK * 3)


# ── 수학 헬퍼 ─────────────────────────────────────────────────────────────────

def sigmoid(x: float) -> float:
    """안전한 sigmoid (오버플로 방지)"""
    x = max(-500.0, min(500.0, x))
    return 1.0 / (1.0 + math.exp(-x))


def safe_std(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    n    = len(values)
    mean = sum(values) / n
    variance = sum((v - mean) ** 2 for v in values) / (n - 1)
    return math.sqrt(max(variance, 0.0))


def safe_mean(values: list[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)


def compute_lps(loan_z: float, volume_ratio: float) -> float:
    """
    LPS (Loan Pressure Score) 계산 → 0~100.

    loan_z      : 대차잔고 증감의 z-score (높을수록 대차잔고 급증)
    volume_ratio: 당일 거래량 / 20일 평균 거래량 (높을수록 비정상 거래 활발)

    LPS 해석:
      70~100 : 강한 공매도 압력 (bearish signal)
      40~70  : 중립
      0~40   : 공매도 압력 약함 (bullish signal)
    """
    # 대차잔고 z-score 컴포넌트 (0~70)
    loan_comp = sigmoid(loan_z) * 70.0

    # 거래량 컴포넌트 (0~30): volume_ratio 의 log 값 기준
    vol_log   = math.log(max(volume_ratio, 1e-6))   # log(1) = 0 → 평균 거래량이면 중립
    vol_comp  = sigmoid(vol_log) * 30.0

    lps = loan_comp + vol_comp
    return round(max(0.0, min(100.0, lps)), 4)


# ── Supabase ──────────────────────────────────────────────────────────────────

def _get_supabase():
    create_client = _supabase_create_client
    if create_client is None:
        print("[ERROR] supabase 패키지 미설치. pip install supabase")
        sys.exit(1)

    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("[ERROR] Supabase 환경변수 누락")
        sys.exit(1)

    return create_client(url, key)


def fetch_history(sb, stock_codes: list[str], date_from: str, date_to: str) -> list[dict]:
    """
    지정 종목 + 날짜 범위의 loan_stats 전체 로드.
    date_from/to: 'YYYY-MM-DD'
    """
    all_rows = []
    chunk = 500
    for i in range(0, len(stock_codes), chunk):
        batch_codes = stock_codes[i:i + chunk]
        resp = (
            sb.table("loan_stats")
            .select("stock_code, date, loan_balance, volume, lps")
            .in_("stock_code", batch_codes)
            .gte("date", date_from)
            .lte("date", date_to)
            .order("stock_code")
            .order("date")
            .execute()
        )
        all_rows.extend(resp.data or [])
    return all_rows


def fetch_uncomputed(sb, target_date: str | None, market: str | None) -> list[dict]:
    """
    LPS 가 null 이고 loan_balance + volume 이 모두 있는 행 조회.
    target_date: 'YYYY-MM-DD' or None (전체)
    market     : 'KOSPI' / 'KOSDAQ' or None
    """
    query = (
        sb.table("loan_stats")
        .select("stock_code, date, loan_balance, volume")
        .is_("lps", "null")
        .not_.is_("loan_balance", "null")
        .not_.is_("volume", "null")
    )

    if target_date:
        query = query.eq("date", target_date)

    resp = query.order("date").execute()
    rows = resp.data or []

    # 시장 필터: companies 테이블에서 market_type 확인
    if market and rows:
        stock_codes = list({r["stock_code"] for r in rows})
        chunk = 500
        valid_codes: set[str] = set()
        for i in range(0, len(stock_codes), chunk):
            batch = stock_codes[i:i + chunk]
            co_resp = (
                sb.table("companies")
                .select("stock_code")
                .in_("stock_code", batch)
                .eq("market_type", market)
                .execute()
            )
            for r in (co_resp.data or []):
                valid_codes.add(r["stock_code"])
        rows = [r for r in rows if r["stock_code"] in valid_codes]

    return rows


def save_lps(sb, updates: list[dict], dry_run: bool) -> tuple[int, int]:
    """
    loan_stats 에 loan_delta / loan_z / volume_ratio / lps upsert.
    updates: [{stock_code, date, loan_delta, loan_z, volume_ratio, lps}, ...]
    """
    if dry_run:
        print(f"  [DRY-RUN] {len(updates)}건 업데이트 (실제 저장 안함)")
        for r in updates[:5]:
            print(f"    {r['stock_code']} {r['date']} lps={r['lps']:.1f} z={r['loan_z']:.2f} vr={r['volume_ratio']:.2f}")
        return len(updates), 0

    success = failure = 0
    for i in range(0, len(updates), BATCH_SIZE):
        batch = updates[i:i + BATCH_SIZE]
        bn    = i // BATCH_SIZE + 1
        try:
            sb.table("loan_stats").upsert(
                batch, on_conflict="stock_code,date"
            ).execute()
            success += len(batch)
            print(f"  Batch {bn} 저장 완료 ({len(batch)}건)")
        except Exception as e:
            failure += len(batch)
            print(f"  [ERROR] Batch {bn} 실패: {e}")

    return success, failure


# ── 핵심 계산 로직 ────────────────────────────────────────────────────────────

def compute_for_stock(
    stock_code: str,
    history: list[dict],   # 과거 + 당일 데이터, date 순 정렬
    target_dates: set[str],
) -> list[dict]:
    """
    한 종목의 시계열 데이터로 LPS 계산.
    target_dates: 계산이 필요한 날짜 집합 ('YYYY-MM-DD')
    반환: [{stock_code, date, loan_delta, loan_z, volume_ratio, lps}, ...]
    """
    results = []

    loan_balances: list[float] = []
    volumes:       list[float] = []
    loan_deltas:   list[float] = []

    for row in history:
        lb  = row.get("loan_balance")
        vol = row.get("volume")
        dt  = row["date"]

        # loan_delta
        if loan_balances and lb is not None:
            delta = float(lb) - loan_balances[-1]
        else:
            delta = 0.0

        if lb is not None:
            loan_balances.append(float(lb))

        if vol is not None:
            volumes.append(float(vol))

        loan_deltas.append(delta)

        # 윈도 초과 제거
        if len(loan_balances) > LOOKBACK_DAYS + 1:
            loan_balances.pop(0)
        if len(volumes) > LOOKBACK_DAYS:
            volumes.pop(0)
        if len(loan_deltas) > LOOKBACK_DAYS:
            loan_deltas.pop(0)

        if dt not in target_dates:
            continue

        # ── z-score 계산 ──────────────────────────────────────────
        if len(loan_deltas) >= 3:
            std  = safe_std(loan_deltas)
            mean = safe_mean(loan_deltas)
            if std > 0:
                z = (delta - mean) / std
            else:
                z = 0.0
        else:
            z = 0.0
        z = max(-4.0, min(4.0, z))   # outlier clipping

        # ── volume_ratio 계산 ─────────────────────────────────────
        if vol is not None and volumes:
            vol_avg = safe_mean(volumes[:-1]) if len(volumes) > 1 else float(vol)
            v_ratio = float(vol) / vol_avg if vol_avg > 0 else 1.0
        else:
            v_ratio = 1.0
        v_ratio = max(0.01, min(10.0, v_ratio))   # 극단값 클리핑

        lps = compute_lps(z, v_ratio)

        results.append({
            "stock_code":   stock_code,
            "date":         dt,
            "loan_delta":   round(delta, 2),
            "loan_z":       round(z, 4),
            "volume_ratio": round(v_ratio, 4),
            "lps":          lps,
        })

    return results


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="LPS (Loan Pressure Score) 계산")
    parser.add_argument("--date",    help="기준일 (YYYY-MM-DD). 미지정 시 전체 미계산 항목")
    parser.add_argument("--market",  choices=["KOSPI", "KOSDAQ"], help="시장 필터")
    parser.add_argument("--dry-run", action="store_true", help="DB 저장 없이 결과만 출력")
    args = parser.parse_args()

    # 날짜 정규화 (YYYYMMDD → YYYY-MM-DD)
    target_date = None
    if args.date:
        try:
            target_date = str(datetime.strptime(args.date, "%Y%m%d").date())
        except ValueError:
            try:
                target_date = str(datetime.strptime(args.date, "%Y-%m-%d").date())
            except ValueError:
                print(f"[ERROR] 날짜 형식 오류: {args.date} (YYYYMMDD 또는 YYYY-MM-DD)")
                sys.exit(1)

    print("=" * 60)
    print("LPS (Loan Pressure Score) 계산")
    print(f"  대상일: {target_date or '전체 미계산'}")
    print(f"  시장:   {args.market or '전체'}")
    print(f"  모드:   {'DRY-RUN' if args.dry_run else '실제 저장'}")
    print("=" * 60)

    sb = _get_supabase()

    # 1. 계산이 필요한 행 조회
    print("\n  [1/4] 미계산 항목 조회 중...")
    uncomputed = fetch_uncomputed(sb, target_date, args.market)

    if not uncomputed:
        print("  계산할 항목이 없습니다.")
        sys.exit(0)

    print(f"  → {len(uncomputed)}건 (종목 {len({r['stock_code'] for r in uncomputed})}개)")

    # 2. 종목별 과거 데이터 조회 (롤링 계산용)
    print("\n  [2/4] 롤링 계산용 과거 데이터 조회 중...")
    stock_codes = list({r["stock_code"] for r in uncomputed})

    # 날짜 범위: target_date - FETCH_DAYS ~ target_date
    if target_date:
        dt_to   = target_date
        dt_from = str((datetime.strptime(target_date, "%Y-%m-%d").date() - timedelta(days=FETCH_DAYS)))
    else:
        dates   = sorted({r["date"] for r in uncomputed})
        dt_to   = dates[-1]
        dt_from = str((datetime.strptime(dates[0], "%Y-%m-%d").date() - timedelta(days=FETCH_DAYS)))

    history_rows = fetch_history(sb, stock_codes, dt_from, dt_to)
    print(f"  → {len(history_rows)}건 (과거 데이터 + 당일 포함)")

    # 3. 종목별 그룹핑 및 계산
    print("\n  [3/4] LPS 계산 중...")

    # stock_code → target dates 매핑
    target_map: dict[str, set[str]] = defaultdict(set)
    for r in uncomputed:
        target_map[r["stock_code"]].add(r["date"])

    # stock_code → 시계열 (date 순 정렬)
    history_map: dict[str, list[dict]] = defaultdict(list)
    for r in history_rows:
        history_map[r["stock_code"]].append(r)

    all_updates: list[dict] = []
    for code in stock_codes:
        hist = sorted(history_map[code], key=lambda x: x["date"])
        targets = target_map[code]
        updates = compute_for_stock(code, hist, targets)
        all_updates.extend(updates)

    print(f"  → {len(all_updates)}건 계산 완료")

    if not all_updates:
        print("  업데이트할 항목이 없습니다.")
        sys.exit(0)

    # 통계 출력
    lps_values = [r["lps"] for r in all_updates]
    print(f"  LPS 분포: min={min(lps_values):.1f}  max={max(lps_values):.1f}  "
          f"avg={sum(lps_values)/len(lps_values):.1f}")
    high_pressure = sum(1 for v in lps_values if v >= 70)
    print(f"  고압력 종목(LPS≥70): {high_pressure}건")

    # 4. 저장
    print(f"\n  [4/4] Supabase 저장 중 ({len(all_updates)}건)...")
    success, failure = save_lps(sb, all_updates, args.dry_run)

    print("=" * 60)
    print(f"완료: 성공 {success}건 / 실패 {failure}건")
    print("=" * 60)
    sys.exit(0 if failure == 0 else 1)


if __name__ == "__main__":
    main()
