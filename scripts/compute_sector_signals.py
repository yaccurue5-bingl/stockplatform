"""
scripts/compute_sector_signals.py
==================================
scores_log + companies 테이블을 JOIN해서 섹터별 성과를 집계하고
sector_signals 테이블에 upsert하는 배치 스크립트.

데이터 소스:
  - scores_log   : stock_code, date, base_score, final_score, future_return_3d
  - companies    : stock_code, sector_en (섹터 분류)
  - daily_indicators : date, foreign_net_buy_kospi (RISK_ON 판단용)

집계 로직:
  1. scores_log 에서 최근 N일 중 future_return_3d IS NOT NULL 인 행 조회
  2. companies 에서 stock_code → sector_en 매핑
  3. daily_indicators 에서 최근 N일 foreign_net_buy_kospi 조회
  4. RISK_ON 날짜: 공시일 직전 3영업일 합계 > 0 → risk_on_ratio 계산
  5. 섹터 score = (win_rate×60 + normalized_return×40) × regime_weight
     regime_weight = 0.8 + risk_on_ratio × 0.4  (0.8 risk-off ~ 1.2 risk-on)
  6. 섹터별 집계 → sector_signals upsert

사용법:
  python scripts/compute_sector_signals.py              # 최근 30일
  python scripts/compute_sector_signals.py --days 90   # 최근 90일
  python scripts/compute_sector_signals.py --dry-run   # 저장 없이 출력만
"""

import os
import sys
import logging
import argparse
from datetime import datetime, timedelta, date
from pathlib import Path
from collections import defaultdict

# ── supabase를 sys.path 수정 전에 먼저 import ─────────────────────────────────
# stockplatform/supabase/ 폴더와의 충돌 방지
try:
    from supabase import create_client as _supabase_create_client
except ImportError:
    _supabase_create_client = None

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from utils.env_loader import load_env
load_env()

# ── 로깅 설정 ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("compute_sector_signals")

# ── 설정 ──────────────────────────────────────────────────────────────────────

DEFAULT_DAYS = 30
BATCH_SIZE   = 50

# 점수 기준 (score 0~100 → signal 매핑)
# score >= 70 → HIGH_CONVICTION
# score >= 55 → CONSTRUCTIVE
# score >= 40 → NEUTRAL
# score >= 25 → NEGATIVE
# score <  25 → HIGH_RISK
HIGH_CONVICTION_THRESHOLD = 70
CONSTRUCTIVE_THRESHOLD    = 55
NEUTRAL_THRESHOLD         = 40
NEGATIVE_THRESHOLD        = 25

# confidence 계산 기준 건수
CONFIDENCE_SCALE = 20   # event_count / 20 (최대 1.0)

# top_stocks 반환 개수
TOP_STOCKS_N = 5

# RISK_ON 판단: 직전 N 영업일 합계
RISK_ON_LOOKBACK_DAYS = 3


# ── Supabase 연결 ─────────────────────────────────────────────────────────────

def get_supabase():
    create_client = _supabase_create_client
    if create_client is None:
        logger.error("supabase 패키지가 설치되지 않았습니다. pip install supabase")
        sys.exit(1)
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        logger.error(
            "Supabase 환경변수 누락 "
            "(NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)"
        )
        sys.exit(1)
    return create_client(url, key)


# ── 페이지네이션 헬퍼 ─────────────────────────────────────────────────────────

def _paginate(sb, table: str, filters_fn, page_size: int = 1000) -> list[dict]:
    """
    Supabase max_rows=1000 캡 우회.
    filters_fn(query) → query (select/filter 적용 후 반환).
    """
    rows: list[dict] = []
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


# ── 날짜 헬퍼 ─────────────────────────────────────────────────────────────────

def is_business_day(d: date) -> bool:
    return d.weekday() < 5  # 토(5), 일(6) 제외


def prev_business_days(ref: date, n: int) -> list[date]:
    """ref 이전 n 개의 영업일 목록 (ref 포함 안 함)"""
    result: list[date] = []
    cur = ref - timedelta(days=1)
    while len(result) < n:
        if is_business_day(cur):
            result.append(cur)
        cur -= timedelta(days=1)
    return result


def date_range_iso(start: date, end: date) -> tuple[str, str]:
    """(YYYY-MM-DD, YYYY-MM-DD)"""
    return start.isoformat(), end.isoformat()


# ── 데이터 조회 ───────────────────────────────────────────────────────────────

