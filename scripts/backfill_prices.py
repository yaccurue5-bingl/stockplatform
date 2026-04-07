"""
scripts/backfill_prices.py
===========================
과거 공시에 가격(t0/t5/t20)과 수익률(return_5d/return_20d)을 붙이고
event_stats 테이블을 갱신하는 백필 스크립트.

[사용자 pseudocode 개선 사항]
  - disclosures → disclosure_insights (실제 테이블명)
  - price_t0/t5/t20 → scores_log.future_return_5d / future_return_20d (실제 스키마)
  - yfinance 금지 → data.go.kr GetStockSecuritiesInfoService (basDt 파라미터)
  - processed 컬럼 없음 → scores_log 존재 여부로 판별
  - timedelta(days=7) → 영업일 보정 포함
  - event_stats SQL 집계 → Python 집계 후 upsert

[실행 흐름]
  Step 1 : disclosure_insights 에서 event_type 있는 공시 조회 (return 없는 것)
  Step 2 : 필요한 날짜 목록 수집 (t0, t0+7일, t0+28일 영업일 보정)
  Step 3 : data.go.kr 에서 날짜별 종가 수집 (배치, 날짜 × 종목)
  Step 4 : return_5d / return_20d 계산 → scores_log upsert
  Step 5 : scores_log 집계 → event_stats upsert

[API 제한]
  data.go.kr 는 basDt 기준으로 당일 전체 종목 시세를 한 번에 반환.
  날짜별 1회 호출로 전 종목 커버 가능 → 효율적.

사용법:
  python scripts/backfill_prices.py                  # 최근 90일
  python scripts/backfill_prices.py --days 180       # 최근 180일
  python scripts/backfill_prices.py --dry-run        # 계산만, DB 저장 안 함
  python scripts/backfill_prices.py --stats-only     # 가격 fetch 없이 event_stats 재집계만
"""

import os
import sys
import math
import time
import argparse
import logging
import requests
from datetime import datetime, timedelta, timezone, date
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

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("backfill_prices")

# ── 설정 ──────────────────────────────────────────────────────────────────────

API_BASE      = "https://apis.data.go.kr/1160100/service/GetStockSecuritiesInfoService/getStockPriceInfo"
API_SLEEP_SEC = 1.0      # data.go.kr 호출 간 sleep
PAGE_SIZE     = 3000     # 한 번에 가져올 종목 수 (전 종목 커버)
BATCH_SIZE    = 200      # Supabase upsert 배치
KST           = timezone(timedelta(hours=9))

# 영업일 offset (달력일 → 영업일 근사)
T5_CALENDAR_DAYS  = 7    # 5 영업일 ≒ 7 달력일
T20_CALENDAR_DAYS = 28   # 20 영업일 ≒ 28 달력일


# ── 영업일 헬퍼 ───────────────────────────────────────────────────────────────

def is_business_day(d: date) -> bool:
    return d.weekday() < 5   # 토(5) 일(6) 제외 (공휴일 미처리)


def next_business_day(d: date) -> date:
    """d 가 영업일이면 d, 아니면 다음 영업일"""
    while not is_business_day(d):
        d += timedelta(days=1)
    return d


def prev_business_day(d: date) -> date:
    while not is_business_day(d):
        d -= timedelta(days=1)
    return d


def offset_business_day(base: date, calendar_days: int) -> date:
    """base + calendar_days 달력일 → 가장 가까운 영업일"""
    target = base + timedelta(days=calendar_days)
    return next_business_day(target)


# ── data.go.kr 가격 조회 ──────────────────────────────────────────────────────

