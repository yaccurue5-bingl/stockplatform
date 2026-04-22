"""
scripts/backfill_prices.py
===========================
과거 공시에 가격(t0/t3/t5/t20)과 수익률(return_3d/return_5d/return_20d)을 붙이고
event_stats 테이블을 갱신하는 백필 스크립트.

[변경 이력]
  - T+3 수익률(future_return_3d) 추가 (backtest 엔진 T+3 exit 전략용)
  - fetch_disclosures: return_3d OR return_5d 누락 시 재처리

[실행 흐름]
  Step 1 : disclosure_insights 에서 event_type 있는 공시 조회 (return 없는 것)
  Step 2 : 필요한 날짜 목록 수집 (t0, t0+5일, t0+7일, t0+28일 영업일 보정)
  Step 3 : data.go.kr 에서 날짜별 종가 수집 (배치, 날짜 × 종목)
  Step 4 : return_3d / return_5d / return_20d 계산 → scores_log upsert
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
T3_CALENDAR_DAYS  = 5    # 3 영업일 ≒ 5 달력일 (주말 포함 보정)
T5_CALENDAR_DAYS  = 7    # 5 영업일 ≒ 7 달력일
T20_CALENDAR_DAYS = 28   # 20 영업일 ≒ 28 달력일

# 시총 버킷 기준 (KRW) — companies.market_cap 분포 P33/P67 기반
# P33 ≈ 65B KRW, P67 ≈ 245B KRW  (2026-04 기준)
CAP_LARGE = 245_000_000_000   # 2,450억 이상 → 대형주
CAP_MID   =  65_000_000_000   # 650억 이상   → 중형주
# 650억 미만                                 → 소형주


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


def get_cap_bucket(market_cap: int | None) -> str:
    """시총 기준 버킷 분류: LARGE / MID / SMALL"""
    if not market_cap or market_cap <= 0:
        return 'SMALL'
    if market_cap >= CAP_LARGE:
        return 'LARGE'
    if market_cap >= CAP_MID:
        return 'MID'
    return 'SMALL'


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


def _paginate(sb, table: str, filters_fn, page_size: int = 1000) -> list[dict]:
    """
    Supabase 기본 max_rows=1000 캡을 우회하기 위한 페이지네이션 헬퍼.
    filters_fn(query) → query 형태로 필터/정렬을 주입받음.
    """
    rows = []
    offset = 0
    while True:
        q = sb.table(table)
        q = filters_fn(q)
        q = q.range(offset, offset + page_size - 1)
        resp = q.execute()
        page = resp.data or []
        rows.extend(page)
        if len(page) < page_size:
            break
        offset += page_size
    return rows


def fetch_disclosures(sb, days: int) -> list[dict]:
    """
    event_type 있고 stock_code 있는 공시 조회.
    scores_log 에 future_return_3d / future_return_5d 없는 것만 (미처리).

    ※ disclosure_insights.rcept_dt 는 YYYYMMDD(8자리) 형식으로 저장됨.
      Supabase 기본 max_rows=1000 캡을 우회하기 위해 페이지네이션 사용.
    """
    since_yyyymm = (date.today() - timedelta(days=days)).strftime("%Y%m%d")

    def _filters(q):
        return (
            q.select("id, stock_code, rcept_dt, event_type")
             .gte("rcept_dt", since_yyyymm)
             .not_.is_("event_type", "null")
             .not_.is_("stock_code", "null")
             .eq("analysis_status", "completed")
             .order("rcept_dt", desc=False)
        )

    all_rows = _paginate(sb, "disclosure_insights", _filters)

    if not all_rows:
        return []

    logger.info(f"  → 공시 조회 합계: {len(all_rows)}건")

    # scores_log 에 return_3d AND return_5d 모두 있는 것만 제외
    # → 둘 중 하나라도 없으면 재처리 (return_3d 신규 추가 시 기존 데이터 백필 포함)
    disc_ids = [r["id"] for r in all_rows]
    chunk = 500
    existing_ids: set[str] = set()
    for i in range(0, len(disc_ids), chunk):
        batch = disc_ids[i:i + chunk]
        ex_resp = (
            sb.table("scores_log")
            .select("disclosure_id")
            .in_("disclosure_id", batch)
            .not_.is_("future_return_3d", "null")
            .not_.is_("future_return_5d", "null")
            .execute()
        )
        for r in (ex_resp.data or []):
            existing_ids.add(r["disclosure_id"])

    return [r for r in all_rows if r["id"] not in existing_ids]


def upsert_returns(sb, rows: list[dict], dry_run: bool) -> tuple[int, int]:
    """
    scores_log 에 future_return_3d / future_return_5d / future_return_20d upsert.
    rows: [{stock_code, date, disclosure_id, future_return_3d, future_return_5d, future_return_20d}, ...]
    """
    if dry_run:
        logger.info(f"  [DRY] {len(rows)}건 수익률 저장 생략")
        for r in rows[:3]:
            r3  = r.get('future_return_3d')
            r5  = r.get('future_return_5d')
            r20 = r.get('future_return_20d')
            logger.info(f"    {r['stock_code']} {r['date']} "
                        f"r3={f'{r3:.2f}%' if r3 is not None else 'N/A'}  "
                        f"r5={f'{r5:.2f}%' if r5 is not None else 'N/A'}  "
                        f"r20={f'{r20:.2f}%' if r20 is not None else 'N/A'}")
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

MIN_SAMPLE = 50   # 최소 표본 수 미달 시 event_stats 제외

_GRADE_THRESHOLDS = [
    (75, 'A'),   # High Positive Signal
    (60, 'B'),   # Moderate Positive Signal
    (45, 'C'),   # Neutral
    (30, 'D'),   # Weak Signal
    (0,  'F'),   # Low Signal
]


def _compute_signal_v2(
    median_5d: float,
    std_5d: float,
    n_clean: int,
) -> tuple[int, float, str, float]:
    """
    Risk-adjusted signal score (Sharpe-style).

    1. risk_adj = median_5d / std_5d  → clip [-1, 1]
    2. base_score = (risk_adj + 1) / 2 * 100   → [0, 100]
    3. confidence = min(1.0, n_clean / 300)
    4. final_score = base_score * (0.6 + 0.4 * confidence)

    Returns: (score 0-100, confidence 0-1, grade A-F, risk_adj_return)
    """
    if std_5d == 0:
        r = 0.0
    else:
        r = median_5d / std_5d

    r = max(-1.0, min(1.0, r))
    base_score  = (r + 1) / 2 * 100
    confidence  = min(1.0, n_clean / 300)
    final_score = base_score * (0.6 + 0.4 * confidence)
    score       = round(final_score)

    grade = 'F'
    for threshold, g in _GRADE_THRESHOLDS:
        if score >= threshold:
            grade = g
            break

    return score, round(confidence, 2), grade, round(r, 3)


def _winsorize(vals: list[float], lo_pct: float = 0.05, hi_pct: float = 0.95) -> list[float]:
    """5th~95th percentile 범위 밖 outlier 제거."""
    if len(vals) < 10:
        return vals
    sv = sorted(vals)
    n  = len(sv)
    lo = sv[int(n * lo_pct)]
    hi = sv[min(int(n * hi_pct), n - 1)]
    return [v for v in vals if lo <= v <= hi]


def _median(vals: list[float]) -> float | None:
    if not vals:
        return None
    sv  = sorted(vals)
    n   = len(sv)
    mid = n // 2
    return sv[mid] if n % 2 else (sv[mid - 1] + sv[mid]) / 2


def _std(vals: list[float]) -> float:
    if len(vals) < 2:
        return 0.0
    n = len(vals)
    m = sum(vals) / n
    return math.sqrt(sum((v - m) ** 2 for v in vals) / (n - 1))


def compute_event_stats(sb, dry_run: bool) -> int:
    """
    scores_log → event_stats 집계 및 upsert.

    개선 사항:
      1. Winsorize (5th~95th percentile): outlier 제거
      2. n < MIN_SAMPLE(50) 필터: 통계적으로 무의미한 이벤트 제외
      3. median 추가: avg 왜곡 보정
    """
    logger.info("\n  event_stats 집계 중...")

    def _sl_filters(q):
        return (
            q.select("disclosure_id, stock_code, future_return_5d, future_return_20d")
             .not_.is_("future_return_5d", "null")
        )
    log_rows = _paginate(sb, "scores_log", _sl_filters)

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

    # 시총 맵 로드 (Z-score 버킷 분류용)
    logger.info("  → 시총 데이터 로드 중...")
    cap_resp = sb.table("companies").select("stock_code, market_cap").not_.is_("market_cap", "null").execute()
    cap_map: dict[str, int] = {}
    for c in (cap_resp.data or []):
        if c.get("market_cap"):
            cap_map[c["stock_code"]] = int(c["market_cap"])

    # 버킷별 전체 수익률 수집 (시장 베이스라인 계산용 — 이벤트 무관)
    bucket_all: dict[str, list[float]] = {'LARGE': [], 'MID': [], 'SMALL': []}
    for row in log_rows:
        code   = row.get("stock_code", "")
        bucket = get_cap_bucket(cap_map.get(code))
        r5     = row.get("future_return_5d")
        if r5 is not None:
            bucket_all[bucket].append(float(r5))

    # 버킷별 시장 평균/표준편차 (Z-score 분모)
    bucket_baseline: dict[str, dict] = {}
    for bkt, rets in bucket_all.items():
        if len(rets) >= 10:
            mean = sum(rets) / len(rets)
            std  = _std(rets)
            bucket_baseline[bkt] = {'mean': mean, 'std': max(std, 0.01)}
            logger.info(f"    {bkt}: n={len(rets)} mean={mean:+.2f}% std={std:.2f}%")

    # 이벤트별 raw 버킷 (수익률 + 버킷 레이블 함께 보관)
    buckets:      dict[str, list[float]] = defaultdict(list)
    buckets20:    dict[str, list[float]] = defaultdict(list)
    # 버킷별 수익률: {event_type: {bucket: [returns]}}
    ev_bucket_r5: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))

    for row in log_rows:
        eid    = row.get("disclosure_id")
        ev     = id_to_event.get(eid)
        code   = row.get("stock_code", "")
        bucket = get_cap_bucket(cap_map.get(code))
        if not ev:
            continue
        r5  = row.get("future_return_5d")
        r20 = row.get("future_return_20d")
        if r5 is not None:
            buckets[ev].append(float(r5))
            ev_bucket_r5[ev][bucket].append(float(r5))
        if r20 is not None:
            buckets20[ev].append(float(r20))

    now_iso    = datetime.now().isoformat()
    stats_rows = []
    skipped    = []

    for ev, vals5_raw in buckets.items():
        n_raw = len(vals5_raw)

        # ① 최소 표본 필터
        if n_raw < MIN_SAMPLE:
            skipped.append(f"{ev}(n={n_raw})")
            continue

        # ② Winsorize (5~95%)
        vals5  = _winsorize(vals5_raw)
        vals20_raw = buckets20.get(ev, [])
        vals20 = _winsorize(vals20_raw) if len(vals20_raw) >= 10 else vals20_raw

        n_clean = len(vals5)
        avg5    = sum(vals5) / n_clean
        med5    = _median(vals5)
        std5    = _std(vals5)

        avg20 = sum(vals20) / len(vals20) if vals20 else None
        med20 = _median(vals20) if vals20 else None

        # Signal Score v2 (risk-adjusted)
        sig_score, sig_conf, sig_grade, risk_adj = _compute_signal_v2(
            median_5d=med5 or 0.0,
            std_5d=std5,
            n_clean=n_clean,
        )

        # 버킷별 Z-score 계산
        z_by_bucket: dict[str, float | None] = {}
        n_by_bucket: dict[str, int] = {}
        for bkt in ('LARGE', 'MID', 'SMALL'):
            raw_bkt = ev_bucket_r5.get(ev, {}).get(bkt, [])
            base = bucket_baseline.get(bkt)
            n_by_bucket[bkt] = len(raw_bkt)
            if len(raw_bkt) >= 5 and base:
                clean_bkt = _winsorize(raw_bkt) if len(raw_bkt) >= 10 else raw_bkt
                avg_bkt   = sum(clean_bkt) / len(clean_bkt)
                z = (avg_bkt - base['mean']) / base['std']
                z_by_bucket[bkt] = round(max(-3.0, min(3.0, z)), 4)
            else:
                z_by_bucket[bkt] = None

        stats_rows.append({
            "event_type":        ev,
            "avg_5d_return":     round(avg5,  4),
            "avg_20d_return":    round(avg20, 4) if avg20 is not None else None,
            "median_5d_return":  round(med5,  4) if med5  is not None else None,
            "median_20d_return": round(med20, 4) if med20 is not None else None,
            "std_5d":            round(std5,  4),
            "sample_size":       n_raw,
            "sample_size_clean": n_clean,
            "signal_score":      sig_score,
            "signal_confidence": sig_conf,
            "signal_grade":      sig_grade,
            "risk_adj_return":   risk_adj,
            "avg_z_5d_large":    z_by_bucket.get('LARGE'),
            "avg_z_5d_mid":      z_by_bucket.get('MID'),
            "avg_z_5d_small":    z_by_bucket.get('SMALL'),
            "n_large":           n_by_bucket.get('LARGE', 0),
            "n_mid":             n_by_bucket.get('MID',   0),
            "n_small":           n_by_bucket.get('SMALL', 0),
            "updated_at":        now_iso,
        })

    if skipped:
        logger.info(f"  → n<{MIN_SAMPLE} 제외: {', '.join(skipped)}")

    logger.info(f"  → {len(stats_rows)}개 이벤트 유형 집계 완료")
    for r in stats_rows:
        med_str = f"{r['median_5d_return']:+.2f}%" if r["median_5d_return"] is not None else "N/A"
        logger.info(
            f"    {r['event_type']:20s} "
            f"n={r['sample_size']:4d}(→{r['sample_size_clean']:4d})  "
            f"avg5d={r['avg_5d_return']:+.2f}%  med5d={med_str}  std={r['std_5d']:.2f}  "
            f"score={r['signal_score']}({r['signal_grade']})  conf={r['signal_confidence']:.2f}"
        )

    if dry_run:
        logger.info("  [DRY] event_stats 저장 생략")
        return len(stats_rows)

    try:
        sb.table("event_stats").upsert(
            stats_rows, on_conflict="event_type"
        ).execute()
        logger.info(f"  [OK] event_stats {len(stats_rows)}건 upsert 완료")
    except Exception as e:
        logger.error(f"  [ERR] event_stats 저장 실패: {e}")

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
        logger.info("  처리할 공시 없음 (return_3d / return_5d 모두 산출 완료)")
        compute_event_stats(sb, args.dry_run)
        sys.exit(0)

    logger.info(f"  → {len(disclosures)}건 (수익률 미산출)")

    # ── Step 2: 필요한 날짜 수집 ─────────────────────────────────────────────
    logger.info("\n  [2/5] 필요 날짜 계산 중...")

    # disc별 t0/t3/t5/t20 날짜 결정
    disc_dates: list[dict] = []   # {id, stock_code, date_t0, date_t3, date_t5, date_t20, event_type}
    needed_dates: set[str] = set()

    for d in disclosures:
        rdt = str(d.get("rcept_dt") or "").strip()
        # rcept_dt 는 YYYYMMDD(8자리) 또는 YYYY-MM-DD(10자리) 두 형식이 혼재
        try:
            if len(rdt) == 8:
                rdt_date = datetime.strptime(rdt, "%Y%m%d").date()
            elif len(rdt) == 10:
                rdt_date = datetime.strptime(rdt, "%Y-%m-%d").date()
            else:
                continue
        except ValueError:
            continue

        # scores_log.date 는 raw rcept_dt 기준 (compute_base_score 와 동일하게 유지)
        # → 주말 공시여도 날짜 조정 없이 원본 사용해야 upsert 충돌키가 일치
        rcept_dt_iso = rdt_date.isoformat()   # scores_log 저장용 (raw)

        # 가격 조회용 날짜: 공시일 D 다음 영업일(D+1)을 기준가로 사용
        # (data.go.kr는 D+1 오후에 D+1 종가를 제공하므로 D+1이 시장 반응가)
        # ※ next_business_day(D)는 D가 영업일이면 D 그대로 반환하므로
        #   반드시 D+1(= D + 1일)부터 탐색해야 진짜 D+1 영업일이 됨
        t0  = next_business_day(rdt_date + timedelta(days=1))
        t3  = offset_business_day(t0, T3_CALENDAR_DAYS)
        t5  = offset_business_day(t0, T5_CALENDAR_DAYS)
        t20 = offset_business_day(t0, T20_CALENDAR_DAYS)

        # 미래 날짜 스킵 (오늘 이후)
        today = date.today()
        if t3 > today:
            continue    # t3 아직 미도래 → 수익률 계산 불가

        disc_dates.append({
            "id":           d["id"],
            "stock_code":   d["stock_code"],
            "date_t0":      t0.strftime("%Y%m%d"),
            "date_t3":      t3.strftime("%Y%m%d"),
            "date_t5":      t5.strftime("%Y%m%d") if t5 <= today else None,
            "date_t20":     t20.strftime("%Y%m%d") if t20 <= today else None,
            "event_type":   d["event_type"],
            "rcept_dt_iso": rcept_dt_iso,   # raw rcept_dt (영업일 보정 없음)
        })
        needed_dates.add(t0.strftime("%Y%m%d"))
        needed_dates.add(t3.strftime("%Y%m%d"))
        if t5 <= today:
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
        code = d["stock_code"]
        dt0  = d["date_t0"]
        dt3  = d["date_t3"]
        dt5  = d["date_t5"]
        dt20 = d["date_t20"]

        p0  = price_cache.get(dt0, {}).get(code)
        p3  = price_cache.get(dt3, {}).get(code)
        p5  = price_cache.get(dt5, {}).get(code) if dt5 else None
        p20 = price_cache.get(dt20, {}).get(code) if dt20 else None

        # t0(기준가) 또는 t3(최소 exit) 없으면 스킵
        if not p0 or not p3:
            skipped += 1
            continue

        r3  = round((p3  - p0) / p0 * 100, 4)
        r5  = round((p5  - p0) / p0 * 100, 4) if p5  and p0 else None
        r20 = round((p20 - p0) / p0 * 100, 4) if p20 and p0 else None

        return_rows.append({
            "stock_code":        code,
            "date":              d["rcept_dt_iso"],
            "disclosure_id":     d["id"],
            "future_return_3d":  r3,
            "future_return_5d":  r5,
            "future_return_20d": r20,
        })

    logger.info(f"  → 수익률 산출: {len(return_rows)}건 / 스킵(가격없음): {skipped}건")

    if return_rows:
        r3_vals = [r["future_return_3d"] for r in return_rows]
        r5_vals = [r["future_return_5d"] for r in return_rows if r["future_return_5d"] is not None]
        logger.info(f"  return_3d: min={min(r3_vals):.2f}%  max={max(r3_vals):.2f}%  "
                    f"avg={sum(r3_vals)/len(r3_vals):.2f}%")
        if r5_vals:
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
