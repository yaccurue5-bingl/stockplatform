"""
scripts/compute_backtest.py
============================
event_macro_v1 전략 백테스트 엔진.

전략 스펙:
  - 전략명: event_macro_v1
  - Entry 필터 1: base_score >= 60
  - Entry 필터 2: 공시일 직전 3영업일 foreign_net_buy_kospi 합계 > 0 (RISK_ON)
  - Exit: T+3 영업일 (scores_log.future_return_3d)
  - 포지션 크기: 균등 가중 (성과 집계 시 단순 평균)

결과 저장:
  - backtest_trades    : 개별 매매 기록 (전략 기준 + RISK_OFF 분리 저장)
  - performance_summary: 전략별 집계 지표

사용법:
  python scripts/compute_backtest.py                   # 전체 히스토리 (기본)
  python scripts/compute_backtest.py --days 180        # 최근 180일만
  python scripts/compute_backtest.py --score-min 70    # score 임계값 변경 (기본 60)
  python scripts/compute_backtest.py --dry-run         # 계산만, DB 저장 안 함
  python scripts/compute_backtest.py --reset           # 기존 backtest_trades 삭제 후 재실행
  python scripts/compute_backtest.py --ignore-regime   # 레짐 필터 무시 (외국인 데이터 없을 때)

[--ignore-regime 사용 시점]
  daily_indicators(외국인순매수) 가 최근 몇 일치밖에 없으면
  과거 공시 전부가 RISK_OFF 로 분류되어 성과 집계가 불가능하다.
  이 플래그를 사용하면 레짐 구분 없이 base_score 조건만으로 전체 거래를
  RISK_ON 으로 취급해 성과 지표를 산출한다.
  (fetch_mofe_indicator.py 히스토리가 충분히 쌓이면 플래그 없이 실행할 것)
"""

import os
import sys
import math
import argparse
import logging
from datetime import datetime, timedelta, date
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
logger = logging.getLogger("compute_backtest")

# ── 상수 ──────────────────────────────────────────────────────────────────────

STRATEGY_NAME       = "event_macro_v1"
DEFAULT_SCORE_MIN   = 60.0
RISK_ON_LOOKBACK    = 3      # 공시일 직전 며칠 합산 (영업일)
ANNUAL_FACTOR_3D    = 252 / 3   # 3영업일 보유 → 연간 거래 횟수 (≈84)
BATCH_SIZE          = 200


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


# ── 영업일 헬퍼 ───────────────────────────────────────────────────────────────

def is_business_day(d: date) -> bool:
    return d.weekday() < 5


def prev_n_business_days(d: date, n: int) -> list[date]:
    """
    d 이전 n 개 영업일 반환 (d 자신은 포함하지 않음).
    예: d=화요일, n=3 → [월, 금(지난주), 목(지난주)]
    """
    result = []
    cur = d - timedelta(days=1)
    while len(result) < n:
        if is_business_day(cur):
            result.append(cur)
        cur -= timedelta(days=1)
    return result


# ── 데이터 조회 ───────────────────────────────────────────────────────────────

def fetch_scores(sb, days: int | None, score_min: float) -> list[dict]:
    """
    scores_log 에서 base_score >= score_min AND future_return_3d IS NOT NULL 인 레코드 조회.
    반환: [{disclosure_id, stock_code, date(ISO), base_score, final_score, future_return_3d, future_return_5d}]
    """
    query = (
        sb.table("scores_log")
        .select("disclosure_id, stock_code, date, base_score, final_score, future_return_3d, future_return_5d")
        .gte("base_score", score_min)
        .not_.is_("future_return_3d", "null")
        .order("date", desc=False)
        .limit(50000)
    )

    if days:
        since = (date.today() - timedelta(days=days)).isoformat()
        query = query.gte("date", since)

    resp = query.execute()
    return resp.data or []


def fetch_foreign_flow_map(sb, needed_dates: set[date]) -> dict[str, float | None]:
    """
    daily_indicators 에서 필요한 날짜들의 foreign_net_buy_kospi 조회.
    반환: {"YYYY-MM-DD": float | None}
    """
    if not needed_dates:
        return {}

    date_strs = [d.isoformat() for d in needed_dates]

    # daily_indicators.date 는 YYYY-MM-DD (ISO) 형식으로 저장됨
    # fetch_mofe_indicator.py / backfill_foreign_flow.py 모두 ISO 형식 사용
    iso_strs = [d.isoformat() for d in needed_dates]

    result: dict[str, float | None] = {}

    chunk = 200
    for i in range(0, len(iso_strs), chunk):
        batch = iso_strs[i:i + chunk]
        try:
            resp = (
                sb.table("daily_indicators")
                .select("date, foreign_net_buy_kospi")
                .in_("date", batch)
                .execute()
            )
            for row in (resp.data or []):
                iso = str(row["date"])   # 이미 YYYY-MM-DD
                val = row.get("foreign_net_buy_kospi")
                result[iso] = float(val) if val is not None else None
        except Exception as e:
            logger.warning(f"  daily_indicators 조회 실패 (batch): {e}")

    return result