def fetch_prices_for_date(bas_dt: str, api_key: str) -> dict[str, float]:
    """
    특정 날짜(YYYYMMDD)의 전 종목 종가 조회.
    반환: {stock_code: close_price}
    공휴일/주말은 빈 dict 반환.
    """
    params = {
        "serviceKey": api_key,
        "numOfRows":  PAGE_SIZE,
        "pageNo":     1,
        "resultType": "json",
        "basDt":      bas_dt,
        "mrktCls":    "",   # 전체 (KOSPI + KOSDAQ)
    }

    try:
        resp = requests.get(API_BASE, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        logger.warning(f"    API 오류 [{bas_dt}]: {e}")
        return {}

    items = (
        data.get("response", {})
            .get("body", {})
            .get("items", {})
            .get("item", [])
    )

    if not items:
        return {}

    prices: dict[str, float] = {}
    for item in items:
        code  = str(item.get("srtnCd") or "").strip().lstrip("A")
        clpr  = item.get("clpr")   # 종가
        if code and clpr is not None:
            try:
                prices[code] = float(clpr)
            except (ValueError, TypeError):
                pass

    return prices


# ── Supabase ──────────────────────────────────────────────────────────────────

def _get_supabase():
    if _supabase_create_client is None:
        logger.error("supabase 패키지 미설치")
        sys.exit(1)
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.error("Supabase 환경변수 누락")
        sys.exit(1)
    return _supabase_create_client(url, key)


def fetch_disclosures(sb, days: int) -> list[dict]:
    """
    event_type 있고 stock_code 있는 공시 조회.
    scores_log 에 future_return_5d 없는 것만 (미처리).
    """
    since = (date.today() - timedelta(days=days)).strftime("%Y%m%d")

    resp = (
        sb.table("disclosure_insights")
        .select("id, stock_code, rcept_dt, event_type")
        .gte("rcept_dt", since)
        .not_.is_("event_type", "null")
        .not_.is_("stock_code", "null")
        .eq("analysis_status", "completed")
        .order("rcept_dt", desc=False)
        .limit(5000)
        .execute()
    )
    all_rows = resp.data or []

    if not all_rows:
        return []

    # scores_log 에 이미 return_5d 있는 것 제외
    disc_ids = [r["id"] for r in all_rows]
    chunk = 500
    existing_ids: set[str] = set()
    for i in range(0, len(disc_ids), chunk):
        batch = disc_ids[i:i + chunk]
        ex_resp = (
            sb.table("scores_log")
            .select("disclosure_id")
            .in_("disclosure_id", batch)
            .not_.is_("future_return_5d", "null")
            .execute()
        )
        for r in (ex_resp.data or []):
            existing_ids.add(r["disclosure_id"])

    return [r for r in all_rows if r["id"] not in existing_ids]


def upsert_returns(sb, rows: list[dict], dry_run: bool) -> tuple[int, int]:
    """
    scores_log 에 future_return_5d / future_return_20d upsert.
    rows: [{stock_code, date, disclosure_id, future_return_5d, future_return_20d}, ...]
    """
    if dry_run:
        logger.info(f"  [DRY] {len(rows)}건 수익률 저장 생략")
        for r in rows[:3]:
            r20 = r['future_return_20d']
            r20_str = f"{r20:.2f}%" if r20 is not None else "N/A"
            logger.info(f"    {r['stock_code']} {r['date']} "
                        f"r5={r['future_return_5d']:.2f}% r20={r20_str}")
        return len(rows), 0

    success = failure = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i:i + BATCH_SIZE]
        try:
            sb.table("scores_log").upsert(
                batch, on_conflict="stock_code,date,disclosure_id"
            ).execute()
            success += len(batch)
        except Exception as e:
            failure += len(batch)
            logger.error(f"  scores_log upsert 실패: {e}")

    return success, failure


# ── event_stats 집계 ──────────────────────────────────────────────────────────

