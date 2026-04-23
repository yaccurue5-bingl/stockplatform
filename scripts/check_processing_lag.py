"""
scripts/check_processing_lag.py
================================
공시 처리 지연 메트릭 모니터링.

측정 항목:
  1. Capture → Analysis 지연 (updated_at - created_at)
     - 파이프라인 병목 감지 (Groq 응답 지연, 백로그 등)
  2. 당일 수집률 (rcept_dt == DATE(created_at))
     - 크롤러 적시성 (DART 공시 → 당일 DB 저장)
  3. 일별 처리 건수 추이

사용법:
  python scripts/check_processing_lag.py          # 최근 14일
  python scripts/check_processing_lag.py --days 30
  python scripts/check_processing_lag.py --today  # 오늘만
  python scripts/check_processing_lag.py --alert  # 임계치 초과 시 비정상 종료 (CI/CD용)
"""

import os
import sys
import argparse
from datetime import datetime, timedelta, timezone
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from utils.env_loader import load_env
load_env()

try:
    from supabase import create_client
except ImportError:
    print("[ERROR] supabase 패키지 필요: pip install supabase")
    sys.exit(1)


# ── 임계치 (--alert 모드) ────────────────────────────────────────────────────
ALERT_P90_MINUTES   = 30   # p90 지연 30분 초과 → 경고
ALERT_SAME_DAY_RATE = 80   # 당일 수집률 80% 미만 → 경고


def get_supabase():
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("[ERROR] Supabase 환경변수 누락")
        sys.exit(1)
    return create_client(url, key)


def parse_dt(s: str | None) -> datetime | None:
    """ISO 8601 문자열 → datetime (UTC aware)"""
    if not s:
        return None
    try:
        # '+00:00' or 'Z' suffix 처리
        s = s.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except ValueError:
        return None


def lag_minutes(created: str | None, updated: str | None) -> float | None:
    c = parse_dt(created)
    u = parse_dt(updated)
    if c is None or u is None:
        return None
    delta = (u - c).total_seconds() / 60.0
    return delta if delta >= 0 else None


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    sv = sorted(values)
    idx = (len(sv) - 1) * p / 100.0
    lo, hi = int(idx), min(int(idx) + 1, len(sv) - 1)
    return sv[lo] + (sv[hi] - sv[lo]) * (idx - lo)


def load_rows(sb, since_date: str) -> list[dict]:
    """since_date(YYYY-MM-DD) 이후 completed 공시 전체 로드."""
    rows = []
    offset = 0
    while True:
        resp = (
            sb.table("disclosure_insights")
            .select("created_at, updated_at, rcept_dt, analysis_status")
            .eq("analysis_status", "completed")
            .gte("created_at", since_date)
            .order("created_at", desc=False)
            .range(offset, offset + 999)
            .execute()
        )
        page = resp.data or []
        rows.extend(page)
        if len(page) < 1000:
            break
        offset += 1000
    return rows


def compute_daily_stats(rows: list[dict]) -> list[dict]:
    """날짜별 집계."""
    by_date: dict[str, dict] = {}

    for r in rows:
        c_dt = parse_dt(r.get("created_at"))
        if c_dt is None:
            continue
        date_key = c_dt.strftime("%Y-%m-%d")

        if date_key not in by_date:
            by_date[date_key] = {
                "date": date_key,
                "count": 0,
                "lags": [],
                "same_day": 0,
            }

        d = by_date[date_key]
        d["count"] += 1

        lag = lag_minutes(r.get("created_at"), r.get("updated_at"))
        if lag is not None and lag < 24 * 60:   # 24시간 초과는 이상치로 제외
            d["lags"].append(lag)

        # 당일 수집: rcept_dt(YYYYMMDD) == created_at 날짜
        rcept = str(r.get("rcept_dt") or "")
        if len(rcept) == 8:
            rcept_fmt = f"{rcept[:4]}-{rcept[4:6]}-{rcept[6:]}"
            if rcept_fmt == date_key:
                d["same_day"] += 1

    result = []
    for date_key in sorted(by_date.keys()):
        d = by_date[date_key]
        lags = d["lags"]
        same_day_rate = round(d["same_day"] / d["count"] * 100, 1) if d["count"] else 0

        result.append({
            "date":          date_key,
            "count":         d["count"],
            "avg_lag":       round(sum(lags) / len(lags), 1) if lags else None,
            "med_lag":       round(percentile(lags, 50), 1) if lags else None,
            "p90_lag":       round(percentile(lags, 90), 1) if lags else None,
            "p99_lag":       round(percentile(lags, 99), 1) if lags else None,
            "same_day_rate": same_day_rate,
            "lag_count":     len(lags),
        })
    return result