# ── 시장 레짐 계산 ────────────────────────────────────────────────────────────

def compute_regime(event_date: date, flow_map: dict[str, float | None]) -> str:
    """
    공시일 직전 RISK_ON_LOOKBACK(3) 영업일의 foreign_net_buy_kospi 합산.
    합계 > 0 → RISK_ON, 그 외 or 데이터 없음 → RISK_OFF
    """
    lookback_days = prev_n_business_days(event_date, RISK_ON_LOOKBACK)
    total = 0.0
    found = 0
    for d in lookback_days:
        iso = d.isoformat()
        val = flow_map.get(iso)
        if val is not None:
            total += val
            found += 1

    if found == 0:
        return "RISK_OFF"   # 데이터 없으면 보수적으로 RISK_OFF
    return "RISK_ON" if total > 0 else "RISK_OFF"


# ── 성과 지표 계산 ────────────────────────────────────────────────────────────

def _mean(vals: list[float]) -> float | None:
    if not vals:
        return None
    return sum(vals) / len(vals)


def _std(vals: list[float]) -> float:
    if len(vals) < 2:
        return 0.0
    n = len(vals)
    m = sum(vals) / n
    return math.sqrt(sum((v - m) ** 2 for v in vals) / (n - 1))


def compute_max_drawdown(returns: list[float]) -> float:
    """
    누적 equity curve 기반 최대 낙폭 계산.
    returns: 거래별 수익률 (%) 리스트 (시간 순)
    반환: 최대 낙폭 (%, 음수)
    """
    if not returns:
        return 0.0

    equity = 100.0
    peak   = 100.0
    max_dd = 0.0

    for r in returns:
        equity *= (1 + r / 100)
        if equity > peak:
            peak = equity
        dd = (equity - peak) / peak * 100
        if dd < max_dd:
            max_dd = dd

    return round(max_dd, 4)


def compute_equity_curve(returns: list[float]) -> list[float]:
    """
    누적 equity curve 반환 (시작 = 100).
    """
    curve = [100.0]
    equity = 100.0
    for r in returns:
        equity *= (1 + r / 100)
        curve.append(round(equity, 4))
    return curve


def compute_performance_metrics(
    trades: list[dict],
    score_threshold: float,
    period_start: date | None,
    period_end: date | None,
) -> dict:
    """
    trade 리스트에서 성과 지표 계산.
    trades: {'return_3d', 'event_date', ...}
    """
    # 복리 계산이 의미 있으려면 시간 순 정렬 필요
    sorted_trades = sorted(trades, key=lambda t: t.get("event_date", ""))
    returns = [t["return_3d"] for t in sorted_trades if t.get("return_3d") is not None]

    if not returns:
        return {}

    n = len(returns)
    avg = _mean(returns)
    std = _std(returns)
    win_rate = sum(1 for r in returns if r > 0) / n

    # 단순 합산 수익률
    total_return = sum(returns)

    # Sharpe ratio (무위험이율 0%, 3영업일 보유 기준으로 연환산)
    sharpe = 0.0
    if std > 0:
        sharpe = (avg / std) * math.sqrt(ANNUAL_FACTOR_3D)

    # 최대 낙폭
    max_dd = compute_max_drawdown(returns)

    # 연환산 수익률 — 복리 누적 수익률 기반 CAGR
    # - 최소 90 달력일 이상 & 최소 10거래 이상일 때만 계산
    #   (기간이 너무 짧으면 지수 증폭으로 의미 없는 수치가 나옴)
    # - 90일 미만이면 None 반환 (API/UI 에서 "N/A" 표시)
    ann_return = None
    MIN_DAYS_FOR_ANN = 90
    if period_start and period_end and len(returns) >= 10:
        n_days = (period_end - period_start).days
        if n_days >= MIN_DAYS_FOR_ANN:
            compound = 1.0
            for r in returns:      # 시간 순 정렬된 수익률
                compound *= (1 + r / 100)
            cagr = compound ** (365 / n_days) - 1
            ann_return = round(cagr * 100, 4)
        else:
            logger.warning(
                f"  연환산 스킵: 기간 {n_days}일 < {MIN_DAYS_FOR_ANN}일 "
                f"(기간이 짧으면 지수 증폭으로 수치 왜곡)"
            )

    risk_on_count = sum(1 for t in trades if t.get("market_regime") == "RISK_ON")

    return {
        "total_return":      round(total_return, 4),
        "annualized_return": ann_return,
        "win_rate":          round(win_rate, 4),
        "avg_return":        round(avg, 4),
        "max_drawdown":      max_dd,
        "sharpe_ratio":      round(sharpe, 4),
        "total_trades":      n,
        "risk_on_trades":    risk_on_count,
        "score_threshold":   score_threshold,
        "holding_days":      "T+3",
    }