def compute_event_stats(sb, dry_run: bool) -> int:
    """
    scores_log → event_stats 집계 및 upsert.

    집계 항목:
      avg_5d_return  = AVG(future_return_5d)
      avg_20d_return = AVG(future_return_20d)
      std_5d         = STD(future_return_5d)
      sample_size    = COUNT(*)
    """
    logger.info("\n  event_stats 집계 중...")

    # scores_log 전체 (return 있는 것)
    resp = (
        sb.table("scores_log")
        .select("disclosure_id, future_return_5d, future_return_20d")
        .not_.is_("future_return_5d", "null")
        .limit(50000)
        .execute()
    )
    log_rows = resp.data or []

    if not log_rows:
        logger.info("  → 집계할 데이터 없음")
        return 0

    # disclosure_id → event_type 매핑
    disc_ids = list({r["disclosure_id"] for r in log_rows if r.get("disclosure_id")})
    id_to_event: dict[str, str] = {}
    chunk = 500
    for i in range(0, len(disc_ids), chunk):
        batch = disc_ids[i:i + chunk]
        dr = (
            sb.table("disclosure_insights")
            .select("id, event_type")
            .in_("id", batch)
            .not_.is_("event_type", "null")
            .execute()
        )
        for r in (dr.data or []):
            id_to_event[r["id"]] = r["event_type"]

    # 이벤트별 집계
    buckets: dict[str, list[float]] = defaultdict(list)
    buckets20: dict[str, list[float]] = defaultdict(list)

    for row in log_rows:
        eid = row.get("disclosure_id")
        ev  = id_to_event.get(eid)
        if not ev:
            continue
        r5  = row.get("future_return_5d")
        r20 = row.get("future_return_20d")
        if r5 is not None:
            buckets[ev].append(float(r5))
        if r20 is not None:
            buckets20[ev].append(float(r20))

    def _std(vals: list[float]) -> float:
        if len(vals) < 2:
            return 0.0
        n = len(vals)
        m = sum(vals) / n
        return math.sqrt(sum((v - m) ** 2 for v in vals) / (n - 1))

    now_iso = datetime.now().isoformat()
    stats_rows = []
    for ev, vals5 in buckets.items():
        vals20 = buckets20.get(ev, [])
        avg5   = sum(vals5) / len(vals5)
        avg20  = sum(vals20) / len(vals20) if vals20 else None
        stats_rows.append({
            "event_type":      ev,
            "avg_5d_return":   round(avg5, 4),
            "avg_20d_return":  round(avg20, 4) if avg20 is not None else None,
            "std_5d":          round(_std(vals5), 4),
            "sample_size":     len(vals5),
            "updated_at":      now_iso,
        })

    logger.info(f"  → {len(stats_rows)}개 이벤트 유형 집계 완료")
    for r in stats_rows:
        logger.info(f"    {r['event_type']:20s} n={r['sample_size']:4d}  "
                    f"avg5d={r['avg_5d_return']:+.2f}%  std={r['std_5d']:.2f}")

    if dry_run:
        logger.info("  [DRY] event_stats 저장 생략")
        return len(stats_rows)

    try:
        sb.table("event_stats").upsert(
            stats_rows, on_conflict="event_type"
        ).execute()
        logger.info(f"  ✅ event_stats {len(stats_rows)}건 upsert 완료")
    except Exception as e:
        logger.error(f"  ❌ event_stats 저장 실패: {e}")

    return len(stats_rows)


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="과거 공시 가격/수익률 백필 + event_stats 갱신")
    parser.add_argument("--days",       type=int, default=90,
                        help="소급 기간 일수 (기본 90일)")
    parser.add_argument("--dry-run",    action="store_true",
                        help="계산만, DB 저장 안 함")
    parser.add_argument("--stats-only", action="store_true",
                        help="가격 fetch 없이 event_stats 재집계만 실행")
    args = parser.parse_args()

    logger.info("=" * 55)
    logger.info("  backfill_prices : 가격/수익률 백필")
    logger.info(f"  days={args.days}  dry_run={args.dry_run}  stats_only={args.stats_only}")
    logger.info("=" * 55)

    sb      = _get_supabase()
    api_key = os.environ.get("PUBLIC_DATA_API_KEY")
    if not api_key and not args.stats_only:
        logger.error("PUBLIC_DATA_API_KEY 환경변수 누락")
        sys.exit(1)

    # ── stats-only 모드: 가격 fetch 없이 집계만 ───────────────────────────────
    if args.stats_only:
        compute_event_stats(sb, args.dry_run)
        sys.exit(0)

    # ── Step 1: 공시 조회 ─────────────────────────────────────────────────────
    logger.info("\n  [1/5] 공시 조회 중...")
    disclosures = fetch_disclosures(sb, args.days)

    if not disclosures:
        logger.info("  처리할 공시 없음 (모두 수익률 있음)")
        compute_event_stats(sb, args.dry_run)
        sys.exit(0)

    logger.info(f"  → {len(disclosures)}건 (수익률 미산출)")

    # ── Step 2: 필요한 날짜 수집 ─────────────────────────────────────────────
    logger.info("\n  [2/5] 필요 날짜 계산 중...")

    # disc별 t0/t5/t20 날짜 결정
    disc_dates: list[dict] = []   # {id, stock_code, date_t0, date_t5, date_t20, event_type}
    needed_dates: set[str] = set()

    for d in disclosures:
        rdt = str(d.get("rcept_dt") or "")
        if not rdt or len(rdt) != 8:
            continue
        try:
            t0 = datetime.strptime(rdt, "%Y%m%d").date()
            t0 = next_business_day(t0)   # 공시일이 주말이면 다음 영업일
        except ValueError:
            continue

        t5  = offset_business_day(t0, T5_CALENDAR_DAYS)
        t20 = offset_business_day(t0, T20_CALENDAR_DAYS)

        # 미래 날짜 스킵 (오늘 이후)
        today = date.today()
        if t5 > today:
            continue    # t5 아직 미도래 → 수익률 계산 불가

        disc_dates.append({
            "id":         d["id"],
            "stock_code": d["stock_code"],
            "date_t0":    t0.strftime("%Y%m%d"),
            "date_t5":    t5.strftime("%Y%m%d"),
            "date_t20":   t20.strftime("%Y%m%d") if t20 <= today else None,
            "event_type": d["event_type"],
            "rcept_dt_iso": str(t0),
        })
        needed_dates.add(t0.strftime("%Y%m%d"))
        needed_dates.add(t5.strftime("%Y%m%d"))
        if t20 <= today:
            needed_dates.add(t20.strftime("%Y%m%d"))

    logger.info(f"  → 처리 가능 공시: {len(disc_dates)}건  /  필요 날짜: {len(needed_dates)}개")

    if not disc_dates:
        logger.info("  t5 미도래 공시만 있어 수익률 계산 불가. event_stats 집계 진행.")
        compute_event_stats(sb, args.dry_run)
        sys.exit(0)

    # ── Step 3: data.go.kr 날짜별 가격 수집 ──────────────────────────────────
    logger.info(f"\n  [3/5] data.go.kr 가격 수집 ({len(needed_dates)}일)...")

    price_cache: dict[str, dict[str, float]] = {}   # {YYYYMMDD: {stock_code: close}}

    for i, bas_dt in enumerate(sorted(needed_dates), 1):
        logger.info(f"    ({i}/{len(needed_dates)}) {bas_dt} 조회 중...")
        prices = fetch_prices_for_date(bas_dt, api_key)
        price_cache[bas_dt] = prices
        logger.info(f"    → {len(prices)}종목 종가 수집")
        time.sleep(API_SLEEP_SEC)

    # ── Step 4: 수익률 계산 ──────────────────────────────────────────────────
    logger.info("\n  [4/5] 수익률 계산 중...")

    return_rows: list[dict] = []
    skipped = 0

    for d in disc_dates:
        code  = d["stock_code"]
        dt0   = d["date_t0"]
        dt5   = d["date_t5"]
        dt20  = d["date_t20"]

        p0 = price_cache.get(dt0, {}).get(code)
        p5 = price_cache.get(dt5, {}).get(code)
        p20 = price_cache.get(dt20, {}).get(code) if dt20 else None

        if not p0 or not p5:
            skipped += 1
            continue

        r5  = round((p5 - p0) / p0 * 100, 4)
        r20 = round((p20 - p0) / p0 * 100, 4) if p20 and p0 else None

        return_rows.append({
            "stock_code":       code,
            "date":             d["rcept_dt_iso"],
            "disclosure_id":    d["id"],
            "future_return_5d": r5,
            "future_return_20d": r20,
        })

    logger.info(f"  → 수익률 산출: {len(return_rows)}건 / 스킵(가격없음): {skipped}건")

    if return_rows:
        r5_vals = [r["future_return_5d"] for r in return_rows]
        logger.info(f"  return_5d: min={min(r5_vals):.2f}%  max={max(r5_vals):.2f}%  "
                    f"avg={sum(r5_vals)/len(r5_vals):.2f}%")

    # ── Step 5: DB 저장 + event_stats 집계 ───────────────────────────────────
    logger.info(f"\n  [5/5] scores_log 저장 + event_stats 집계...")

    if return_rows:
        ok, fail = upsert_returns(sb, return_rows, args.dry_run)
        logger.info(f"  scores_log: 성공 {ok}건 / 실패 {fail}건")

    compute_event_stats(sb, args.dry_run)

    logger.info("\n" + "=" * 55)
    logger.info("  backfill_prices 완료")
    logger.info("=" * 55)
    sys.exit(0)


if __name__ == "__main__":
    main()