def fetch_scores_log(sb, since_iso: str, until_iso: str) -> list[dict]:
    """
    scores_log 에서 future_return_3d IS NOT NULL 인 행 조회.
    date 컬럼은 YYYY-MM-DD ISO 형식 가정.
    """
    logger.info(f"  scores_log 조회 중 ({since_iso} ~ {until_iso})...")

    def filters(q):
        return (
            q.select("stock_code, date, base_score, final_score, future_return_3d")
            .gte("date", since_iso)
            .lte("date", until_iso)
            .not_.is_("future_return_3d", "null")
        )

    rows = _paginate(sb, "scores_log", filters)
    logger.info(f"  scores_log: {len(rows)}건 로드")
    return rows


def fetch_sector_map(sb, stock_codes: list[str]) -> dict[str, str]:
    """companies 테이블에서 stock_code → sector_en 매핑 조회"""
    if not stock_codes:
        return {}

    logger.info(f"  companies 섹터 매핑 조회 중 ({len(stock_codes)}개 종목)...")
    sector_map: dict[str, str] = {}

    chunk_size = 500
    for i in range(0, len(stock_codes), chunk_size):
        chunk = stock_codes[i : i + chunk_size]
        resp = (
            sb.table("companies")
            .select("stock_code, sector_en")
            .in_("stock_code", chunk)
            .not_.is_("sector_en", "null")
            .neq("sector_en", "")
            .execute()
        )
        for row in resp.data or []:
            sc = row.get("stock_code")
            se = row.get("sector_en")
            if sc and se:
                sector_map[sc] = se

    logger.info(f"  sector_en 매핑: {len(sector_map)}개 종목")
    return sector_map


def fetch_foreign_net_buy(sb, since_iso: str, until_iso: str) -> dict[str, float | None]:
    """
    daily_indicators 에서 기간 내 foreign_net_buy_kospi 조회.
    반환: {YYYY-MM-DD: float_or_None}
    """
    logger.info(f"  daily_indicators (외국인 순매수) 조회 중...")
    resp = (
        sb.table("daily_indicators")
        .select("date, foreign_net_buy_kospi")
        .gte("date", since_iso)
        .lte("date", until_iso)
        .execute()
    )
    result: dict[str, float | None] = {}
    for row in resp.data or []:
        d = row.get("date")
        val = row.get("foreign_net_buy_kospi")
        if d:
            try:
                result[d] = float(val) if val is not None else None
            except (ValueError, TypeError):
                result[d] = None
    logger.info(f"  daily_indicators: {len(result)}일치 로드")
    return result


# ── RISK_ON 판단 ──────────────────────────────────────────────────────────────

def build_risk_on_set(
    foreign_net_buy: dict[str, float | None],
    all_dates: set[str],
) -> set[str]:
    """
    공시일 직전 RISK_ON_LOOKBACK_DAYS 영업일의 foreign_net_buy_kospi 합계 > 0 이면
    해당 공시일을 RISK_ON 날짜로 판정.

    반환: RISK_ON 날짜 집합 (YYYY-MM-DD)
    """
    risk_on: set[str] = set()
    for ds in all_dates:
        try:
            ref = datetime.fromisoformat(ds).date()
        except ValueError:
            continue
        lookback = prev_business_days(ref, RISK_ON_LOOKBACK_DAYS)
        total = 0.0
        for bd in lookback:
            val = foreign_net_buy.get(bd.isoformat())
            if val is not None:
                total += val
        if total > 0:
            risk_on.add(ds)
    return risk_on


# ── 섹터별 집계 ───────────────────────────────────────────────────────────────

def normalize_score(values: list[float], v: float) -> float:
    """
    값 목록에서 v 를 0~1 로 min-max 정규화.
    모든 값이 같으면 0.5 반환.
    """
    if not values:
        return 0.5
    mn, mx = min(values), max(values)
    if mx == mn:
        return 0.5
    return (v - mn) / (mx - mn)


def compute_sector_score(
    win_rate: float,
    avg_return_3d: float,
    all_avg_returns: list[float],
    risk_on_ratio: float = 0.5,
) -> float:
    """
    score = (win_rate * 60 + normalized_return * 40) × regime_weight
    regime_weight = 0.8 + risk_on_ratio * 0.4   → 0.8(risk-off) ~ 1.2(risk-on)
    → 0~100 범위
    """
    normalized_return = normalize_score(all_avg_returns, avg_return_3d)
    base = win_rate * 60.0 + normalized_return * 40.0
    regime_weight = 0.8 + float(risk_on_ratio) * 0.4
    raw = base * regime_weight
    return round(max(0.0, min(100.0, raw)), 4)


def signal_from_score(score: float) -> str:
    if score >= HIGH_CONVICTION_THRESHOLD:
        return "HIGH_CONVICTION"
    elif score >= CONSTRUCTIVE_THRESHOLD:
        return "CONSTRUCTIVE"
    elif score >= NEUTRAL_THRESHOLD:
        return "NEUTRAL"
    elif score >= NEGATIVE_THRESHOLD:
        return "NEGATIVE"
    return "HIGH_RISK"