def print_table(stats: list[dict]):
    header = (
        f"{'Date':12s}  {'Count':>5}  "
        f"{'Avg':>7}  {'Med':>7}  {'P90':>7}  {'P99':>7}  "
        f"{'SameDay%':>9}"
    )
    sep = "-" * len(header)
    print(header)
    print(sep)

    for s in stats:
        avg = f"{s['avg_lag']:6.1f}m" if s["avg_lag"] is not None else "     N/A"
        med = f"{s['med_lag']:6.1f}m" if s["med_lag"] is not None else "     N/A"
        p90 = f"{s['p90_lag']:6.1f}m" if s["p90_lag"] is not None else "     N/A"
        p99 = f"{s['p99_lag']:6.1f}m" if s["p99_lag"] is not None else "     N/A"

        # P90 경고 표시
        p90_flag = " !" if (s["p90_lag"] or 0) > ALERT_P90_MINUTES else "  "
        sd_flag  = " !" if s["same_day_rate"] < ALERT_SAME_DAY_RATE and s["count"] >= 5 else "  "

        print(
            f"{s['date']:12s}  {s['count']:5d}  "
            f"{avg}  {med}  {p90}{p90_flag} {p99}  "
            f"{s['same_day_rate']:8.1f}%{sd_flag}"
        )

    print(sep)


def print_summary(stats: list[dict]):
    all_lags = []
    total_count = 0
    total_same_day = 0

    for s in stats:
        total_count  += s["count"]
        total_same_day += round(s["count"] * s["same_day_rate"] / 100)
        # p90_lag로 전체 분포 재현은 불가 → avg/count 기반 가중 평균
        if s["avg_lag"] is not None and s["lag_count"] > 0:
            all_lags.extend([s["avg_lag"]] * s["lag_count"])  # 근사값

    overall_avg  = round(sum(all_lags) / len(all_lags), 1) if all_lags else None
    overall_p90  = round(percentile(all_lags, 90), 1) if all_lags else None
    overall_sd   = round(total_same_day / total_count * 100, 1) if total_count else 0

    print(f"\n  기간 합계: {total_count:,}건 분석 완료")
    if overall_avg is not None:
        print(f"  평균 처리 지연: {overall_avg}분  |  P90: {overall_p90}분")
    print(f"  당일 수집률: {overall_sd}%")
    print()
    print("  [!] = 임계치 초과 (P90 > 30분, 당일수집률 < 80%)")
    print()


def main():
    parser = argparse.ArgumentParser(description="공시 처리 지연 모니터링")
    parser.add_argument("--days",  type=int, default=14, help="조회 기간 (일, default=14)")
    parser.add_argument("--today", action="store_true",  help="오늘 하루만 조회")
    parser.add_argument("--alert", action="store_true",  help="임계치 초과 시 exit(1) (CI/CD용)")
    args = parser.parse_args()

    if args.today:
        since = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    else:
        since = (datetime.now(timezone.utc) - timedelta(days=args.days)).strftime("%Y-%m-%d")

    sb = get_supabase()

    print("=" * 72)
    print("  공시 처리 지연 메트릭")
    print(f"  기간: {since} ~ 오늘  |  크롤러 주기: 15분 (장중)")
    print("  지연 = AI 분석 완료(updated_at) - 최초 캡처(created_at)")
    print("=" * 72)
    print()

    rows = load_rows(sb, since)
    if not rows:
        print("  [정보] 해당 기간 completed 공시 없음")
        sys.exit(0)

    stats = compute_daily_stats(rows)
    print_table(stats)
    print_summary(stats)

    # --alert 모드: 최근 3일 p90이 임계치 초과하면 exit(1)
    if args.alert:
        recent = stats[-3:] if len(stats) >= 3 else stats
        violations = [
            s for s in recent
            if (s["p90_lag"] or 0) > ALERT_P90_MINUTES
            or (s["same_day_rate"] < ALERT_SAME_DAY_RATE and s["count"] >= 5)
        ]
        if violations:
            print("[ALERT] 처리 지연 임계치 초과:")
            for v in violations:
                print(f"  {v['date']}: P90={v['p90_lag']}m, 당일수집={v['same_day_rate']}%")
            sys.exit(1)
        print("[OK] 처리 지연 정상 범위")


if __name__ == "__main__":
    main()