# ── DB 저장 ───────────────────────────────────────────────────────────────────

def upsert_trades(sb, trades: list[dict], dry_run: bool) -> tuple[int, int]:
    if dry_run:
        logger.info(f"  [DRY] {len(trades)}건 backtest_trades 저장 생략")
        return len(trades), 0

    success = failure = 0
    for i in range(0, len(trades), BATCH_SIZE):
        batch = trades[i:i + BATCH_SIZE]
        try:
            sb.table("backtest_trades").upsert(
                batch,
                on_conflict="strategy_name,disclosure_id",
            ).execute()
            success += len(batch)
        except Exception as e:
            failure += len(batch)
            logger.error(f"  backtest_trades upsert 실패: {e}")

    return success, failure


def upsert_summary(sb, payload: dict, dry_run: bool) -> bool:
    if dry_run:
        logger.info("  [DRY] performance_summary 저장 생략")
        for k, v in payload.items():
            logger.info(f"    {k}: {v}")
        return True

    try:
        sb.table("performance_summary").upsert(
            payload,
            on_conflict="strategy_name",
        ).execute()
        return True
    except Exception as e:
        logger.error(f"  performance_summary upsert 실패: {e}")
        return False


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="event_macro_v1 전략 백테스트")
    parser.add_argument("--days",       type=int,   default=None,
                        help="최근 N일 데이터만 사용 (기본: 전체 히스토리)")
    parser.add_argument("--score-min",  type=float, default=DEFAULT_SCORE_MIN,
                        help=f"진입 base_score 임계값 (기본: {DEFAULT_SCORE_MIN})")
    parser.add_argument("--dry-run",    action="store_true",
                        help="계산만, DB 저장 안 함")
    parser.add_argument("--reset",         action="store_true",
                        help="기존 해당 전략 backtest_trades 삭제 후 전체 재실행")
    parser.add_argument("--ignore-regime", action="store_true",
                        help="레짐 필터 무시: 외국인 데이터 부족 시 전체를 RISK_ON 으로 처리")
    args = parser.parse_args()

    logger.info("=" * 55)
    logger.info(f"  compute_backtest : {STRATEGY_NAME}")
    logger.info(f"  score_min={args.score_min}  days={args.days}  "
                f"dry_run={args.dry_run}  reset={args.reset}  "
                f"ignore_regime={args.ignore_regime}")
    if args.ignore_regime:
        logger.warning("  ⚠️  --ignore-regime 활성화: 외국인 데이터 무시, 전체 RISK_ON 처리")
        logger.warning("     fetch_mofe_indicator.py 히스토리가 쌓이면 이 플래그 없이 재실행 권장")
    logger.info("=" * 55)

    sb = _get_supabase()

    # ── Reset 옵션 ────────────────────────────────────────────────────────────
    if args.reset and not args.dry_run:
        logger.info("\n  [RESET] 기존 backtest_trades 삭제 중...")
        try:
            sb.table("backtest_trades") \
              .delete() \
              .eq("strategy_name", STRATEGY_NAME) \
              .execute()
            logger.info("  [OK] 삭제 완료")
        except Exception as e:
            logger.error(f"  [ERR] 삭제 실패: {e}")

    # ── Step 1: scores_log 조회 ───────────────────────────────────────────────
    logger.info("\n  [1/4] scores_log 조회 중...")
    score_rows = fetch_scores(sb, args.days, args.score_min)
    logger.info(f"  → {len(score_rows)}건 (base_score≥{args.score_min}, return_3d 있음)")

    if not score_rows:
        logger.info("  처리할 데이터 없음. 종료.")
        sys.exit(0)

    # ── Step 2: 시장 레짐 계산을 위한 외국인 순매수 조회 ──────────────────────
    logger.info("\n  [2/4] 외국인 순매수 데이터 조회 중 (시장 레짐 판단)...")

    if args.ignore_regime:
        logger.info("  → --ignore-regime: 조회 생략, 전체 RISK_ON 처리")
        flow_map: dict[str, float | None] = {}
    else:
        # 필요한 날짜 수집 (공시일 직전 RISK_ON_LOOKBACK 영업일 × 전체 공시 수)
        needed_dates: set[date] = set()
        for row in score_rows:
            event_date = date.fromisoformat(row["date"])
            for d in prev_n_business_days(event_date, RISK_ON_LOOKBACK):
                needed_dates.add(d)

        logger.info(f"  → 조회 날짜: {len(needed_dates)}일")
        flow_map = fetch_foreign_flow_map(sb, needed_dates)
        covered = len(flow_map)
        logger.info(f"  → 데이터 확보: {covered}일 / {len(needed_dates)}일")

        if needed_dates and covered / len(needed_dates) < 0.1:
            logger.warning("  ⚠️  외국인 데이터 커버리지 10% 미만 → 거의 모든 거래가 RISK_OFF 분류됨")
            logger.warning("     fetch_mofe_indicator.py 히스토리가 쌓이거나")
            logger.warning("     --ignore-regime 플래그로 재실행을 권장합니다")

    # ── Step 3: 매매 기록 생성 ───────────────────────────────────────────────
    logger.info("\n  [3/4] 매매 시뮬레이션 중...")

    trades: list[dict] = []
    regime_counts = defaultdict(int)
    no_disc_id = 0

    for row in score_rows:
        disc_id = row.get("disclosure_id")
        if not disc_id:
            no_disc_id += 1
            continue

        event_date = date.fromisoformat(row["date"])
        regime     = "RISK_ON" if args.ignore_regime else compute_regime(event_date, flow_map)
        regime_counts[regime] += 1

        trades.append({
            "strategy_name":  STRATEGY_NAME,
            "stock_code":     row["stock_code"],
            "event_date":     row["date"],   # ISO string
            "disclosure_id":  disc_id,
            "base_score":     row.get("base_score"),
            "final_score":    row.get("final_score"),
            "return_3d":      row.get("future_return_3d"),
            "return_5d":      row.get("future_return_5d"),
            "market_regime":  regime,
        })

    logger.info(f"  → 총 {len(trades)}건  "
                f"RISK_ON={regime_counts['RISK_ON']}  "
                f"RISK_OFF={regime_counts['RISK_OFF']}  "
                f"disc_id 없음={no_disc_id}")

    if not trades:
        logger.info("  저장할 데이터 없음. 종료.")
        sys.exit(0)

    # ── Step 4: 성과 지표 계산 + DB 저장 ─────────────────────────────────────
    logger.info("\n  [4/4] 성과 지표 계산 + 저장 중...")

    # 전략 기준: RISK_ON 진입 거래만으로 performance_summary 산출
    risk_on_trades = [t for t in trades if t["market_regime"] == "RISK_ON"]

    period_start = None
    period_end   = None
    if trades:
        all_dates   = [date.fromisoformat(t["event_date"]) for t in trades]
        period_start = min(all_dates)
        period_end   = max(all_dates)

    metrics = compute_performance_metrics(
        risk_on_trades, args.score_min, period_start, period_end
    )

    if metrics:
        logger.info(f"\n  ── {STRATEGY_NAME} 성과 요약 ──")
        logger.info(f"  기간: {period_start} ~ {period_end}")
        logger.info(f"  전체 거래: {len(trades)}건  (RISK_ON 진입: {len(risk_on_trades)}건)")
        logger.info(f"  승률:      {metrics['win_rate']*100:.1f}%")
        logger.info(f"  평균 수익: {metrics['avg_return']:+.2f}%")
        logger.info(f"  누적 수익: {metrics['total_return']:+.2f}%")
        logger.info(f"  연환산:    {metrics['annualized_return']:+.2f}%" if metrics['annualized_return'] is not None else "  연환산:    N/A")
        logger.info(f"  최대 낙폭: {metrics['max_drawdown']:+.2f}%")
        logger.info(f"  Sharpe:    {metrics['sharpe_ratio']:+.4f}")
    else:
        logger.warning("  RISK_ON 거래 없음 → 성과 지표 계산 불가")

    # backtest_trades upsert (전체: RISK_ON + RISK_OFF 포함 — 분석용)
    ok_cnt, fail_cnt = upsert_trades(sb, trades, args.dry_run)
    logger.info(f"  backtest_trades: 성공 {ok_cnt}건 / 실패 {fail_cnt}건")

    # performance_summary upsert
    if metrics:
        summary_payload = {
            "strategy_name":     STRATEGY_NAME,
            "period_start":      period_start.isoformat() if period_start else None,
            "period_end":        period_end.isoformat()   if period_end   else None,
            "updated_at":        datetime.utcnow().isoformat(),
            **metrics,
        }
        ok = upsert_summary(sb, summary_payload, args.dry_run)
        logger.info(f"  performance_summary: {'OK' if ok else 'FAIL'}")

    logger.info("\n" + "=" * 55)
    logger.info("  compute_backtest 완료")
    logger.info("=" * 55)
    sys.exit(0)


if __name__ == "__main__":
    main()