def aggregate_sectors(
    scores_rows: list[dict],
    sector_map: dict[str, str],
    risk_on_dates: set[str],
    upsert_date: str,
) -> list[dict]:
    """
    섹터별로 집계하여 sector_signals 행 목록 반환.
    upsert_date: 저장할 date 값 (YYYYMMDD 또는 YYYY-MM-DD)
    """
    # 섹터별 행 모으기
    buckets: dict[str, list[dict]] = defaultdict(list)
    for row in scores_rows:
        sc = row.get("stock_code")
        se = sector_map.get(sc) if sc else None
        if not se:
            continue  # 섹터 미분류 제외
        buckets[se].append(row)

    if not buckets:
        return []

    # 평균 수익률 목록 (score 정규화용)
    sector_avg_returns: dict[str, float] = {}
    for se, rows in buckets.items():
        returns = [float(r["future_return_3d"]) for r in rows]
        sector_avg_returns[se] = sum(returns) / len(returns)

    all_avg_returns = list(sector_avg_returns.values())

    result: list[dict] = []
    for se, rows in sorted(buckets.items()):
        try:
            returns = [float(r["future_return_3d"]) for r in rows]
            avg_return_3d = sum(returns) / len(returns)
            win_rate = sum(1 for v in returns if v > 0) / len(returns)
            event_count = len(rows)

            # RISK_ON 비율
            risk_on_count = sum(
                1 for r in rows
                if r.get("date") in risk_on_dates
            )
            risk_on_ratio = risk_on_count / event_count if event_count > 0 else 0.0

            # score (RISK_ON regime_weight 반영)
            score = compute_sector_score(win_rate, avg_return_3d, all_avg_returns, risk_on_ratio)
            signal = signal_from_score(score)
            confidence = min(1.0, event_count / CONFIDENCE_SCALE)

            # top_stocks: return_3d 상위 5개
            sorted_rows = sorted(rows, key=lambda r: float(r["future_return_3d"]), reverse=True)
            top_stocks = [
                {
                    "stock_code": r.get("stock_code"),
                    "return_3d":  round(float(r["future_return_3d"]), 6),
                    "base_score": round(float(r["base_score"]), 4) if r.get("base_score") is not None else None,
                }
                for r in sorted_rows[:TOP_STOCKS_N]
            ]

            result.append({
                "date":             upsert_date,
                "sector_en":        se,
                "sector":           se,        # sector 컬럼 = sector_en 과 동일
                "signal":           signal,
                "confidence":       round(confidence, 4),
                "disclosure_count": event_count,
                "avg_return_3d":    round(avg_return_3d, 6),
                "win_rate":         round(win_rate, 4),
                "score":            score,
                "risk_on_ratio":    round(risk_on_ratio, 4),
                "top_stocks":       top_stocks,
                "created_at":       datetime.utcnow().isoformat() + "Z",
            })

        except Exception as e:
            logger.warning(f"  [SKIP] 섹터 '{se}' 집계 중 오류: {e}")
            continue

    return result


# ── Supabase 저장 ─────────────────────────────────────────────────────────────

def save_to_db(sb, rows: list[dict]) -> tuple[int, int]:
    """배치 upsert → (성공 수, 실패 수)"""
    success = failure = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        bn = i // BATCH_SIZE + 1
        try:
            sb.table("sector_signals").upsert(
                batch,
                on_conflict="date,sector_en",
            ).execute()
            success += len(batch)
            logger.info(f"  Batch {bn} 저장 완료 ({len(batch)}건)")
        except Exception as e:
            failure += len(batch)
            logger.error(f"  Batch {bn} 저장 실패: {e}")
    return success, failure


# ── 결과 출력 ─────────────────────────────────────────────────────────────────

def print_results(rows: list[dict]) -> None:
    if not rows:
        logger.info("  집계 결과 없음")
        return

    print()
    header = (
        f"{'섹터':<40} {'Signal':<8} {'Score':>6}  {'Conf':>5}  "
        f"{'건수':>4}  {'WinRate':>7}  {'AvgRet':>7}  {'RiskOn':>6}"
    )
    print(header)
    print("-" * len(header))
    for r in rows:
        print(
            f"{r['sector_en']:<40} {r['signal']:<8} {r['score']:>6.1f}  "
            f"{r['confidence']:>5.3f}  {r['disclosure_count']:>4}  "
            f"{r['win_rate']:>7.1%}  {r['avg_return_3d']:>+7.4f}  "
            f"{r['risk_on_ratio']:>6.1%}"
        )
    print()


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="섹터 신호 집계 (scores_log + companies → sector_signals)"
    )
    parser.add_argument(
        "--days",
        type=int,
        default=DEFAULT_DAYS,
        help=f"집계 기간 (기본 {DEFAULT_DAYS}일)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="DB 저장 없이 출력만",
    )
    parser.add_argument(
        "--date",
        help="upsert 기준일 (YYYYMMDD). 미지정 시 오늘 날짜 사용",
    )
    args = parser.parse_args()

    today = datetime.now().date()
    since = today - timedelta(days=args.days)
    since_iso, until_iso = date_range_iso(since, today)

    # upsert 에 저장할 date 값: YYYY-MM-DD (ISO) 형식으로 통일
    if args.date:
        try:
            upsert_date = datetime.strptime(args.date, "%Y%m%d").date().isoformat()
        except ValueError:
            upsert_date = args.date
    else:
        upsert_date = today.isoformat()

    logger.info("=" * 60)
    logger.info("섹터 신호 집계 (scores_log 기반)")
    logger.info(f"  집계 기간: {since_iso} ~ {until_iso} ({args.days}일)")
    logger.info(f"  저장 date: {upsert_date}")
    logger.info(f"  모드:      {'DRY-RUN' if args.dry_run else '실제 저장'}")
    logger.info("=" * 60)

    sb = get_supabase()

    # ── 1. scores_log 조회 ────────────────────────────────────────────────────
    scores_rows = fetch_scores_log(sb, since_iso, until_iso)
    if not scores_rows:
        logger.warning("집계할 scores_log 데이터가 없습니다.")
        logger.warning("  - future_return_3d 가 채워져 있는지 확인 (backfill_prices.py 먼저 실행)")
        sys.exit(0)

    # ── 2. companies 섹터 매핑 조회 ───────────────────────────────────────────
    stock_codes = list({r["stock_code"] for r in scores_rows if r.get("stock_code")})
    sector_map = fetch_sector_map(sb, stock_codes)

    mapped_count = sum(1 for r in scores_rows if sector_map.get(r.get("stock_code")))
    logger.info(f"  섹터 매핑된 공시: {mapped_count}/{len(scores_rows)}건")

    if not sector_map:
        logger.warning("섹터 매핑 정보가 없습니다. companies.sector_en 컬럼을 확인하세요.")
        sys.exit(0)

    # ── 3. daily_indicators 조회 ──────────────────────────────────────────────
    # scores_log 에서 사용된 날짜 범위보다 약간 넓게 조회 (직전 3영업일 합산 위해)
    extra_since = (since - timedelta(days=7)).isoformat()
    foreign_net_buy = fetch_foreign_net_buy(sb, extra_since, until_iso)

    # ── 4. RISK_ON 날짜 집합 산출 ────────────────────────────────────────────
    all_dates = {r["date"] for r in scores_rows if r.get("date")}
    risk_on_dates = build_risk_on_set(foreign_net_buy, all_dates)
    logger.info(f"  RISK_ON 날짜: {len(risk_on_dates)}/{len(all_dates)}일")

    # ── 5. 섹터별 집계 ────────────────────────────────────────────────────────
    logger.info("  섹터별 집계 중...")
    agg_rows = aggregate_sectors(scores_rows, sector_map, risk_on_dates, upsert_date)
    logger.info(f"  집계 완료: {len(agg_rows)}개 섹터")

    if not agg_rows:
        logger.warning("집계 결과가 없습니다. 섹터 분류 데이터를 확인하세요.")
        sys.exit(0)

    # ── 6. 결과 출력 ──────────────────────────────────────────────────────────
    print_results(agg_rows)

    bullish_n = sum(1 for r in agg_rows if r["signal"] in ("HIGH_CONVICTION", "CONSTRUCTIVE"))
    neutral_n = sum(1 for r in agg_rows if r["signal"] == "NEUTRAL")
    bearish_n = sum(1 for r in agg_rows if r["signal"] in ("NEGATIVE", "HIGH_RISK"))
    logger.info(f"  신호 분포: HIGH_CONVICTION/CONSTRUCTIVE {bullish_n} / NEUTRAL {neutral_n} / NEGATIVE/HIGH_RISK {bearish_n}")

    # ── 7. 저장 ───────────────────────────────────────────────────────────────
    if args.dry_run:
        logger.info("[DRY-RUN] DB 저장 생략.")
        sys.exit(0)

    logger.info(f"  Supabase 저장 중 ({len(agg_rows)}건)...")
    success, failure = save_to_db(sb, agg_rows)

    logger.info("=" * 60)
    logger.info(f"완료: 성공 {success}건 / 실패 {failure}건")
    logger.info("=" * 60)
    sys.exit(0 if failure == 0 else 1)


if __name__ == "__main__":
    main()
